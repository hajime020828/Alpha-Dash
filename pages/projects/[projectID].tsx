// pages/projects/[projectID].tsx
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
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

const ProjectDetailPage = () => {
  const router = useRouter();
  const { projectID } = router.query;
  const [data, setData] = useState<ProjectDetailApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentMarketPrice, setCurrentMarketPrice] = useState<number | null>(null);
  const [marketPriceLoading, setMarketPriceLoading] = useState<boolean>(false);
  const [marketPriceError, setMarketPriceError] = useState<string | null>(null);
  const [priceToAdjustedBenchmarkDeviation, setPriceToAdjustedBenchmarkDeviation] = useState<number | null>(null);

  useEffect(() => {
    if (projectID && typeof projectID === 'string') {
      const fetchProjectDetails = async () => {
        setLoading(true); 
        try {
          const res = await fetch(`/api/projects/${projectID}`);
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            if (res.status === 404) {
              throw new Error('Project not found');
            }
            throw new Error(`API request failed with status ${res.status}: ${errorData.message || res.statusText}`);
          }
          const fetchedData: ProjectDetailApiResponse = await res.json();
          setData(fetchedData);
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
        const fetchMarketPrice = async () => {
            setMarketPriceLoading(true);
            setMarketPriceError(null);
            setCurrentMarketPrice(null); 
            try {
                const res = await fetch(`/api/fetch-market-price?ticker=${encodeURIComponent(ticker)}`);
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({ error: "Unknown error fetching market price" }));
                    throw new Error(errorData.error || `Failed to fetch market price: ${res.statusText}`);
                }
                const priceData = await res.json();
                if (priceData.price !== undefined) { 
                    setCurrentMarketPrice(priceData.price);
                } else if (priceData.error) {
                    throw new Error(priceData.error);
                } else {
                    throw new Error("Invalid response format for market price");
                }
            } catch (e: any) {
                console.error("Failed to fetch market price for ticker:", ticker, e);
                setMarketPriceError(e.message);
                setCurrentMarketPrice(null);
            } finally {
                setMarketPriceLoading(false);
            }
        };
        fetchMarketPrice();
    }
  }, [data?.project?.Ticker]); 

  useEffect(() => {
    if (currentMarketPrice !== null && data && data.project) {
      const { benchmarkVWAP, tradedDaysCount, Side } = data.project;

      let newAdjustedBenchmark: number | null = null;

      // tradedDaysCount が undefined または null の場合、0として扱う
      const currentTradedDaysCount = tradedDaysCount || 0;
      
      // benchmarkVWAP が null の場合、過去の合計は0として扱う
      const historicalSum = (benchmarkVWAP !== null && currentTradedDaysCount > 0)
                            ? benchmarkVWAP * currentTradedDaysCount
                            : 0;

      if (currentTradedDaysCount === 0) {
        // 過去の取引がない場合、調整後ベンチマークは現在の株価そのもの
        newAdjustedBenchmark = currentMarketPrice;
      } else {
      // 過去の取引がある場合、現在の株価を加えて平均を再計算
        newAdjustedBenchmark = (historicalSum + currentMarketPrice) / (currentTradedDaysCount + 1);
      }

      if (newAdjustedBenchmark !== null && newAdjustedBenchmark !== 0) {
        let deviation: number | null = null;
        if (Side === 'SELL') {
          deviation = ((currentMarketPrice - newAdjustedBenchmark) / newAdjustedBenchmark) * 100;
        } else if (Side === 'BUY') { // BUY または未指定(デフォルトBUY扱い)
          deviation = ((newAdjustedBenchmark - currentMarketPrice) / newAdjustedBenchmark) * 100;
        }
        setPriceToAdjustedBenchmarkDeviation(deviation);
      } else {
        setPriceToAdjustedBenchmarkDeviation(null);
      }
    } else {
      setPriceToAdjustedBenchmarkDeviation(null);
    }
  }, [currentMarketPrice, data?.project]);


  if (loading && !data) return <p className="text-center text-gray-500">プロジェクト詳細を読み込み中...</p>;
  if (error) return <p className="text-center text-red-500">エラー: {error}</p>;
  if (!data || !data.project) return <p className="text-center text-gray-500">プロジェクトデータが見つかりません。</p>;

  const { project, stockRecords } = data;
  const displayStockRecords = [...stockRecords].reverse(); 

  const formatNumber = (value: number | null | undefined, fracDigits = 2, defaultVal: string = 'N/A') => {
    if (value === null || value === undefined) return defaultVal;
    if (fracDigits === 0) {
        return Math.round(value).toLocaleString('ja-JP', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }
    return value.toLocaleString('ja-JP', { 
      minimumFractionDigits: fracDigits, 
      maximumFractionDigits: fracDigits 
    });
  };
  
  const formatCurrency = (value: number | null | undefined, defaultVal: string = 'N/A') => {
    if (value === null || value === undefined) return defaultVal;
    return value.toLocaleString('ja-JP', { 
      style: 'currency', 
      currency: 'JPY', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });
  };
  
  const ProgressBarDetail = ({ progress, label, valueText, color = 'bg-blue-600', height = 'h-5' }: 
    { progress: number, label:string, valueText:string, color?: string, height?: string }) => (
    <div className="bg-white shadow-md rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-700 mb-1">{label}</h3>
        <div className={`w-full bg-gray-200 rounded-full ${height} dark:bg-gray-700 overflow-hidden my-1 relative`}>
            <div
                className={`${color} ${height} rounded-full text-xs font-medium text-white text-center p-0.5 leading-tight flex items-center justify-center`}
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            >
                {progress.toFixed(1)}%
            </div>
        </div>
        <p className="text-xs text-gray-600 mt-1 text-right">{valueText}</p>
    </div>
  );

  const chartLabelsOriginalOrder = stockRecords.map(record => record.Date);
  const chartData = {
    labels: chartLabelsOriginalOrder,
    datasets: [
      {
        type: 'line' as const,
        label: '約定平均価格',
        data: stockRecords.map(record => record.FilledAveragePrice),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        yAxisID: 'yPrice',
        tension: 0.1,
        pointRadius: 3,
      },
      {
        type: 'line' as const,
        label: '当日VWAP',
        data: stockRecords.map(record => record.ALL_DAY_VWAP),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        yAxisID: 'yPrice',
        tension: 0.1,
        pointRadius: 3,
      },
      {
        type: 'line' as const,
        label: 'ベンチマーク推移',
        data: stockRecords.map(record => record.cumulativeBenchmarkVWAP), 
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        yAxisID: 'yPrice',
        tension: 0.1,
        pointRadius: 3,
      },
      {
        type: 'bar' as const,
        label: '約定数量',
        data: stockRecords.map(record => record.FilledQty),
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgb(153, 102, 255)',
        yAxisID: 'yQuantity',
        order: 10 
      },
    ],
  };

  const chartOptions: any = { 
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 20,
        bottom: 10,
        left: 10,
        right: 10
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '価格・VWAP・ベンチマーク推移と約定数量',
        font: { size: 16 },
        padding: {
            bottom: 20
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '日付',
        },
      },
      yPrice: { 
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: '価格',
        },
        grid: {
            drawOnChartArea: true,
        },
        ticks: {
          callback: function(value: string | number) {
            if (typeof value === 'number') {
              return formatNumber(value, 0);
            }
            return value;
          }
        },
        grace: '5%',
      },
      yQuantity: { 
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: '約定数量 (株)',
        },
        grid: {
          drawOnChartArea: false, 
        },
        ticks: {
          callback: function(value: string | number) {
            if (typeof value === 'number') {
              return formatNumber(value, 0); 
            }
            return value;
          }
        },
        min: 0,
        grace: '10%',
      },
    },
    interaction: {
      mode: 'index' as const, 
      axis: 'x' as const,
      intersect: false
    }
  };

  let remainingShares: number | null = null;
  if (typeof project.Total_Shares === 'number') {
    remainingShares = Math.max(0, project.Total_Shares - (project.totalFilledQty || 0));
  }

  let daysUntilEarliest: number | null = null;
  const tradedDays = project.tradedDaysCount || 0;
  if (typeof project.Earliest_Day_Count === 'number') {
    const diff = project.Earliest_Day_Count - tradedDays;
    daysUntilEarliest = diff;
  }

  let remainingBusinessDays: number | null = null;
  if (typeof project.Business_Days === 'number') {
    const diff = project.Business_Days - tradedDays;
    remainingBusinessDays = diff;
  }

  let maxSharesPerDayText: string = 'N/A';
  if (remainingShares !== null) {
    if (remainingShares === 0) {
      maxSharesPerDayText = '0 株/日';
    } else if (daysUntilEarliest !== null && daysUntilEarliest > 0) {
      const maxShares = remainingShares / daysUntilEarliest;
      maxSharesPerDayText = formatNumber(maxShares, 0) + ' 株/日';
    } else if (daysUntilEarliest !== null && daysUntilEarliest <= 0) {
      maxSharesPerDayText = '最短期限超過';
    }
  }
  
  let minSharesPerDayText: string = 'N/A';
  if (remainingShares !== null) {
    if (remainingShares === 0) {
      minSharesPerDayText = '0 株/日';
    } else if (remainingBusinessDays !== null && remainingBusinessDays > 0) {
      const minShares = remainingShares / remainingBusinessDays;
      minSharesPerDayText = formatNumber(minShares, 0) + ' 株/日';
    } else if (remainingBusinessDays !== null && remainingBusinessDays <= 0) {
      minSharesPerDayText = '残日数なし';
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          プロジェクト詳細: {project.Name} ({project.ProjectID || `Internal ID: ${project.internal_id}`})
        </h1>
        <div className="text-right">
          <p className="text-sm text-gray-600">TS担当者:</p>
          <p className="text-lg font-semibold text-gray-700">{project.TS_Contact || 'N/A'}</p>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
         <h2 className="text-xl font-semibold mb-4 text-gray-700">基本情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <p><strong>銘柄コード:</strong> {project.Ticker}</p>
          <p><strong>銘柄名:</strong> {project.Name}</p>
          <p><strong>Side:</strong>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold
              ${project.Side === 'BUY' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
              {project.Side}
            </span>
          </p>
          {project.Side === 'SELL' ? (
            <p><strong>総株数:</strong> {formatNumber(project.Total_Shares, 0) ?? 'N/A'} 株</p>
          ) : (
            <p><strong>総金額:</strong> {formatCurrency(project.Total_Amount) ?? 'N/A'}</p>
          )}
          <p><strong>開始日:</strong> {project.Start_Date}</p>
          <p><strong>終了日:</strong> {project.End_Date}</p>
          <p><strong>価格制限:</strong> {formatNumber(project.Price_Limit, 0) ?? 'N/A'}</p>
          <p><strong>業績連動手数料率:</strong> {project.Performance_Based_Fee_Rate ?? 'N/A'}%</p>
          <p><strong>固定手数料率:</strong> {project.Fixed_Fee_Rate ?? 'N/A'}%</p>
          <p><strong>営業日数 (Business Days):</strong> {project.Business_Days ?? 'N/A'}</p>
          <p><strong>最短日数カウント:</strong> {project.Earliest_Day_Count ?? 'N/A'}</p>
          <p><strong>除外日数:</strong> {formatNumber(project.Excluded_Days, 0) ?? 'N/A'}</p> 
          <p><strong>最大株数/日:</strong> {maxSharesPerDayText}</p>
          <p><strong>最小株数/日:</strong> {minSharesPerDayText}</p>
          <p><strong>現在の株価:</strong> 
            {marketPriceLoading ? <span className="text-gray-500">読み込み中...</span> : 
             currentMarketPrice !== null ? formatNumber(currentMarketPrice, 2) : 
             marketPriceError ? <span className="text-red-500">エラー ({marketPriceError})</span> : 'N/A'}
          </p>
          <p><strong>対調整後ベンチマーク乖離率:</strong>
            {marketPriceLoading ? <span className="text-xs text-gray-500">計算中...</span> :
             currentMarketPrice === null ? <span className="text-xs text-gray-500">株価未取得</span> :
             priceToAdjustedBenchmarkDeviation === null ? <span className="text-xs text-gray-500">計算不可</span> :
             <span className={`font-semibold ${priceToAdjustedBenchmarkDeviation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
               {formatNumber(priceToAdjustedBenchmarkDeviation, 2)} %
             </span>
            }
          </p>
          <p className="md:col-span-2"><strong>メモ:</strong> {project.Note || 'N/A'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProgressBarDetail
            label="経過日数進捗"
            progress={project.daysProgress}
            valueText={`(取引 ${project.tradedDaysCount || 0}日 / 全 ${project.Business_Days || 'N/A'}営業日)`}
            color="bg-sky-500"
        />
        <ProgressBarDetail
            label="約定進捗"
            progress={project.executionProgress}
            valueText={
                project.Side === 'SELL' ? 
                `(${formatNumber(project.totalFilledQty,0)} / ${formatNumber(project.Total_Shares,0) || 'N/A'} 株)` :
                `(${formatCurrency(project.totalFilledAmount)} / ${formatCurrency(project.Total_Amount)})`
            }
            color={project.Side === 'BUY' ? 'bg-green-500' : 'bg-red-500'}
        />
      </div>

      <div className="bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">パフォーマンス指標</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-center"> 
          <div>
            <p className="text-sm text-gray-500">ベンチマーク VWAP</p>
            <p className="text-2xl font-semibold text-indigo-600">
              {formatNumber(project.benchmarkVWAP)} 
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">平均約定単価</p>
            <p className="text-2xl font-semibold text-teal-600">
              {formatNumber(project.averageExecutionPrice)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">平均約定株数/日</p>
            <p className="text-2xl font-semibold text-amber-600">
              {formatNumber(project.averageDailyShares, 0)} 株
            </p>
          </div>
        </div>
        {project.tradedDaysCount && project.tradedDaysCount > 0 ? (
            <p className="text-xs text-gray-500 mt-3 text-center">
                ※ 日次平均指標は取引のあった {project.tradedDaysCount} 日間の平均です。
            </p>
        ) : (
            <p className="text-xs text-gray-500 mt-3 text-center">
                ※ 取引記録がないため、一部指標は計算できません。
            </p>
        )}
      </div>
      
      {stockRecords && stockRecords.length > 0 && (
        <div className="bg-white shadow-md rounded-lg p-4 md:p-6">
          <div style={{ height: '400px' }}> 
            <Chart type='line' data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {stockRecords && stockRecords.length > 0 ? (
        <div className="bg-white shadow-md rounded-lg">
          <h2 className="text-xl font-semibold p-6 text-gray-700 border-b">取引履歴</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full leading-normal">
              <thead>
                <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                  <th className="py-3 px-6 text-left">日付</th>
                  <th className="py-3 px-6 text-right">約定数量</th>
                  <th className="py-3 px-6 text-right">累積約定株数</th>
                  <th className="py-3 px-6 text-right">約定平均価格</th>
                  <th className="py-3 px-6 text-right">当日VWAP</th>
                  <th className="py-3 px-6 text-right">ベンチマーク推移</th>
                  <th className="py-3 px-6 text-right">VWAP Perf. (%)</th>
                  <th className="py-3 px-6 text-right">P/L (評価損益)</th>
                  <th className="py-3 px-6 text-right">累積約定金額(円)</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 text-sm">
                {displayStockRecords.map((record, index) => (
                  <tr key={index} className={`border-b border-gray-200 hover:bg-gray-100 ${
                    record.vwapPerformanceBps !== null && record.vwapPerformanceBps < 0 ? 'bg-red-50' : 
                    record.vwapPerformanceBps !== null && record.vwapPerformanceBps > 0 ? 'bg-green-50' : ''
                  }`}>
                    <td className="py-3 px-6 text-left whitespace-nowrap">{record.Date}</td>
                    <td className="py-3 px-6 text-right">{formatNumber(record.FilledQty, 0)}</td>
                    <td className="py-3 px-6 text-right">{formatNumber(record.cumulativeFilledQty, 0, '-')}</td>
                    <td className="py-3 px-6 text-right">{formatNumber(record.FilledAveragePrice, 2)}</td>
                    <td className="py-3 px-6 text-right">{formatNumber(record.ALL_DAY_VWAP, 2)}</td>
                    <td className="py-3 px-6 text-right">
                      {formatNumber(record.cumulativeBenchmarkVWAP, 2, '-')}
                    </td>
                    <td className="py-3 px-6 text-right">
                      {record.vwapPerformanceBps !== null && record.vwapPerformanceBps !== undefined 
                        ? `${formatNumber(record.vwapPerformanceBps / 100, 2, '-')} %` 
                        : '-'}
                    </td>
                    <td className={`py-3 px-6 text-right ${record.dailyPL !== null && record.dailyPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(record.dailyPL, '-')}
                    </td>
                    <td className="py-3 px-6 text-right">
                      {formatCurrency(record.cumulativeFilledAmount, '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-gray-500">このプロジェクトの取引履歴はありません。</p>
      )}
    </div>
  );
};

export default ProjectDetailPage;