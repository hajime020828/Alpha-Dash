// components/db/StockRecordsTableViewer.tsx
import { useEffect, useState, useMemo } from 'react';
import type { StockRecord, Project } from '@/lib/db'; //
import EditStockRecordForm from './EditStockRecordForm'; // 編集フォームをインポート

interface DisplayableStockRecord extends Pick<StockRecord, 'StockCycle' | 'ProjectID' | 'FilledQty' | 'FilledAveragePrice' | 'ALL_DAY_VWAP' | 'Date'> {
  rowid: number; // APIからROWIDを受け取るように変更
}

interface StockRecordsTableViewerProps {
    projectsForDropdown: Pick<Project, 'ProjectID' | 'Ticker'>[]; // 親からProjectIDリストを受け取る
}


const StockRecordsTableViewer: React.FC<StockRecordsTableViewerProps> = ({ projectsForDropdown }) => {
  const [allRecords, setAllRecords] = useState<DisplayableStockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectID, setSelectedProjectID] = useState<string>('');

  const [editingRecord, setEditingRecord] = useState<DisplayableStockRecord | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [deletingRecordRowId, setDeletingRecordRowId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


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

  useEffect(() => {
    fetchStockRecordsData();
  }, []);

  const uniqueProjectIDs = useMemo(() => {
    const ids = new Set(allRecords.map(record => record.ProjectID).filter(id => id !== null) as string[]);
    return Array.from(ids).sort();
  }, [allRecords]);

  const filteredRecords = useMemo(() => {
    if (!selectedProjectID) {
      return allRecords;
    }
    return allRecords.filter(record => record.ProjectID === selectedProjectID);
  }, [allRecords, selectedProjectID]);

  const handleEdit = (record: DisplayableStockRecord) => {
    setEditingRecord(record);
    setShowEditModal(true);
  };

  const handleRecordUpdated = (updatedRecord: DisplayableStockRecord) => {
    setAllRecords(prevRecords => 
      prevRecords.map(r => r.rowid === updatedRecord.rowid ? updatedRecord : r)
    );
    setShowEditModal(false);
    setEditingRecord(null);
  };
  
  const handleDeleteClick = (rowId: number) => {
    setDeletingRecordRowId(rowId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (deletingRecordRowId === null) return;
    setError(null);
    try {
      const res = await fetch(`/api/db/stock_records?rowid=${deletingRecordRowId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete stock record');
      }
      setAllRecords(prev => prev.filter(r => r.rowid !== deletingRecordRowId));
      alert('取引記録が削除されました。');
    } catch (err: any) {
      setError(err.message);
      alert(`削除エラー: ${err.message}`);
    } finally {
      setShowDeleteConfirm(false);
      setDeletingRecordRowId(null);
    }
  };


  if (loading) return <p className="text-center text-gray-500">取引記録データを読み込み中...</p>;
  if (error && !showEditModal && !showDeleteConfirm) return <p className="text-center text-red-500 p-3 bg-red-50 rounded-md">エラー: {error}</p>;
  if (allRecords.length === 0 && !loading) return <p className="text-center text-gray-500">取引記録データが見つかりません。</p>;
  
  const formatNullableNumber = (num: number | null | undefined, fractionDigits = 0) => {
    if (num === null || num === undefined) return 'N/A';
    return num.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits});
  }
  
  const formatNullableString = (str: string | null | undefined) => {
    return str === null || str === undefined || str.trim() === '' ? 'N/A' : str;
  }

  return (
    <>
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
                <th className="py-3 px-3 text-left">ROWID</th>
                <th className="py-3 px-3 text-left">Stock Cycle</th>
                <th className="py-3 px-3 text-left">ProjectID</th>
                <th className="py-3 px-3 text-right">Filled Qty</th>
                <th className="py-3 px-3 text-right">Filled Avg Price</th>
                <th className="py-3 px-3 text-right">All Day VWAP</th>
                <th className="py-3 px-3 text-left">Date</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 text-sm">
              {filteredRecords.map((record) => (
                <tr key={record.rowid} className="border-b border-gray-200 hover:bg-gray-100">
                  <td className="py-2 px-3 text-left whitespace-nowrap">{record.rowid}</td>
                  <td className="py-2 px-3 text-left whitespace-nowrap">{formatNullableString(record.StockCycle)}</td>
                  <td className="py-2 px-3 text-left whitespace-nowrap">{formatNullableString(record.ProjectID)}</td>
                  <td className="py-2 px-3 text-right">{formatNullableNumber(record.FilledQty, 0)}</td>
                  <td className="py-2 px-3 text-right">{formatNullableNumber(record.FilledAveragePrice, 2)}</td>
                  <td className="py-2 px-3 text-right">{formatNullableNumber(record.ALL_DAY_VWAP, 2)}</td>
                  <td className="py-2 px-3 text-left whitespace-nowrap">{formatNullableString(record.Date)}</td>
                  <td className="py-2 px-3 text-center whitespace-nowrap">
                    <button
                        onClick={() => handleEdit(record)}
                        className="text-indigo-600 hover:text-indigo-900 mr-2 text-xs"
                    >
                        編集
                    </button>
                    <button
                        onClick={() => handleDeleteClick(record.rowid)}
                        className="text-red-600 hover:text-red-900 text-xs"
                    >
                        削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 編集モーダル */}
      {showEditModal && editingRecord && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-10">
          <div className="relative mx-auto p-5 border w-full max-w-xl md:max-w-2xl shadow-lg rounded-md bg-white">
            <EditStockRecordForm
              record={editingRecord}
              onRecordUpdated={handleRecordUpdated}
              onCancel={() => {
                setShowEditModal(false);
                setEditingRecord(null);
                setError(null);
              }}
              projects={projectsForDropdown}
            />
          </div>
        </div>
      )}
      
      {/* 削除確認モーダル */}
      {showDeleteConfirm && deletingRecordRowId !== null && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
          <div className="p-6 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-semibold text-gray-900">取引記録削除確認</h3>
            <p className="text-sm text-gray-600 mt-2">
              本当にこの取引記録 (ROWID: {deletingRecordRowId}) を削除しますか？この操作は取り消せません。
            </p>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingRecordRowId(null);
                  setError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                削除実行
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StockRecordsTableViewer;