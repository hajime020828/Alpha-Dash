// lib/db.ts
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function getDb() {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'VWAP_Alpha.db');
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  }
  return db;
}

export interface Project {
  internal_id: number;
  ProjectID: string | null;
  Ticker: string;
  Name: string;
  Side: 'BUY' | 'SELL';
  Total_Shares: number | null;
  Total_Amount: number | null;
  Start_Date: string;
  End_Date: string;
  Price_Limit: number | null;
  Performance_Based_Fee_Rate: number | null;
  Fixed_Fee_Rate: number | null;
  Business_Days: number | null;
  Earliest_Day_Count: number | null;
  Excluded_Days: number | null;
  Note: string | null;
  TS_Contact: string;
}

export interface StockRecord {
  StockCycle: string;
  ProjectID: string;
  FilledQty: number; 
  FilledAveragePrice: number;
  ALL_DAY_VWAP: number; // 当日VWAP
  Date: string; 
  cumulativeBenchmarkVWAP: number | null; // プロジェクト期間の平均VWAPの推移 (P/L計算に使用)
  vwapPerformanceBps: number | null;
  cumulativeFilledAmount: number | null; 
  cumulativeFilledQty: number | null; 
  dailyPL: number | null; // 日次評価P/L (ベンチマークとして cumulativeBenchmarkVWAP を使用)
  cumulativeFixedFee: number | null; // 累積の固定手数料
}

export interface ProjectWithProgress extends Project {
  daysProgress: number;
  executionProgress: number;
  totalFilledQty?: number; 
  totalFilledAmount?: number; 
  tradedDaysCount?: number;
  benchmarkVWAP: number | null; // パフォーマンス指標に表示するプロジェクト全体のベンチマークVWAP
  averageExecutionPrice: number | null;
  averageDailyShares: number | null;
}

export interface ProjectDetailApiResponse {
  project: ProjectWithProgress | undefined;
  stockRecords: StockRecord[];
  // ▼▼▼ ここから変更箇所 ▼▼▼
  finalPL: number | null;
  finalPerformanceFee: number | null;
  finalFixedFee: number | null;
  finalPLBps: number | null;
  // ▲▲▲ ここまで変更箇所 ▲▲▲
}

export interface ProjectDetailApiResponse {
  project: ProjectWithProgress | undefined;
  stockRecords: StockRecord[]; 
}