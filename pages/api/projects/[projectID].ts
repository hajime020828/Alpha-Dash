// pages/api/projects/[projectID].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, Project, StockRecord, ProjectWithProgress, ProjectDetailApiResponse } from '@/lib/db'; //

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

    let rawStockRecords: Omit<StockRecord, 'cumulativeBenchmarkVWAP' | 'vwapPerformanceBps' | 'cumulativeFilledAmount' | 'cumulativeFilledQty' | 'dailyPL'>[] = [];
    if (projectData.ProjectID) {
      // データベースからはひとまず取得
      rawStockRecords = await db.all<Omit<StockRecord, 'cumulativeBenchmarkVWAP' | 'vwapPerformanceBps' | 'cumulativeFilledAmount' | 'cumulativeFilledQty' | 'dailyPL'>[]>(
        'SELECT * FROM stock_records WHERE ProjectID = ?', // ORDER BY は削除またはDBの日付型に合わせて調整
        projectData.ProjectID
      );

      // JavaScript側で日付オブジェクトに変換してソート (YYYY/MM/DD 形式を想定)
      rawStockRecords.sort((a, b) => {
        // 日付文字列を Date オブジェクトが解釈しやすいように '-' 区切りに置換
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

    const processedStockRecords: StockRecord[] = rawStockRecords.map(rawRecord => {
      const recordFilledQty = typeof rawRecord.FilledQty === 'number' ? rawRecord.FilledQty : null;
      const recordFilledAveragePrice = typeof rawRecord.FilledAveragePrice === 'number' ? rawRecord.FilledAveragePrice : null;
      const recordAllDayVWAP = typeof rawRecord.ALL_DAY_VWAP === 'number' ? rawRecord.ALL_DAY_VWAP : null;
      const recordDate = rawRecord.Date || '';
      const recordStockCycle = rawRecord.StockCycle || '';
      const recordProjectID = rawRecord.ProjectID || '';

      if (!distinctDailyVWAPsEncountered.has(recordDate) && recordAllDayVWAP !== null) {
        distinctDailyVWAPsEncountered.set(recordDate, recordAllDayVWAP);
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
      const recordCumulativeFilledQty = currentCumulativeFilledQty;
      const recordCumulativeFilledAmount = currentCumulativeFilledAmount;

      let dailyPL: number | null = null;
      if (currentProjectBenchmarkVWAP != null && 
          recordCumulativeFilledQty > 0 && 
          recordCumulativeFilledAmount != null &&
          (projectData.Side === 'BUY' || projectData.Side === 'SELL') ) {
        if (projectData.Side === 'BUY') {
          dailyPL = (currentProjectBenchmarkVWAP * recordCumulativeFilledQty) - recordCumulativeFilledAmount;
        } else { 
          dailyPL = recordCumulativeFilledAmount - (currentProjectBenchmarkVWAP * recordCumulativeFilledQty);
        }
      } else if (recordCumulativeFilledQty === 0) {
          dailyPL = 0;
      }

      return {
        StockCycle: recordStockCycle,
        ProjectID: recordProjectID,
        FilledQty: recordFilledQty !== null ? recordFilledQty : 0,
        FilledAveragePrice: recordFilledAveragePrice !== null ? recordFilledAveragePrice : 0,
        ALL_DAY_VWAP: recordAllDayVWAP !== null ? recordAllDayVWAP : 0,
        Date: recordDate,
        cumulativeBenchmarkVWAP: currentProjectBenchmarkVWAP,
        vwapPerformanceBps: vwapPerfBps,
        cumulativeFilledAmount: recordCumulativeFilledAmount,
        cumulativeFilledQty: recordCumulativeFilledQty,
        dailyPL: dailyPL,
      } as StockRecord;
    });

    const finalTotalProjectFilledQty = currentCumulativeFilledQty;
    const finalTotalProjectFilledAmount = currentCumulativeFilledAmount;

    let daysProgress = 0;
    const currentTradedDaysCount = distinctDailyVWAPsEncountered.size;
    if (projectData.Business_Days && projectData.Business_Days > 0) {
        daysProgress = (currentTradedDaysCount / projectData.Business_Days) * 100;
        daysProgress = Math.min(100, Math.max(0, daysProgress));
    }

    let executionProgress = 0;
    if (processedStockRecords.length > 0) {
      if (projectData.Side === 'SELL' && projectData.Total_Shares && projectData.Total_Shares > 0) {
        executionProgress = (finalTotalProjectFilledQty / projectData.Total_Shares) * 100;
      } else if (projectData.Side === 'BUY' && projectData.Total_Amount && projectData.Total_Amount > 0) {
        executionProgress = (finalTotalProjectFilledAmount / projectData.Total_Amount) * 100;
      }
      executionProgress = Math.min(100, Math.max(0, executionProgress));
    }
    
    const overallProjectBenchmarkVWAPToDisplay = (countOfDistinctDaysForBenchmark > 0)
        ? (sumOfDistinctVWAPsForBenchmark / countOfDistinctDaysForBenchmark)
        : null;

    let averageExecutionPrice: number | null = null;
    if (finalTotalProjectFilledQty > 0 && finalTotalProjectFilledAmount !== null) { 
        averageExecutionPrice = finalTotalProjectFilledAmount / finalTotalProjectFilledQty;
    }
    let averageDailyShares: number | null = null;
    if (currentTradedDaysCount > 0 && finalTotalProjectFilledQty !== null) {
        averageDailyShares = finalTotalProjectFilledQty / currentTradedDaysCount;
    }

    const projectWithProgressData: ProjectWithProgress = {
      ...projectData,
      daysProgress: parseFloat(daysProgress.toFixed(2)),
      executionProgress: parseFloat(executionProgress.toFixed(2)),
      totalFilledQty: finalTotalProjectFilledQty,
      totalFilledAmount: finalTotalProjectFilledAmount,
      tradedDaysCount: currentTradedDaysCount,
      benchmarkVWAP: overallProjectBenchmarkVWAPToDisplay,
      averageExecutionPrice: averageExecutionPrice,
      averageDailyShares: averageDailyShares,
    };
    
    res.status(200).json({ project: projectWithProgressData, stockRecords: processedStockRecords });

  } catch (error) {
    console.error(`Error fetching project details for ${projectID}:`, error);
    res.status(500).json({ message: 'Error fetching project details' });
  }
}