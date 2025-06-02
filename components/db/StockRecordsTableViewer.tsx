// components/db/StockRecordsTableViewer.tsx
import { useEffect, useState, useMemo } from 'react';
import type { StockRecord } from '@/lib/db';

// APIから返されるStockRecordの型 (派生フィールドなし)
interface DisplayableStockRecord extends Pick<StockRecord, 'StockCycle' | 'ProjectID' | 'FilledQty' | 'FilledAveragePrice' | 'ALL_DAY_VWAP' | 'Date'> {
  // rowid?: number; // ROWIDが必要な場合はAPIから取得するように変更
}

const StockRecordsTableViewer = () => {
  const [allRecords, setAllRecords] = useState<DisplayableStockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectID, setSelectedProjectID] = useState<string>(''); // 選択されたProjectID

  useEffect(() => {
    const fetchStockRecordsData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/db/stock_records');
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            `API request failed with status ${res.status}: ${errorData.message || res.statusText}`
          );
        }
        const data: DisplayableStockRecord[] = await res.json();
        setAllRecords(data);
      } catch (e: any) {
        setError(e.message || 'Failed to fetch stock records data');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStockRecordsData();
  }, []);

  const uniqueProjectIDs = useMemo(() => {
    const ids = new Set(allRecords.map(record => record.ProjectID).filter(id => id !== null) as string[]);
    return Array.from(ids).sort();
  }, [allRecords]);

  const filteredRecords = useMemo(() => {
    if (!selectedProjectID) {
      return allRecords; //何も選択されていなければ全件表示
    }
    return allRecords.filter(record => record.ProjectID === selectedProjectID);
  }, [allRecords, selectedProjectID]);

  if (loading) return <p className="text-center text-gray-500">取引記録データを読み込み中...</p>;
  if (error) return <p className="text-center text-red-500">エラー: {error}</p>;
  // allRecordsが空の場合のメッセージはフィルタリング結果に関わらず表示した方が良いかもしれない
  if (allRecords.length === 0 && !loading) return <p className="text-center text-gray-500">取引記録データが見つかりません。</p>;
  
  const formatNullableNumber = (num: number | null | undefined, fractionDigits = 0) => {
    if (num === null || num === undefined) return 'N/A';
    return num.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits});
  }
  
  const formatNullableString = (str: string | null | undefined) => {
    return str === null || str === undefined || str.trim() === '' ? 'N/A' : str;
  }

  return (
    <div>
      <div className="mb-4">
        <label htmlFor="project-id-filter" className="block text-sm font-medium text-gray-700 mr-2">
          ProjectIDで絞り込み:
        </label>
        <select
          id="project-id-filter"
          value={selectedProjectID}
          onChange={(e) => setSelectedProjectID(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option value="">すべてのProjectID</option>
          {uniqueProjectIDs.map(pid => (
            <option key={pid} value={pid}>{pid}</option>
          ))}
        </select>
      </div>

      {filteredRecords.length === 0 && selectedProjectID && !loading && (
        <p className="text-center text-gray-500 mt-4">選択されたProjectID ({selectedProjectID}) の取引記録は見つかりません。</p>
      )}
      {filteredRecords.length > 0 && (
        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr className="bg-gray-200 text-gray-600 uppercase text-xs leading-normal">
                <th className="py-3 px-3 text-left">Stock Cycle</th>
                <th className="py-3 px-3 text-left">ProjectID</th>
                <th className="py-3 px-3 text-right">Filled Qty</th>
                <th className="py-3 px-3 text-right">Filled Avg Price</th>
                <th className="py-3 px-3 text-right">All Day VWAP</th>
                <th className="py-3 px-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 text-sm">
              {filteredRecords.map((record, index) => (
                <tr key={`${record.ProjectID}-${record.Date}-${record.StockCycle}-${index}`} className="border-b border-gray-200 hover:bg-gray-100">
                  <td className="py-3 px-3 text-left whitespace-nowrap">{formatNullableString(record.StockCycle)}</td>
                  <td className="py-3 px-3 text-left whitespace-nowrap">{formatNullableString(record.ProjectID)}</td>
                  <td className="py-3 px-3 text-right">{formatNullableNumber(record.FilledQty, 0)}</td>
                  <td className="py-3 px-3 text-right">{formatNullableNumber(record.FilledAveragePrice, 2)}</td>
                  <td className="py-3 px-3 text-right">{formatNullableNumber(record.ALL_DAY_VWAP, 2)}</td>
                  <td className="py-3 px-3 text-left whitespace-nowrap">{formatNullableString(record.Date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StockRecordsTableViewer;