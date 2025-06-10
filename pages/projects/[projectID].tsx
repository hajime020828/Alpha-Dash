import { useRouter } from 'next/router';
import { useEffect, useState, useMemo, useCallback } from 'react';
import type { StockRecord, ProjectWithProgress, ProjectDetailApiResponse } from '@/lib/db';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface FutureScenario {
  days: number;
  description: string;
  sharesPerDay: number | null;
  finalBenchmark: number | null;
  finalPL: number | null;
  finalPLBps: number | null;
  priceVsBenchmarkPct: number | null;
}

interface FixedVolumeScenario {
  day: number;
  totalSharesTraded: number;
  finalBenchmark: number | null;
  finalPL: number | null;
  finalPLBps: number | null;
  priceVsBenchmarkPct: number | null;
}

interface FinalMetrics {
    pl: number | null;
    performanceFee: number | null;
    fixedFee: number | null;
    plBps: number | null;
}


const ProjectDetailPage = () => {
  const router = useRouter();
  const { projectID } = router.query;
  const [data, setData] = useState<ProjectDetailApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [finalMetrics, setFinalMetrics] = useState<FinalMetrics | null>(null);

  const [currentMarketPrice, setCurrentMarketPrice] = useState<number | null>(null);
  const [currentAllDayVWAP, setCurrentAllDayVWAP] = useState<number | null>(null);
  const [marketPriceLoading, setMarketPriceLoading] = useState<boolean>(false);
  const [marketPriceError, setMarketPriceError] = useState<string | null>(null);
  const [priceToAdjustedBenchmarkDeviation, setPriceToAdjustedBenchmarkDeviation] = useState<number | null>(null);

  const [simInputPrice, setSimInputPrice] = useState<string>('');
  const [simInputShares, setSimInputShares] = useState<string>('');
  const [simInputDays, setSimInputDays] = useState<string>('1');
  
  const [xValueInput, setXValueInput] = useState<string>('0');

  const [futureScenarios, setFutureScenarios] = useState<FutureScenario[]>([]);
  const [fixedVolumeScenarios, setFixedVolumeScenarios] = useState<FixedVolumeScenario[]>([]);
  const simulatedDateLabel = "シミュレーション";

  const [isDailyBreakdownVisible, setIsDailyBreakdownVisible] = useState<boolean>(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState<boolean>(true);

  useEffect(() => {
    if (projectID && typeof projectID === 'string') {
      const fetchProjectDetails = async () => {
        setLoading(true); 
        try {
          const res = await fetch(`/api/projects/${projectID}`);
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            if (res.status === 404) throw new Error('Project not found');
            throw new Error(`API request failed with status ${res.status}: ${errorData.message || res.statusText}`);
          }
          const fetchedData: ProjectDetailApiResponse = await res.json();
          setData(fetchedData);
          setFinalMetrics({
            pl: fetchedData.finalPL,
            performanceFee: fetchedData.finalPerformanceFee,
            fixedFee: fetchedData.finalFixedFee,
            plBps: fetchedData.finalPLBps,
          });
          setError(null);
        } catch (e: any) {
          setError(e.message || 'Failed to fetch project details');
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      fetchProjectDetails();
    } else if (router.isReady && !projectID) {
        setLoading(false);
        setError("Project ID is missing in the URL.");
    }
  }, [projectID, router.isReady]);

  useEffect(() => {
    if (data?.project && data.project.Ticker) { 
        const ticker = data.project.Ticker;
        const fetchMarketData = async () => {
            setMarketPriceLoading(true);
            setMarketPriceError(null);
            setCurrentMarketPrice(null); 
            setCurrentAllDayVWAP(null);
            try {
                const res = await fetch(`/api/fetch-market-price?ticker=${encodeURIComponent(ticker)}`);
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({ error: "Unknown error fetching market data" }));
                    throw new Error(errorData.error || `Failed to fetch market data: ${res.statusText}`);
                }
                const marketData = await res.json();
                if (marketData.error) {
                    throw new Error(marketData.error);
                }
                if (marketData.price !== undefined) setCurrentMarketPrice(marketData.price);
                if (marketData.allDayVWAP !== undefined) setCurrentAllDayVWAP(marketData.allDayVWAP);

            } catch (e: any) {
                console.error("Failed to fetch market data for ticker:", ticker, e);
                setMarketPriceError(e.message);
                setCurrentMarketPrice(null);
                setCurrentAllDayVWAP(null);
            } finally {
                setMarketPriceLoading(false);
            }
        };
        fetchMarketData();
    }
  }, [data?.project?.Ticker]); 

  useEffect(() => {
    if (currentMarketPrice !== null && currentAllDayVWAP !== null && data && data.project) {
      const { benchmarkVWAP, tradedDaysCount, Side } = data.project;
      
      let newAdjustedBenchmark: number | null = null;
      const currentTradedDaysCount = tradedDaysCount || 0;
      const historicalSum = (benchmarkVWAP !== null && currentTradedDaysCount > 0) ? benchmarkVWAP * currentTradedDaysCount : 0;

      if (currentTradedDaysCount === 0) {
          newAdjustedBenchmark = currentAllDayVWAP;
      } else {
          newAdjustedBenchmark = (historicalSum + currentAllDayVWAP) / (currentTradedDaysCount + 1);
      }
      
      if (newAdjustedBenchmark !== null && newAdjustedBenchmark !== 0) {
        let deviation: number | null = null;
        if (Side === 'SELL') {
          deviation = ((currentMarketPrice - newAdjustedBenchmark) / newAdjustedBenchmark) * 100;
        } else if (Side === 'BUY') {
          deviation = ((newAdjustedBenchmark - currentMarketPrice) / newAdjustedBenchmark) * 100;
        }
        setPriceToAdjustedBenchmarkDeviation(deviation);
      } else {
        setPriceToAdjustedBenchmarkDeviation(null);
      }
    } else {
      setPriceToAdjustedBenchmarkDeviation(null);
    }
  }, [currentMarketPrice, currentAllDayVWAP, data?.project]);

  useEffect(() => {
    if (data?.project) {
        if (data.stockRecords && data.stockRecords.length > 0) {
            const lastRecord = data.stockRecords[data.stockRecords.length - 1];
            setSimInputPrice(prev => prev || (lastRecord?.FilledAveragePrice?.toString() ?? ''));
            setSimInputShares(prev => prev || (lastRecord?.FilledQty?.toString() ?? ''));
        } else {
            setSimInputPrice(prev => prev || '');
            setSimInputShares(prev => prev || '');
        }
    }
  }, [data]);

  const formatNumber = (value: number | null | undefined, fracDigits = 2, defaultVal: string = 'N/A') => {
    if (value === null || value === undefined) return defaultVal;
    if (fracDigits === 0) return Math.round(value).toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return value.toLocaleString('ja-JP', { minimumFractionDigits: fracDigits, maximumFractionDigits: fracDigits });
  };
  
  const formatCurrency = (value: number | null | undefined, defaultVal: string = 'N/A') => {
    if (value === null || value === undefined) return defaultVal;
    return value.toLocaleString('ja-JP', { style: 'currency', currency: 'JPY', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const calculatePLInBasisPoints = useCallback((pl: number | null, benchmark: number | null, totalShares: number | null): number | null => {
    if (pl === null || benchmark === null || totalShares === null || benchmark === 0 || totalShares === 0) return null;
    return (pl / (benchmark * totalShares)) * 10000;
  }, []);

  const calculatePriceVsBenchmarkPct = useCallback((price: number | null, benchmark: number | null): number | null => {
    if (price === null || benchmark === null || benchmark === 0) return null;
    return ((price / benchmark) - 1) * 100;
  }, []);

  const calculateFutureScenario = useCallback((
    baseProjectData: ProjectWithProgress,
    historicalDailyVwaps: (number | null)[],
    futurePrice: number,
    futureSharesLeft: number,
    futureDaysTarget: number
  ): FutureScenario | null => {
    if (!baseProjectData || futurePrice <= 0 || futureSharesLeft <= 0 || futureDaysTarget <= 0) {
      return null;
    }
    const validHistoricalVwaps = historicalDailyVwaps.filter(vwap => vwap !== null) as number[];
    let scenarioVwaps = [...validHistoricalVwaps];
    let scenarioCumulativeShares = baseProjectData.totalFilledQty || 0;
    let scenarioCumulativeAmount = baseProjectData.totalFilledAmount || 0;
    const sharesPerDay = Math.ceil(futureSharesLeft / futureDaysTarget);
    let sharesRemainingForScenario = futureSharesLeft;

    for (let i = 0; i < futureDaysTarget; i++) {
      const sharesForThisDay = Math.min(sharesPerDay, sharesRemainingForScenario);
      if (sharesForThisDay <= 0) break;
      scenarioCumulativeShares += sharesForThisDay;
      scenarioCumulativeAmount += futurePrice * sharesForThisDay;
      scenarioVwaps.push(futurePrice);
      sharesRemainingForScenario -= sharesForThisDay;
    }
    
    const finalBenchmark = scenarioVwaps.length > 0 
        ? scenarioVwaps.reduce((sum, vwap) => sum + vwap, 0) / scenarioVwaps.length
        : futurePrice; 
    let finalPL = 0;
    if (baseProjectData.Side === 'SELL') {
        finalPL = scenarioCumulativeAmount - (finalBenchmark * scenarioCumulativeShares);
    } else { 
        finalPL = (finalBenchmark * scenarioCumulativeShares) - scenarioCumulativeAmount;
    }
    const finalPLBps = calculatePLInBasisPoints(finalPL, finalBenchmark, scenarioCumulativeShares);
    const priceVsBenchmarkPct = calculatePriceVsBenchmarkPct(futurePrice, finalBenchmark);
    return {
      days: futureDaysTarget, description: `${futureDaysTarget}日で終了`, sharesPerDay: sharesPerDay,
      finalBenchmark: finalBenchmark, finalPL: finalPL, finalPLBps: finalPLBps, priceVsBenchmarkPct: priceVsBenchmarkPct,
    };
  }, [calculatePLInBasisPoints, calculatePriceVsBenchmarkPct]);
  
  const calculateFixedVolumeScenario = useCallback((
    baseProjectData: ProjectWithProgress,
    historicalDailyVwaps: (number | null)[],
    futurePrice: number,
    dailySharesToTrade: number,
    numberOfDays: number
  ): FixedVolumeScenario | null => {
      if (!baseProjectData || futurePrice <= 0 || dailySharesToTrade <= 0 || numberOfDays <= 0) {
          return null;
      }
      const validHistoricalVwaps = historicalDailyVwaps.filter(vwap => vwap !== null) as number[];
      let scenarioVwaps = [...validHistoricalVwaps];
      let scenarioCumulativeShares = baseProjectData.totalFilledQty || 0;
      let scenarioCumulativeAmount = baseProjectData.totalFilledAmount || 0;
  
      for (let i = 0; i < numberOfDays; i++) {
          scenarioCumulativeShares += dailySharesToTrade;
          scenarioCumulativeAmount += futurePrice * dailySharesToTrade;
          scenarioVwaps.push(futurePrice);
      }
      
      const finalBenchmark = scenarioVwaps.length > 0 
          ? scenarioVwaps.reduce((sum, vwap) => sum + vwap, 0) / scenarioVwaps.length
          : futurePrice; 
      
      let finalPL = 0;
      if (baseProjectData.Side === 'SELL') {
          finalPL = scenarioCumulativeAmount - (finalBenchmark * scenarioCumulativeShares);
      } else { 
          finalPL = (finalBenchmark * scenarioCumulativeShares) - scenarioCumulativeAmount;
      }
      
      const finalPLBps = calculatePLInBasisPoints(finalPL, finalBenchmark, scenarioCumulativeShares);
      const priceVsBenchmarkPct = calculatePriceVsBenchmarkPct(futurePrice, finalBenchmark);
      
      return {
        day: numberOfDays,
        totalSharesTraded: scenarioCumulativeShares,
        finalBenchmark,
        finalPL,
        finalPLBps,
        priceVsBenchmarkPct,
      };
  }, [calculatePLInBasisPoints, calculatePriceVsBenchmarkPct]);


  useEffect(() => {
    const numFuturePrice = parseFloat(simInputPrice);
    const numSimShares = parseFloat(simInputShares);
    const numMaxDays = parseInt(simInputDays, 10);

    if (data?.project && data.stockRecords &&
        !isNaN(numFuturePrice) && numFuturePrice > 0 &&
        !isNaN(numSimShares) && numSimShares > 0 &&
        !isNaN(numMaxDays) && numMaxDays > 0) {
        
        const historicalDailyVwaps = data.stockRecords.map(r => r.ALL_DAY_VWAP);

        const newFutureScenarios: FutureScenario[] = [];
        for (let d = 1; d <= numMaxDays; d++) {
            const scenario = calculateFutureScenario(data.project, historicalDailyVwaps, numFuturePrice, numSimShares, d);
            if (scenario) newFutureScenarios.push(scenario);
        }
        setFutureScenarios(newFutureScenarios);
        
        const newFixedVolumeScenarios: FixedVolumeScenario[] = [];
        for (let d = 1; d <= numMaxDays; d++) {
            const scenario = calculateFixedVolumeScenario(data.project, historicalDailyVwaps, numFuturePrice, numSimShares, d);
            if(scenario) newFixedVolumeScenarios.push(scenario);
        }
        setFixedVolumeScenarios(newFixedVolumeScenarios);

    } else {
      setFutureScenarios([]);
      setFixedVolumeScenarios([]);
    }
  }, [simInputPrice, simInputShares, simInputDays, data, calculateFutureScenario, calculateFixedVolumeScenario]);
  
  const finalChartData = useMemo(() => {
    if (!data) return null;
    
    const currentProject = data?.project;
    const currentStockRecords = data?.stockRecords || [];
    const numPriceForChart = simInputPrice !== '' && !isNaN(parseFloat(simInputPrice)) ? parseFloat(simInputPrice) : null;
    const numSharesForChart = simInputShares !== '' && !isNaN(parseFloat(simInputShares)) ? parseFloat(simInputShares) : null;

    const baseLabels = currentStockRecords.map(record => record.Date);
    const baseAvgPriceData = currentStockRecords.map(record => record.FilledAveragePrice);
    const baseDailyVwapData = currentStockRecords.map(record => record.ALL_DAY_VWAP);
    const baseBenchmarkTrendData = currentStockRecords.map(record => record.cumulativeBenchmarkVWAP);
    const baseQtyData = currentStockRecords.map(record => record.FilledQty);
    let chartLabels = [...baseLabels];
    let chartAvgPriceData: (number | null)[] = [...baseAvgPriceData];
    let chartDailyVwapData: (number | null)[] = [...baseDailyVwapData];
    let chartBenchmarkTrendData: (number | null)[] = [...baseBenchmarkTrendData];
    let chartQtyData: (number | null)[] = [...baseQtyData];

    if (numPriceForChart !== null || (numSharesForChart !== null && numSharesForChart !== 0) ) {
        if(chartLabels.indexOf(simulatedDateLabel) === -1) {
            chartLabels.push(simulatedDateLabel);
        }
        chartAvgPriceData.push(numPriceForChart); 
        chartDailyVwapData.push(numPriceForChart); 
        let benchmarkForSimulatedPoint: number | null = null;
        if (currentProject && numPriceForChart !== null) { 
            if (currentStockRecords.length > 0) {
                const histSum = (currentProject.benchmarkVWAP || 0) * (currentProject.tradedDaysCount || 0);
                const histCount = currentProject.tradedDaysCount || 0;
                benchmarkForSimulatedPoint = (histCount + 1 > 0) ? (histSum + numPriceForChart) / (histCount + 1) : numPriceForChart;
            } else {
                benchmarkForSimulatedPoint = numPriceForChart;
            }
        }
        chartBenchmarkTrendData.push(benchmarkForSimulatedPoint);
        chartQtyData.push(numSharesForChart); 
    }
    if (chartLabels.length === 0) return null;
    
    const toChartableData = (arr: (number | null)[]): number[] => arr.map(p => p === null ? NaN : p);
    return {
      labels: chartLabels,
      datasets: [
        { type: 'line' as const, label: '約定平均価格', data: toChartableData(chartAvgPriceData), borderColor: 'rgb(255, 99, 132)', backgroundColor: 'rgba(255, 99, 132, 0.2)', yAxisID: 'yPrice', tension: 0.1, pointRadius: 3 },
        { type: 'line' as const, label: '当日VWAP', data: toChartableData(chartDailyVwapData), borderColor: 'rgb(54, 162, 235)', backgroundColor: 'rgba(54, 162, 235, 0.2)', yAxisID: 'yPrice', tension: 0.1, pointRadius: 3 },
        { type: 'line' as const, label: 'ベンチマーク推移', data: toChartableData(chartBenchmarkTrendData), borderColor: 'rgb(75, 192, 192)', backgroundColor: 'rgba(75, 192, 192, 0.2)', yAxisID: 'yPrice', tension: 0.1, pointRadius: 3 },
        { type: 'bar' as const, label: '約定数量', data: toChartableData(chartQtyData), backgroundColor: 'rgba(153, 102, 255, 0.6)', borderColor: 'rgb(153, 102, 255)', yAxisID: 'yQuantity', order: 10 },
      ],
    };
  }, [data?.project, data?.stockRecords, simInputPrice, simInputShares, simulatedDateLabel]);

  const chartOptions: any = { 
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 20, bottom: 0, left: 10, right: 20 }},
    plugins: {
      legend: { 
        position: 'top' as const,
        labels: {
          boxWidth: 30,
          boxHeight: 2,
          padding: 10,
          font: {
            size: 11,
          }
        }
      },
      title: { display: true, text: '価格・VWAP・ベンチマーク推移と約定数量', font: { size: 16 }, padding: { bottom: 20 } },
      tooltip: { mode: 'index' as const, intersect: false, },
    },
    scales: {
      x: { 
        title: { 
          display: true, 
          text: '日付',
          padding: { top: 10, bottom: 0 }
        } 
      },
      yPrice: { 
        type: 'linear' as const, display: true, position: 'left' as const, title: { display: true, text: '価格' },
        grid: { drawOnChartArea: true },
        ticks: { callback: function(value: string | number) { return typeof value === 'number' ? formatNumber(value, 0) : value; } },
        grace: '5%',
        beginAtZero: false,
      },
      yQuantity: { 
        type: 'linear' as const, display: true, position: 'right' as const, title: { display: true, text: '約定数量 (株)' },
        grid: { drawOnChartArea: false },
        ticks: { callback: function(value: string | number) { return typeof value === 'number' ? formatNumber(value, 0) : value; } },
        min: 0, grace: '10%',
      },
    },
    interaction: { mode: 'index' as const, axis: 'x' as const, intersect: false }
  };
  
  const scatterChartData = useMemo(() => {
    const records = data?.stockRecords || [];
    const avgPrice = data?.project?.averageExecutionPrice ?? null;
    const avgQty = data?.project?.averageDailyShares ?? null;
    const side = data?.project?.Side;
    
    const datasets: any[] = [];

    const points = records.map(record => ({
        x: record.FilledAveragePrice,
        y: record.FilledQty,
        date: record.Date
    }));
    
    const pointRadii: number[] = new Array(points.length).fill(5);
    const pointBackgroundColors: string[] = new Array(points.length).fill('rgba(255, 99, 132, 0.7)');

    const numSimPrice = simInputPrice !== '' && !isNaN(parseFloat(simInputPrice)) ? parseFloat(simInputPrice) : null;
    const numSimShares = simInputShares !== '' && !isNaN(parseFloat(simInputShares)) ? parseFloat(simInputShares) : null;
    
    if (numSimPrice !== null && numSimShares !== null && numSimShares > 0) {
        points.push({
            x: numSimPrice,
            y: numSimShares,
            date: 'シミュレーション'
        });
        pointRadii.push(8); 
        pointBackgroundColors.push('rgba(75, 192, 192, 1)');
    }
    
    if (points.length > 0) {
        datasets.push({
            label: '約定履歴 (日付順)',
            data: points,
            borderColor: 'rgba(255, 99, 132, 0.5)',
            showLine: true,
            tension: 0,
            pointRadius: pointRadii,
            backgroundColor: pointBackgroundColors,
        });
    }

    const xValue = xValueInput !== '' && !isNaN(parseFloat(xValueInput)) ? parseFloat(xValueInput) : null;
    
    if (xValue !== null && avgPrice !== null && avgPrice > 0 && avgQty !== null && avgQty > 0) {
        let slope = (avgQty / avgPrice) * xValue;
        if (side === 'BUY') {
          slope = -slope;
        }

        const xDataPoints = points.map(p => p.x).filter(x => x !== null) as number[];
        if (xDataPoints.length > 0) {
            const minX = Math.min(...xDataPoints);
            const maxX = Math.max(...xDataPoints);
            
            const yAtMinX = avgQty + slope * (minX - avgPrice);
            const yAtMaxX = avgQty + slope * (maxX - avgPrice);
            
            datasets.push({
                type: 'line',
                label: `トレンド (X=${xValue})`,
                data: [{x: minX, y: yAtMinX}, {x: maxX, y: yAtMaxX}],
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderWidth: 2,
                fill: false,
                pointRadius: 0,
                borderDash: [5, 5],
            });
        }
    }
    
    if (datasets.length === 0) return null;

    return { datasets };
  }, [data?.stockRecords, data?.project, simInputPrice, simInputShares, xValueInput]);

  const scatterChartOptions: any = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
          legend: { 
            position: 'top' as const,
            labels: {
              boxWidth: 30,
              boxHeight: 2,
              padding: 10,
              font: {
                size: 11,
              }
            }
          },
          title: {
              display: true,
              text: '約定価格 vs. 数量 推移 (日付順)',
              font: { size: 16 },
              padding: { bottom: 10 } 
          },
          tooltip: {
              callbacks: {
                  label: function(context: any) {
                      if(context.dataset.type === 'line' && context.dataset.label.includes('トレンド')) return null;
                      const point = context.raw;
                      return [
                          `日付: ${point.date}`,
                          `価格: ${formatNumber(point.x, 2)}`,
                          `数量: ${formatNumber(point.y, 0)} 株`
                      ];
                  }
              }
          }
      },
      scales: {
          x: {
              type: 'linear' as const,
              position: 'bottom',
              title: {
                  display: true,
                  text: '約定平均価格 (円)'
              }
          },
          y: {
              title: {
                  display: true,
                  text: '約定数量 (株)'
              },
              beginAtZero: false,
              grace: '5%'
          }
      }
  };


  if (loading && !data) return <p className="text-center text-gray-500">プロジェクト詳細を読み込み中...</p>;
  if (error) return <p className="text-center text-red-500">エラー: {error}</p>;
  if (!data || !data.project) return <p className="text-center text-gray-500">プロジェクトデータが見つかりません。</p>;

  const { project, stockRecords } = data;
  
  let displayTotalShares: number | null | undefined = project.Total_Shares;
  let displayTotalAmount: number | null | undefined = project.Total_Amount;

  if (project && currentMarketPrice !== null && currentMarketPrice > 0) {
      if (project.Total_Shares && (project.Total_Amount === null || project.Total_Amount === 0)) {
          displayTotalAmount = project.Total_Shares * currentMarketPrice;
      } 
      else if (project.Total_Amount && (project.Total_Shares === null || project.Total_Shares === 0)) {
          displayTotalShares = project.Total_Amount / currentMarketPrice;
      }
  }
  
  const displayStockRecords = [...stockRecords].reverse(); 

  const tradedDays = project.tradedDaysCount || 0;
  let daysUntilEarliest: number | null = null;
  if (typeof project.Earliest_Day_Count === 'number') daysUntilEarliest = project.Earliest_Day_Count - tradedDays;
  let remainingBusinessDays: number | null = null;
  if (typeof project.Business_Days === 'number') remainingBusinessDays = project.Business_Days - tradedDays;
  
  let effectiveRemainingTargetShares: number | null = null;
  let sharesCalcStatusMessage: string | null = null;
  let remainingAmount: number | null = null;
  
  if (project.Total_Shares !== null && project.Total_Shares > 0) {
      effectiveRemainingTargetShares = Math.max(0, project.Total_Shares - (project.totalFilledQty || 0));
  } 
  else if (project.Total_Amount !== null && project.Total_Amount > 0) {
      remainingAmount = Math.max(0, project.Total_Amount - (project.totalFilledAmount || 0));
      if (marketPriceLoading) {
        sharesCalcStatusMessage = '株価読込中...';
      } else if (currentMarketPrice !== null && currentMarketPrice > 0) {
          effectiveRemainingTargetShares = remainingAmount / currentMarketPrice;
          if (effectiveRemainingTargetShares < 1 && remainingAmount > 0) { 
              sharesCalcStatusMessage = '株価に対し残額僅少'; 
              effectiveRemainingTargetShares = 0; 
          }
      } else if (currentMarketPrice === null) {
          sharesCalcStatusMessage = '株価未取得';
      } else {
          sharesCalcStatusMessage = '株価不正';
      }
  }
  else {
      if ((project.totalFilledQty || 0) > 0 || (project.totalFilledAmount || 0) > 0 || project.Total_Shares === 0 || project.Total_Amount === 0) {
        effectiveRemainingTargetShares = 0; 
      } else {
        sharesCalcStatusMessage = '目標未設定';
      }
  }

  let maxSharesPerDayText: string = 'N/A';
  if (sharesCalcStatusMessage && sharesCalcStatusMessage !== '株価に対し残額僅少') {
    maxSharesPerDayText = sharesCalcStatusMessage;
  } else if (effectiveRemainingTargetShares !== null) {
    if (effectiveRemainingTargetShares === 0) maxSharesPerDayText = '0 株/日 (完了)';
    else if (daysUntilEarliest !== null && daysUntilEarliest > 0) maxSharesPerDayText = formatNumber(effectiveRemainingTargetShares / daysUntilEarliest, 0) + ' 株/日';
    else if (daysUntilEarliest !== null && daysUntilEarliest <= 0) maxSharesPerDayText = '最短期限超過';
    else maxSharesPerDayText = 'N/A';
  }

  let minSharesPerDayText: string = 'N/A';
  if (sharesCalcStatusMessage && sharesCalcStatusMessage !== '株価に対し残額僅少') {
      minSharesPerDayText = sharesCalcStatusMessage;
  } else if (effectiveRemainingTargetShares !== null) {
    if (effectiveRemainingTargetShares === 0) minSharesPerDayText = '0 株/日 (完了)';
    else if (remainingBusinessDays !== null && remainingBusinessDays > 0) minSharesPerDayText = formatNumber(effectiveRemainingTargetShares / remainingBusinessDays, 0) + ' 株/日';
    else if (remainingBusinessDays !== null && remainingBusinessDays <= 0) minSharesPerDayText = '残日数なし';
    else minSharesPerDayText = 'N/A';
  }

  let dailySharesBreakdown: { dayCount: number; sharesPerDay: number }[] = [];
  const canCalculateBreakdown = effectiveRemainingTargetShares !== null && effectiveRemainingTargetShares > 0 && daysUntilEarliest !== null && daysUntilEarliest > 0 && remainingBusinessDays !== null && remainingBusinessDays >= daysUntilEarliest;
  if (canCalculateBreakdown) {
    const sharesToDistribute = effectiveRemainingTargetShares; 
    const startDay = daysUntilEarliest;
    const endDay = remainingBusinessDays;
    for (let d = startDay; d <= endDay; d++) { 
        if (d > 0) dailySharesBreakdown.push({ dayCount: d, sharesPerDay: sharesToDistribute / d });
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-start mb-6">
        <h1 className="text-3xl font-bold text-gray-800">プロジェクト詳細: {project.Name} ({project.ProjectID || `Internal ID: ${project.internal_id}`})</h1>
        <div className="text-right"><p className="text-sm text-gray-600">TS担当者:</p><p className="text-lg font-semibold text-gray-700">{project.TS_Contact || 'N/A'}</p></div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">基本情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <p><strong>銘柄コード:</strong> {project.Ticker}</p> <p><strong>銘柄名:</strong> {project.Name}</p>
          <p><strong>Side:</strong><span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${project.Side === 'BUY' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>{project.Side}</span></p>
          <p><strong>総株数:</strong> {formatNumber(displayTotalShares, 0) ?? 'N/A'} 株</p>
          <p><strong>総金額:</strong> {formatCurrency(displayTotalAmount) ?? 'N/A'}</p>
          <p><strong>開始日:</strong> {project.Start_Date}</p> <p><strong>終了日:</strong> {project.End_Date}</p>
          <p><strong>価格制限:</strong> {formatNumber(project.Price_Limit, 0) ?? 'N/A'}</p> <p><strong>成功報酬:</strong> {project.Performance_Based_Fee_Rate ?? 'N/A'}%</p>
          <p><strong>固定手数料率:</strong> {project.Fixed_Fee_Rate ?? 'N/A'}%</p> <p><strong>営業日数:</strong> {project.Business_Days ?? 'N/A'}</p>
          <p><strong>最短日数カウント:</strong> {project.Earliest_Day_Count ?? 'N/A'}</p>
          <p><strong>最大株数/日 (目安):</strong> {maxSharesPerDayText}</p> <p><strong>最小株数/日 (目安):</strong> {minSharesPerDayText}</p>
          <p><strong>現在の株価:</strong> {marketPriceLoading ? <span className="text-gray-500">読み込み中...</span> : currentMarketPrice !== null ? formatNumber(currentMarketPrice, 2) : marketPriceError ? <span className="text-red-500">取得エラー</span> : 'N/A'}</p>
          <p><strong>現在のVWAP:</strong> {marketPriceLoading ? <span className="text-gray-500">読み込み中...</span> : currentAllDayVWAP !== null ? formatNumber(currentAllDayVWAP, 2) : marketPriceError ? <span className="text-red-500">取得エラー</span> : 'N/A'}</p>
          <p><strong>ベンチマーク乖離率:</strong> {marketPriceLoading ? <span className="text-xs text-gray-500">計算中...</span> : (currentMarketPrice === null || currentAllDayVWAP === null) ? <span className="text-xs text-gray-500">価格未取得</span> : priceToAdjustedBenchmarkDeviation === null ? <span className="text-xs text-gray-500">計算不可</span> : <span className={`font-semibold ${priceToAdjustedBenchmarkDeviation >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNumber(priceToAdjustedBenchmarkDeviation, 2)} %</span>}</p>
          <p className="md:col-span-2"><strong>メモ:</strong> {project.Note || 'N/A'}</p>
        </div>
        {canCalculateBreakdown && (
            <div className="mt-4 pt-4 border-t border-gray-200">
                <button onClick={() => setIsDailyBreakdownVisible(!isDailyBreakdownVisible)} className="text-sm text-indigo-600 hover:text-indigo-800 focus:outline-none mb-2">
                    {isDailyBreakdownVisible ? '株数/日 目安---隠す' : '株数/日 目安---表示'} {isDailyBreakdownVisible ? '▲' : '▼'}
                </button>
                {isDailyBreakdownVisible && (
                    <div className="p-3 border rounded-md bg-gray-50 text-xs max-h-48 overflow-y-auto">
                        {dailySharesBreakdown.length > 0 ? (<ul className="space-y-1">{dailySharesBreakdown.map(item => (<li key={item.dayCount}>{item.dayCount}日: {formatNumber(item.sharesPerDay, 0)} 株/日</li>))}</ul>) 
                        : (<p className="text-gray-500">表示できる日毎の目安がありません。</p>)}
                    </div>
                )}
            </div>
        )}
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">プロジェクトサマリー(前営業日時点)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 text-center">
            
            <div>
                <p className="text-sm text-gray-500">約定進捗率</p>
                <p className="text-3xl font-bold text-teal-600">
                    {formatNumber(project.executionProgress, 1)}<span className="text-xl">%</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                    {
                        (project.Total_Shares !== null && project.Total_Shares > 0) ? 
                        `(${formatNumber(project.totalFilledQty,0)} / ${formatNumber(project.Total_Shares,0)} 株)` :
                        (project.Total_Amount !== null && project.Total_Amount > 0) ?
                        `(${formatCurrency(project.totalFilledAmount)} / ${formatCurrency(project.Total_Amount)})` :
                        'N/A'
                    }
                </p>
            </div>

            <div>
                <p className="text-sm text-gray-500">日数進捗率</p>
                <p className="text-3xl font-bold text-sky-600">
                    {formatNumber(project.daysProgress, 1)}<span className="text-xl">%</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                    (取引 {project.tradedDaysCount || 0}日 / 全 {project.Business_Days || 'N/A'}営業日)
                </p>
            </div>

            <div>
                <p className="text-sm text-gray-500">残存株数 (目安)</p>
                <p className="text-3xl font-bold text-blue-600">
                    {sharesCalcStatusMessage 
                        ? <span className="text-lg text-gray-600">{sharesCalcStatusMessage}</span>
                        : formatNumber(effectiveRemainingTargetShares, 0)
                    }
                    <span className="text-xl ml-1">株</span>
                </p>
                {remainingAmount !== null && (
                    <p className="text-xs text-gray-500 mt-1">
                        (残金額: {formatCurrency(remainingAmount)})
                    </p>
                )}
            </div>
            
            <div>
                <p className="text-sm text-gray-500">残存営業日数</p>
                <p className="text-3xl font-bold text-orange-600">
                    {remainingBusinessDays !== null ? `${remainingBusinessDays}` : 'N/A'}
                    <span className="text-xl ml-1">日</span>
                </p>
            </div>

            <div>
                <p className="text-sm text-gray-500">最短まで(残日数)</p>
                <p className="text-3xl font-bold text-purple-600">
                    {daysUntilEarliest !== null ? `${Math.max(0, daysUntilEarliest)}` : 'N/A'}
                    <span className="text-xl ml-1">日</span>
                </p>
            </div>

            <div>
                <p className="text-sm text-gray-500">ベンチマーク VWAP</p>
                <p className="text-3xl font-bold text-indigo-600">{formatNumber(project.benchmarkVWAP)}</p>
            </div>

            <div>
                <p className="text-sm text-gray-500">平均約定単価</p>
                <p className="text-3xl font-bold text-teal-600">{formatNumber(project.averageExecutionPrice)}</p>
            </div>

            <div>
                <p className="text-sm text-gray-500">平均約定株数/日</p>
                <p className="text-3xl font-bold text-amber-600">
                    {formatNumber(project.averageDailyShares, 0)}
                    <span className="text-xl ml-1">株</span>
                </p>
            </div>
        </div>
        
      </div>
      
      {finalMetrics && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">損益・手数料 (前営業日時点)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 text-center">
            <div>
              <p className="text-sm text-gray-500">P/L (評価損益)</p>
              <p className={`text-3xl font-bold ${finalMetrics.pl !== null && finalMetrics.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(finalMetrics.pl, '-')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">P/L (bps)</p>
              <p className={`text-3xl font-bold ${finalMetrics.plBps !== null && finalMetrics.plBps >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNumber(finalMetrics.plBps, 2, '-')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">成功報酬額</p>
              <p className={`text-3xl font-bold ${finalMetrics.performanceFee !== null && finalMetrics.performanceFee > 0 ? 'text-green-600' : 'text-gray-800'}`}>
                {formatCurrency(finalMetrics.performanceFee, formatCurrency(0))}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">固定手数料</p>
              <p className="text-3xl font-bold text-gray-800">
                {formatCurrency(finalMetrics.fixedFee, formatCurrency(0))}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">P/L シミュレーション</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-end">
            <div>
                <label htmlFor="simInputPrice" className="block text-sm font-medium text-gray-700">価格</label>
                <input type="number" name="simInputPrice" id="simInputPrice" value={simInputPrice} onChange={(e) => setSimInputPrice(e.target.value)}
                        onWheel={ e => (e.target as HTMLElement).blur() }
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="例: 101.0"/>
            </div>
            <div>
                <label htmlFor="simInputShares" className="block text-sm font-medium text-gray-700">株数</label>
                <input type="number" name="simInputShares" id="simInputShares" value={simInputShares} onChange={(e) => setSimInputShares(e.target.value)}
                        onWheel={ e => (e.target as HTMLElement).blur() }
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="例: 10000"/>
            </div>
            <div>
                <label htmlFor="simInputDays" className="block text-sm font-medium text-gray-700">シミュレーション日数</label>
                <input type="number" name="simInputDays" id="simInputDays" value={simInputDays} onChange={(e) => setSimInputDays(e.target.value)}
                        onWheel={ e => (e.target as HTMLElement).blur() }
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="例: 5" min="1"/>
            </div>
        </div>
        
        {/* ★ここからシナリオテーブルの順序入替 */}
        {fixedVolumeScenarios.length > 0 && (
            <div className="overflow-x-auto">
                <h3 className="text-md font-medium text-gray-700 mb-2">日数別シナリオ (入力した<span className="font-bold">株数</span>を毎日N日間取引)</h3>
                <table className="min-w-full leading-normal text-sm">
                    <thead>
                        <tr className="bg-gray-100 text-gray-600 uppercase text-xs leading-normal">
                            <th className="py-2 px-3 text-left">取引日数</th>
                            <th className="py-2 px-3 text-right">累計取引株数</th>
                            <th className="py-2 px-3 text-right">最終ベンチマーク</th>
                            <th className="py-2 px-3 text-right">入力価格vsベンチ(%)</th>
                            <th className="py-2 px-3 text-right">最終P/L</th>
                            <th className="py-2 px-3 text-right">最終P/L (bps)</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700">
                        {fixedVolumeScenarios.map((scenario) => (
                            <tr key={scenario.day} className="border-b border-gray-200 hover:bg-gray-50">
                                <td className="py-2 px-3 text-left">{scenario.day} 日間</td>
                                <td className="py-2 px-3 text-right">{formatNumber(scenario.totalSharesTraded, 0)}</td>
                                <td className="py-2 px-3 text-right">{formatNumber(scenario.finalBenchmark, 4)}</td>
                                <td className={`py-2 px-3 text-right ${scenario.priceVsBenchmarkPct !== null && scenario.priceVsBenchmarkPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNumber(scenario.priceVsBenchmarkPct, 2)}%</td>
                                <td className={`py-2 px-3 text-right ${scenario.finalPL !== null && scenario.finalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(scenario.finalPL)}</td>
                                <td className={`py-2 px-3 text-right ${scenario.finalPLBps !== null && scenario.finalPLBps >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNumber(scenario.finalPLBps, 2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {futureScenarios.length > 0 && (
            <div className="overflow-x-auto mt-8">
                <h3 className="text-md font-medium text-gray-700 mb-2">終了日数別シナリオ (入力した<span className="font-bold">株数</span>をN日間で消化)</h3>
                <table className="min-w-full leading-normal text-sm">
                    <thead>
                        <tr className="bg-gray-100 text-gray-600 uppercase text-xs leading-normal">
                            <th className="py-2 px-3 text-left">シナリオ(日数)</th><th className="py-2 px-3 text-right">株数/日</th><th className="py-2 px-3 text-right">最終ベンチマーク</th>
                            <th className="py-2 px-3 text-right">入力価格vsベンチ(%)</th><th className="py-2 px-3 text-right">最終P/L</th><th className="py-2 px-3 text-right">最終P/L (bps)</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700">
                        {futureScenarios.map((scenario) => (
                            <tr key={scenario.days} className="border-b border-gray-200 hover:bg-gray-50">
                                <td className="py-2 px-3 text-left">{scenario.description}</td><td className="py-2 px-3 text-right">{formatNumber(scenario.sharesPerDay, 0)}</td>
                                <td className="py-2 px-3 text-right">{formatNumber(scenario.finalBenchmark, 4)}</td>
                                <td className={`py-2 px-3 text-right ${scenario.priceVsBenchmarkPct !== null && scenario.priceVsBenchmarkPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNumber(scenario.priceVsBenchmarkPct, 2)}%</td>
                                <td className={`py-2 px-3 text-right ${scenario.finalPL !== null && scenario.finalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(scenario.finalPL)}</td>
                                <td className={`py-2 px-3 text-right ${scenario.finalPLBps !== null && scenario.finalPLBps >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNumber(scenario.finalPLBps, 2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
        {/* ★ここまでシナリオテーブルの順序入替 */}

        {(futureScenarios.length === 0 && fixedVolumeScenarios.length === 0 && simInputPrice && simInputShares && simInputDays) && (
            <p className="text-gray-500 mt-4">入力値に基づいてシナリオを生成します...</p>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {finalChartData ? (
            <div className="bg-white shadow-md rounded-lg p-4 md:p-6 flex flex-col">
                <div className="relative flex-grow min-h-[450px]">
                    <Chart type='line' data={finalChartData} options={chartOptions} />
                </div>
            </div>
          ) : <div />}
        
        {scatterChartData ? (
            <div className="bg-white shadow-md rounded-lg p-4 md:p-6 flex flex-col">
              <div className="mb-4">
                <label htmlFor="xValueInput" className="block text-sm font-medium text-gray-700">価格/数量 トレンドライン (X)</label>
                <p className="text-xs text-gray-500 mb-1">中心価格から1%変動した時の数量の変動率(%)を入力</p>
                <input
                  type="number"
                  id="xValueInput"
                  value={xValueInput}
                  onChange={(e) => setXValueInput(e.target.value)}
                  className="mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="例: 1.5 (価格有利で1.5%数量増)"
                  step="0.1"
                />
              </div>
              <div className="relative flex-grow min-h-[450px]">
                  <Chart type='scatter' data={scatterChartData} options={scatterChartOptions} />
              </div>
            </div>
        ) : <div />}
      </div>

      {displayStockRecords && displayStockRecords.length > 0 ? (
        <div className="bg-white shadow-md rounded-lg">
          <div className="flex justify-between items-center p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-700">取引履歴</h2>
            <button
              onClick={() => setIsHistoryVisible(!isHistoryVisible)}
              className="text-sm text-indigo-600 hover:text-indigo-800 focus:outline-none"
            >
              {isHistoryVisible ? '隠す' : '表示する'} {isHistoryVisible ? '▲' : '▼'}
            </button>
          </div>
          {isHistoryVisible && (
            <div className="overflow-x-auto">
              <table className="min-w-full leading-normal">
                <thead>
                  <tr className="bg-gray-200 text-gray-600 uppercase text-xs leading-normal">
                    <th className="py-3 px-6 text-left">日付</th>
                    <th className="py-3 px-6 text-right">約定数量</th>
                    <th className="py-3 px-6 text-right">累積約定株数</th>
                    <th className="py-3 px-6 text-right">約定平均価格</th>
                    <th className="py-3 px-6 text-right">当日VWAP</th>
                    <th className="py-3 px-6 text-right">ベンチマーク推移</th>
                    <th className="py-3 px-6 text-right">VWAP Perf. (bps)</th>
                    <th className="py-3 px-6 text-right">P/L (評価損益)</th>
                    <th className="py-3 px-6 text-right">成功報酬額</th>
                    <th className="py-3 px-6 text-right">固定手数料(累積)</th>
                    <th className="py-3 px-6 text-right">P/L (bps)</th>
                    <th className="py-3 px-6 text-right">累積約定金額(円)</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 text-sm">
                  {displayStockRecords.map((record, index) => {
                    let performanceFeeAmount = 0;
                    const feeRate = project.Performance_Based_Fee_Rate;
                    if (record.dailyPL !== null && record.dailyPL > 0 && feeRate !== null && feeRate !== undefined) {
                      performanceFeeAmount = record.dailyPL * (feeRate / 100);
                    }

                    let plBpsDisplay: string | number = '-';
                    if (record.dailyPL !== null && record.cumulativeBenchmarkVWAP !== null && record.cumulativeBenchmarkVWAP > 0 && record.cumulativeFilledQty !== null && record.cumulativeFilledQty > 0) {
                        const denominator = record.cumulativeBenchmarkVWAP * record.cumulativeFilledQty;
                        if (denominator !== 0) {
                           plBpsDisplay = formatNumber((record.dailyPL / denominator) * 10000, 1, '-'); 
                        }
                    }
                    return (
                      <tr key={index} className={`border-b border-gray-200 hover:bg-gray-100 ${record.vwapPerformanceBps !== null && record.vwapPerformanceBps < 0 ? 'bg-red-50' : ''}`}>
                        <td className="py-3 px-6 text-left whitespace-nowrap">{record.Date}</td>
                        <td className="py-3 px-6 text-right">{formatNumber(record.FilledQty, 0)}</td>
                        <td className="py-3 px-6 text-right">{formatNumber(record.cumulativeFilledQty, 0, '-')}</td>
                        <td className="py-3 px-6 text-right">{formatNumber(record.FilledAveragePrice, 2)}</td>
                        <td className="py-3 px-6 text-right">{formatNumber(record.ALL_DAY_VWAP, 2)}</td>
                        <td className="py-3 px-6 text-right">{formatNumber(record.cumulativeBenchmarkVWAP, 2, '-')}</td>
                        <td className="py-3 px-6 text-right">{formatNumber(record.vwapPerformanceBps, 2, '-')}</td>
                        <td className={`py-3 px-6 text-right ${record.dailyPL !== null && record.dailyPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(record.dailyPL, '-')}</td>
                        <td className={`py-3 px-6 text-right ${performanceFeeAmount > 0 ? 'text-green-600' : ''}`}>{formatCurrency(performanceFeeAmount, performanceFeeAmount === 0 && record.dailyPL !== null && record.dailyPL <=0 ? formatCurrency(0) : '-')}</td>
                        <td className="py-3 px-6 text-right">{formatCurrency(record.cumulativeFixedFee, '-')}</td>
                        <td className="py-3 px-6 text-right">{plBpsDisplay}</td>
                        <td className="py-3 px-6 text-right">{formatCurrency(record.cumulativeFilledAmount, '-')}</td>
                      </tr>);
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : ( !loading && <p className="mt-6 text-gray-500">このプロジェクトの取引履歴はありません。</p>)}
    </div>
  );
};

export default ProjectDetailPage;