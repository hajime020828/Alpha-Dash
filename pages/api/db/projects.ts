// pages/api/db/projects.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, Project } from '@/lib/db'; //

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Project[] | Project | { message: string } | { error: string }>
) {
  const db = await getDb();

  if (req.method === 'GET') {
    try {
      const projects = await db.all<Project[]>('SELECT * FROM projects ORDER BY internal_id ASC');
      res.status(200).json(projects);
    } catch (error: any) {
      console.error('Failed to fetch projects table:', error);
      res.status(500).json({ message: `Failed to fetch projects table: ${error.message}` });
    }
  } else if (req.method === 'POST') {
    try {
      const {
        ProjectID, Ticker, Name, Side, Total_Shares, Total_Amount,
        Start_Date, End_Date, Price_Limit, Performance_Based_Fee_Rate,
        Fixed_Fee_Rate, Business_Days, Earliest_Day_Count, Excluded_Days,
        Note, TS_Contact
      }: Omit<Project, 'internal_id'> = req.body;

      if (!Ticker || !Name || !Side || !Start_Date || !End_Date || !TS_Contact) {
        return res.status(400).json({ error: 'Missing required fields for project' });
      }
      
      // 受け取った値をそのまま使うか、nullでなければ数値に変換
      const finalTotalShares = (Total_Shares !== undefined && Total_Shares !== null) ? Number(Total_Shares) : null;
      const finalTotalAmount = (Total_Amount !== undefined && Total_Amount !== null) ? Number(Total_Amount) : null;

      const stmt = await db.prepare(
        `INSERT INTO projects (
          ProjectID, Ticker, Name, Side, Total_Shares, Total_Amount,
          Start_Date, End_Date, Price_Limit, Performance_Based_Fee_Rate,
          Fixed_Fee_Rate, Business_Days, Earliest_Day_Count, Excluded_Days,
          Note, TS_Contact
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      
      const result = await stmt.run(
        ProjectID || null, Ticker, Name, Side,
        finalTotalShares, 
        finalTotalAmount, 
        Start_Date, End_Date,
        (Price_Limit !== undefined && Price_Limit !== null) ? Number(Price_Limit) : null,
        (Performance_Based_Fee_Rate !== undefined && Performance_Based_Fee_Rate !== null) ? Number(Performance_Based_Fee_Rate) : null,
        (Fixed_Fee_Rate !== undefined && Fixed_Fee_Rate !== null) ? Number(Fixed_Fee_Rate) : null,
        (Business_Days !== undefined && Business_Days !== null) ? Number(Business_Days) : null,
        (Earliest_Day_Count !== undefined && Earliest_Day_Count !== null) ? Number(Earliest_Day_Count) : null,
        (Excluded_Days !== undefined && Excluded_Days !== null) ? Number(Excluded_Days) : null,
        Note || null, TS_Contact
      );
      await stmt.finalize();

      if (result.lastID) {
        const newProject = await db.get<Project>('SELECT * FROM projects WHERE internal_id = ?', result.lastID);
        if (newProject) {
            res.status(201).json(newProject);
        } else {
            res.status(500).json({ message: 'Failed to retrieve the newly inserted project.'})
        }
      } else {
        res.status(500).json({ message: 'Failed to insert project, no lastID returned' });
      }
    } catch (error: any) {
      console.error('Failed to insert project:', error);
      res.status(500).json({ message: `Failed to insert project: ${error.message}` });
    }
  } else if (req.method === 'PUT') {
    try {
      const { internal_id, ...projectDataToUpdate }: Project = req.body;
      if (!internal_id) {
        return res.status(400).json({ message: 'internal_id is required for updating.' });
      }

      const {
        ProjectID, Ticker, Name, Side, Total_Shares, Total_Amount,
        Start_Date, End_Date, Price_Limit, Performance_Based_Fee_Rate,
        Fixed_Fee_Rate, Business_Days, Earliest_Day_Count, Excluded_Days,
        Note, TS_Contact
      } = projectDataToUpdate;
      
      if (!Ticker || !Name || !Side || !Start_Date || !End_Date || !TS_Contact) {
        return res.status(400).json({ error: 'Missing required fields for project update' });
      }
      
      const finalTotalShares = (Total_Shares !== undefined && Total_Shares !== null) ? Number(Total_Shares) : null;
      const finalTotalAmount = (Total_Amount !== undefined && Total_Amount !== null) ? Number(Total_Amount) : null;

      const stmt = await db.prepare(
        `UPDATE projects SET
          ProjectID = ?, Ticker = ?, Name = ?, Side = ?, Total_Shares = ?, Total_Amount = ?,
          Start_Date = ?, End_Date = ?, Price_Limit = ?, Performance_Based_Fee_Rate = ?,
          Fixed_Fee_Rate = ?, Business_Days = ?, Earliest_Day_Count = ?, Excluded_Days = ?,
          Note = ?, TS_Contact = ?
        WHERE internal_id = ?`
      );
      await stmt.run(
        ProjectID || null, Ticker, Name, Side,
        finalTotalShares,
        finalTotalAmount,
        Start_Date, End_Date, 
        (Price_Limit !== undefined && Price_Limit !== null) ? Number(Price_Limit) : null,
        (Performance_Based_Fee_Rate !== undefined && Performance_Based_Fee_Rate !== null) ? Number(Performance_Based_Fee_Rate) : null,
        (Fixed_Fee_Rate !== undefined && Fixed_Fee_Rate !== null) ? Number(Fixed_Fee_Rate) : null,
        (Business_Days !== undefined && Business_Days !== null) ? Number(Business_Days) : null,
        (Earliest_Day_Count !== undefined && Earliest_Day_Count !== null) ? Number(Earliest_Day_Count) : null,
        (Excluded_Days !== undefined && Excluded_Days !== null) ? Number(Excluded_Days) : null,
        Note || null, TS_Contact,
        internal_id
      );
      await stmt.finalize();
      
      const updatedProject = await db.get<Project>('SELECT * FROM projects WHERE internal_id = ?', internal_id);
       if (updatedProject) {
            res.status(200).json(updatedProject);
        } else {
            res.status(404).json({ message: `Project with internal_id ${internal_id} not found after update.`})
        }

    } catch (error: any) {
      console.error('Failed to update project:', error);
      res.status(500).json({ message: `Failed to update project: ${error.message}` });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { internal_id } = req.query; 
      if (!internal_id || typeof internal_id !== 'string') {
        return res.status(400).json({ message: 'internal_id (as a query parameter) is required for deleting.' });
      }
      const numericInternalId = parseInt(internal_id, 10);
      if (isNaN(numericInternalId)) {
        return res.status(400).json({ message: 'internal_id must be a valid number.' });
      }

      const stmt = await db.prepare('DELETE FROM projects WHERE internal_id = ?');
      const result = await stmt.run(numericInternalId);
      await stmt.finalize();

      if (result.changes && result.changes > 0) {
        res.status(200).json({ message: `Project with internal_id ${numericInternalId} deleted successfully.` });
      } else {
        res.status(404).json({ message: `Project with internal_id ${numericInternalId} not found or not deleted.` });
      }
    } catch (error: any) {
      console.error('Failed to delete project:', error);
      res.status(500).json({ message: `Failed to delete project: ${error.message}` });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}