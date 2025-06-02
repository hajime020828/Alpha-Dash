// pages/api/db/stock_records.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, StockRecord } from '@/lib/db';

interface StockRecordForDisplay extends Pick<StockRecord, 'StockCycle' | 'ProjectID' | 'FilledQty' | 'FilledAveragePrice' | 'ALL_DAY_VWAP' | 'Date'> {
  // rowid?: number;
}

// API応答用に、挿入成功時に返すデータの型 (基本フィールドのみ)
interface InsertedStockRecord extends StockRecordForDisplay {
  // 必要であればROWIDも返す
  // rowid: number;
}


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StockRecordForDisplay[] | InsertedStockRecord | { message: string } | { error: string }>
) {
  const db = await getDb();

  if (req.method === 'GET') {
    try {
      const records = await db.all<StockRecordForDisplay[]>(
        'SELECT StockCycle, ProjectID, FilledQty, FilledAveragePrice, ALL_DAY_VWAP, Date FROM stock_records ORDER BY Date DESC, ProjectID ASC'
      );
      res.status(200).json(records);
    } catch (error: any) {
      console.error('Failed to fetch stock_records table:', error);
      res.status(500).json({ message: `Failed to fetch stock_records table: ${error.message}` });
    }
  } else if (req.method === 'POST') {
    try {
      const {
        StockCycle, ProjectID, FilledQty, FilledAveragePrice, ALL_DAY_VWAP, Date
      }: StockRecordForDisplay = req.body;

      // 簡単なバリデーション
      if (!ProjectID || !Date || FilledQty === undefined || FilledAveragePrice === undefined || ALL_DAY_VWAP === undefined) {
        return res.status(400).json({ error: 'Missing required fields for stock record' });
      }
      
      const stmt = await db.prepare(
        `INSERT INTO stock_records (
          StockCycle, ProjectID, FilledQty, FilledAveragePrice, ALL_DAY_VWAP, Date
        ) VALUES (?, ?, ?, ?, ?, ?)`
      );
      
      // データベースのスキーマに合わせて型変換
      const result = await stmt.run(
        StockCycle || null,
        ProjectID,
        Number(FilledQty),
        Number(FilledAveragePrice),
        Number(ALL_DAY_VWAP),
        Date
      );
      await stmt.finalize();

      // SQLiteでは lastID はROWIDを返す。複合主キーの場合、挿入された行を特定するには別の方法が必要になる場合がある。
      // ここでは単純化のため、リクエストされたデータで新しいオブジェクトを返す。
      if (result.changes && result.changes > 0) {
         const insertedRecord: InsertedStockRecord = {
            StockCycle: StockCycle || '', // DBでNULL許容でもフロントで表示するなら空文字など
            ProjectID,
            FilledQty: Number(FilledQty),
            FilledAveragePrice: Number(FilledAveragePrice),
            ALL_DAY_VWAP: Number(ALL_DAY_VWAP),
            Date
        };
        res.status(201).json(insertedRecord);
      } else {
        res.status(500).json({ message: 'Failed to insert stock record, no changes detected' });
      }

    } catch (error: any) {
      console.error('Failed to insert stock record:', error);
      res.status(500).json({ message: `Failed to insert stock record: ${error.message}` });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}