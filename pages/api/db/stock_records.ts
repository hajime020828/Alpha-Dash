// pages/api/db/stock_records.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, StockRecord } from '@/lib/db'; //

interface StockRecordForApi extends Pick<StockRecord, 'StockCycle' | 'ProjectID' | 'FilledQty' | 'FilledAveragePrice' | 'ALL_DAY_VWAP' | 'Date'> {
  rowid?: number; // ROWIDをAPIインターフェースに追加
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StockRecordForApi[] | StockRecordForApi | { message: string } | { error: string }>
) {
  const db = await getDb();

  if (req.method === 'GET') {
    try {
      // ROWIDも一緒に取得するように変更
      const records = await db.all<StockRecordForApi[]>(
        'SELECT ROWID as rowid, StockCycle, ProjectID, FilledQty, FilledAveragePrice, ALL_DAY_VWAP, Date FROM stock_records ORDER BY Date DESC, ProjectID ASC'
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
      }: StockRecordForApi = req.body;

      if (!ProjectID || !Date || FilledQty === undefined || FilledAveragePrice === undefined || ALL_DAY_VWAP === undefined) {
        return res.status(400).json({ error: 'Missing required fields for stock record' });
      }
      
      const stmt = await db.prepare(
        `INSERT INTO stock_records (
          StockCycle, ProjectID, FilledQty, FilledAveragePrice, ALL_DAY_VWAP, Date
        ) VALUES (?, ?, ?, ?, ?, ?)`
      );
      
      const result = await stmt.run(
        StockCycle || null, ProjectID, Number(FilledQty), Number(FilledAveragePrice), Number(ALL_DAY_VWAP), Date
      );
      await stmt.finalize();

      if (result.lastID) { // lastIDはROWIDを返す
         const newRecord = await db.get<StockRecordForApi>(
           'SELECT ROWID as rowid, StockCycle, ProjectID, FilledQty, FilledAveragePrice, ALL_DAY_VWAP, Date FROM stock_records WHERE ROWID = ?',
           result.lastID
          );
        if (newRecord) {
            res.status(201).json(newRecord);
        } else {
            res.status(500).json({ message: 'Failed to retrieve the newly inserted stock record.'})
        }
      } else {
        res.status(500).json({ message: 'Failed to insert stock record, no lastID returned' });
      }
    } catch (error: any) {
      console.error('Failed to insert stock record:', error);
      res.status(500).json({ message: `Failed to insert stock record: ${error.message}` });
    }
  } else if (req.method === 'PUT') {
    try {
        const {
            rowid, StockCycle, ProjectID, FilledQty, FilledAveragePrice, ALL_DAY_VWAP, Date
        }: StockRecordForApi = req.body;

        if (rowid === undefined) {
            return res.status(400).json({ error: 'rowid is required for updating stock record.' });
        }
        if (!ProjectID || !Date || FilledQty === undefined || FilledAveragePrice === undefined || ALL_DAY_VWAP === undefined) {
            return res.status(400).json({ error: 'Missing required fields for stock record update.' });
        }

        const stmt = await db.prepare(
            `UPDATE stock_records SET
                StockCycle = ?, ProjectID = ?, FilledQty = ?, FilledAveragePrice = ?, ALL_DAY_VWAP = ?, Date = ?
             WHERE ROWID = ?`
        );
        await stmt.run(
            StockCycle || null, ProjectID, Number(FilledQty), Number(FilledAveragePrice), 
            Number(ALL_DAY_VWAP), Date, rowid
        );
        await stmt.finalize();

        const updatedRecord = await db.get<StockRecordForApi>(
          'SELECT ROWID as rowid, StockCycle, ProjectID, FilledQty, FilledAveragePrice, ALL_DAY_VWAP, Date FROM stock_records WHERE ROWID = ?',
           rowid
        );
        if (updatedRecord) {
            res.status(200).json(updatedRecord);
        } else {
            res.status(404).json({ message: `Stock record with rowid ${rowid} not found after update.`})
        }
    } catch (error: any) {
        console.error('Failed to update stock record:', error);
        res.status(500).json({ message: `Failed to update stock record: ${error.message}` });
    }
  } else if (req.method === 'DELETE') {
    try {
        const { rowid } = req.query;
        if (!rowid || typeof rowid !== 'string') {
            return res.status(400).json({ message: 'rowid (as a query parameter) is required for deleting.' });
        }
        const numericRowId = parseInt(rowid, 10);
        if (isNaN(numericRowId)) {
            return res.status(400).json({ message: 'rowid must be a valid number.'});
        }

        const stmt = await db.prepare('DELETE FROM stock_records WHERE ROWID = ?');
        const result = await stmt.run(numericRowId);
        await stmt.finalize();

        if (result.changes && result.changes > 0) {
            res.status(200).json({ message: `Stock record with rowid ${numericRowId} deleted successfully.`});
        } else {
            res.status(404).json({ message: `Stock record with rowid ${numericRowId} not found or not deleted.`});
        }
    } catch (error: any) {
        console.error('Failed to delete stock record:', error);
        res.status(500).json({ message: `Failed to delete stock record: ${error.message}`});
    }
  }
  else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}