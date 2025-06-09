// pages/api/projects/[projectID].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, Project, StockRecord, ProjectWithProgress, ProjectDetailApiResponse } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProjectDetailApiResponse | { message: string }>
) {
  const { projectID } = req.query;

  if (typeof projectID !== 'string') {
    res.status(400).json({ message: 'Invalid ProjectID' });
    return;
  }

  try {
    const db = await getDb();
    const projectData = await db.get<Project>(
      'SELECT * FROM projects WHERE ProjectID = ?',
      projectID
    );

    if (!projectData) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    let rawStockRecords: Omit<StockRecord, 'cumulativeBenchmarkVWAP' | 'vwapPerformanceBps' | 'cumulativeFilledAmount' | 'cumulativeFilledQty' | 'dailyPL' | 'cumulativeFixedFee'>[] = [];
    if (projectData.ProjectID) {
      rawStockRecords = await db.all<any[]>(
        'SELECT * FROM stock_records WHERE ProjectID = ?',
        projectData.ProjectID
      );

      rawStockRecords.sort((a, b) => {
        const dateA = new Date(a.Date.replace(/\//g, '-'));
        const dateB = new Date(b.Date.replace(/\//g, '-'));
        return dateA.getTime() - dateB.getTime();
      });
    }
    
    const distinctDailyVWAPsEncountered = new Map<string, number>();
    let sumOfDistinctVWAPsForBenchmark = 0;
    let countOfDistinctDaysForBenchmark = 0;
    let currentCumulativeFilledAmount = 0;
    let currentCumulativeFilledQty = 0;
    let currentCumulativeFixedFee = 0;
    const fixedFeeRate = projectData.Fixed_Fee_Rate;


    const processedStockRecords: StockRecord[] = rawStockRecords.map(rawRecord => {
      const recordFilledQty = typeof rawRecord.FilledQty === 'number' ? rawRecord.FilledQty : null;
      const recordFilledAveragePrice = typeof rawRecord.FilledAveragePrice === 'number' ? rawRecord.FilledAveragePrice : null;
      const recordAllDayVWAP = typeof rawRecord.ALL_DAY_VWAP === 'number' ? rawRecord.ALL_DAY_VWAP : null;
      
      if (!distinctDailyVWAPsEncountered.has(rawRecord.Date) && recordAllDayVWAP !== null) {
        distinctDailyVWAPsEncountered.set(rawRecord.Date, recordAllDayVWAP);
        sumOfDistinctVWAPsForBenchmark += recordAllDayVWAP;
        countOfDistinctDaysForBenchmark++;
      }
      const currentProjectBenchmarkVWAP = (countOfDistinctDaysForBenchmark > 0) 
        ? (sumOfDistinctVWAPsForBenchmark / countOfDistinctDaysForBenchmark)
        : null;

      let vwapPerfBps: number | null = null;
      if (recordFilledAveragePrice != null && recordAllDayVWAP != null && recordAllDayVWAP !== 0) {
        if (projectData.Side === 'BUY') {
          vwapPerfBps = ((recordAllDayVWAP - recordFilledAveragePrice) / recordAllDayVWAP) * 10000;
        } else if (projectData.Side === 'SELL') {
          vwapPerfBps = ((recordFilledAveragePrice - recordAllDayVWAP) / recordAllDayVWAP) * 10000;
        }
      }
      
      let dailyFilledAmount = 0;
      if (recordFilledQty != null && recordFilledAveragePrice != null) {
        dailyFilledAmount = recordFilledQty * recordFilledAveragePrice;
      }
      currentCumulativeFilledAmount += dailyFilledAmount; 

      if (recordFilledQty != null) {
        currentCumulativeFilledQty += recordFilledQty;
      }

      let dailyFixedFee = 0;
      if (fixedFeeRate !== null && fixedFeeRate > 0 && dailyFilledAmount > 0) {
          dailyFixedFee = dailyFilledAmount * (fixedFeeRate / 100);
      }
      currentCumulativeFixedFee += dailyFixedFee;

      let dailyPL: number | null = null;
      if (currentProjectBenchmarkVWAP != null && 
          currentCumulativeFilledQty > 0 && 
          currentCumulativeFilledAmount != null &&
          (projectData.Side === 'BUY' || projectData.Side === 'SELL') ) {
        if (projectData.Side === 'BUY') {
          dailyPL = (currentProjectBenchmarkVWAP * currentCumulativeFilledQty) - currentCumulativeFilledAmount;
        } else { 
          dailyPL = currentCumulativeFilledAmount - (currentProjectBenchmarkVWAP * currentCumulativeFilledQty);
        }
      } else if (currentCumulativeFilledQty === 0) {
          dailyPL = 0;
      }

      return {
        ...rawRecord,
        FilledQty: recordFilledQty ?? 0,
        FilledAveragePrice: recordFilledAveragePrice ?? 0,
        ALL_DAY_VWAP: recordAllDayVWAP ?? 0,
        cumulativeBenchmarkVWAP: currentProjectBenchmarkVWAP,
        vwapPerformanceBps: vwapPerfBps,
        cumulativeFilledAmount: currentCumulativeFilledAmount,
        cumulativeFilledQty: currentCumulativeFilledQty,
        dailyPL: dailyPL,
        cumulativeFixedFee: currentCumulativeFixedFee > 0 ? currentCumulativeFixedFee : null,
      } as StockRecord;
    });

    const finalTotalProjectFilledQty = currentCumulativeFilledQty;
    const finalTotalProjectFilledAmount = currentCumulativeFilledAmount;
    const overallProjectBenchmarkVWAPToDisplay = (countOfDistinctDaysForBenchmark > 0)
        ? (sumOfDistinctVWAPsForBenchmark / countOfDistinctDaysForBenchmark)
        : null;

    // ▼▼▼ ここから変更箇所 ▼▼▼
    // プロジェクト全体の最終損益・手数料を計算
    let finalPL: number | null = null;
    if (overallProjectBenchmarkVWAPToDisplay !== null && finalTotalProjectFilledQty > 0) {
        if (projectData.Side === 'BUY') {
            finalPL = (overallProjectBenchmarkVWAPToDisplay * finalTotalProjectFilledQty) - finalTotalProjectFilledAmount;
        } else { // SELL
            finalPL = finalTotalProjectFilledAmount - (overallProjectBenchmarkVWAPToDisplay * finalTotalProjectFilledQty);
        }
    }

    let finalPerformanceFee: number | null = null;
    const perfFeeRate = projectData.Performance_Based_Fee_Rate;
    if (finalPL !== null && finalPL > 0 && perfFeeRate !== null) {
        finalPerformanceFee = finalPL * (perfFeeRate / 100);
    }
    
    const finalFixedFee = currentCumulativeFixedFee > 0 ? currentCumulativeFixedFee : null;

    let finalPLBps: number | null = null;
    if (finalPL !== null && overallProjectBenchmarkVWAPToDisplay !== null && overallProjectBenchmarkVWAPToDisplay > 0 && finalTotalProjectFilledQty > 0) {
        const denominator = overallProjectBenchmarkVWAPToDisplay * finalTotalProjectFilledQty;
        if(denominator !== 0) finalPLBps = (finalPL / denominator) * 10000;
    }
    // ▲▲▲ ここまで変更箇所 ▲▲▲


    let daysProgress = 0;
    const currentTradedDaysCount = distinctDailyVWAPsEncountered.size;
    if (projectData.Business_Days && projectData.Business_Days > 0) {
        daysProgress = (currentTradedDaysCount / projectData.Business_Days) * 100;
    }

    let executionProgress = 0;
    if (projectData.Total_Shares !== null && projectData.Total_Shares > 0) {
      executionProgress = (finalTotalProjectFilledQty / projectData.Total_Shares) * 100;
    } 
    else if (projectData.Total_Amount !== null && projectData.Total_Amount > 0) {
      executionProgress = (finalTotalProjectFilledAmount / projectData.Total_Amount) * 100;
    }
    
    let averageExecutionPrice: number | null = null;
    if (finalTotalProjectFilledQty > 0) { 
        averageExecutionPrice = finalTotalProjectFilledAmount / finalTotalProjectFilledQty;
    }
    let averageDailyShares: number | null = null;
    if (currentTradedDaysCount > 0) {
        averageDailyShares = finalTotalProjectFilledQty / currentTradedDaysCount;
    }

    const projectWithProgressData: ProjectWithProgress = {
      ...projectData,
      daysProgress: Math.min(100, Math.max(0, daysProgress)),
      executionProgress: Math.min(100, Math.max(0, executionProgress)),
      totalFilledQty: finalTotalProjectFilledQty,
      totalFilledAmount: finalTotalProjectFilledAmount,
      tradedDaysCount: currentTradedDaysCount,
      benchmarkVWAP: overallProjectBenchmarkVWAPToDisplay,
      averageExecutionPrice: averageExecutionPrice,
      averageDailyShares: averageDailyShares,
    };
    
    res.status(200).json({ 
        project: projectWithProgressData, 
        stockRecords: processedStockRecords,
        finalPL,
        finalPerformanceFee,
        finalFixedFee,
        finalPLBps 
    });

  } catch (error) {
    console.error(`Error fetching project details for ${projectID}:`, error);
    res.status(500).json({ message: 'Error fetching project details' });
  }
}