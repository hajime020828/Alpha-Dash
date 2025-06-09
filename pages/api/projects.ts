// pages/api/projects.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, Project, ProjectWithProgress } from '@/lib/db';

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
      }

      let executionProgress = 0;
      const currentTotalFilledQty = projectStockData?.totalFilledQty || 0;
      const currentTotalFilledAmount = projectStockData?.totalFilledAmount || 0;

      // ▼▼▼ ここから変更箇所 ▼▼▼
      // 総株数が設定されていれば、それを基準に計算
      if (p.Total_Shares !== null && p.Total_Shares > 0) {
          executionProgress = (currentTotalFilledQty / p.Total_Shares) * 100;
      } 
      // 総株数がなく、総金額が設定されていれば、それを基準に計算
      else if (p.Total_Amount !== null && p.Total_Amount > 0) {
          executionProgress = (currentTotalFilledAmount / p.Total_Amount) * 100;
      }
      // ▲▲▲ ここまで変更箇所 ▲▲▲
      
      return {
        ...p,
        daysProgress: Math.min(100, Math.max(0, daysProgress)),
        executionProgress: Math.min(100, Math.max(0, executionProgress)),
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