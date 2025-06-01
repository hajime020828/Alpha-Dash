// pages/api/projects.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, Project, ProjectWithProgress } from '@/lib/db'; // Path alias を使用

interface AggregatedStockData {
  ProjectID: string;
  totalFilledQty: number | null;
  totalFilledAmount: number | null;
  tradedDaysCount: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProjectWithProgress[] | { message: string }>
) {
  try {
    const db = await getDb();
    const projects = await db.all<Project[]>('SELECT * FROM projects');

    const aggregatedStockDataArray = await db.all<AggregatedStockData[]>(`
      SELECT
        ProjectID,
        SUM(FilledQty) as totalFilledQty,
        SUM(FilledQty * FilledAveragePrice) as totalFilledAmount,
        COUNT(DISTINCT Date) as tradedDaysCount 
      FROM stock_records
      GROUP BY ProjectID
    `);

    const stockDataMap = new Map<string, AggregatedStockData>();
    aggregatedStockDataArray.forEach(record => {
      if (record.ProjectID) {
        stockDataMap.set(record.ProjectID, record);
      }
    });

    const projectsWithProgress: ProjectWithProgress[] = projects.map(p => {
      const projectStockData = p.ProjectID ? stockDataMap.get(p.ProjectID) : undefined;
      
      const currentTradedDaysCount = projectStockData?.tradedDaysCount || 0;
      let daysProgress = 0;
      if (p.Business_Days && p.Business_Days > 0) {
        daysProgress = (currentTradedDaysCount / p.Business_Days) * 100;
        daysProgress = Math.min(100, daysProgress); 
      }

      let executionProgress = 0;
      let currentTotalFilledQty: number | undefined = undefined;
      let currentTotalFilledAmount: number | undefined = undefined;

      if (projectStockData) {
        currentTotalFilledQty = projectStockData.totalFilledQty || 0; 
        currentTotalFilledAmount = projectStockData.totalFilledAmount || 0;

        if (p.Side === 'SELL' && p.Total_Shares && p.Total_Shares > 0) {
          executionProgress = (currentTotalFilledQty / p.Total_Shares) * 100;
        } else if (p.Side === 'BUY' && p.Total_Amount && p.Total_Amount > 0) {
          executionProgress = (currentTotalFilledAmount / p.Total_Amount) * 100;
        }
      }
      
      return {
        ...p,
        daysProgress: parseFloat(daysProgress.toFixed(2)),
        executionProgress: parseFloat(executionProgress.toFixed(2)),
        totalFilledQty: currentTotalFilledQty,
        totalFilledAmount: currentTotalFilledAmount,
        tradedDaysCount: currentTradedDaysCount,
        benchmarkVWAP: null, 
        averageExecutionPrice: null,
        averageDailyShares: null,
      };
    });

    res.status(200).json(projectsWithProgress);
  } catch (error) {
    console.error('Error fetching projects with progress:', error);
    res.status(500).json({ message: 'Error fetching projects with progress' });
  }
}