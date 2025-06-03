// components/db/EditStockRecordForm.tsx
import { useState, FormEvent, useEffect } from 'react';
import type { StockRecord, Project } from '@/lib/db'; //

interface DisplayableStockRecordForEdit extends Pick<StockRecord, 'StockCycle' | 'ProjectID' | 'FilledQty' | 'FilledAveragePrice' | 'ALL_DAY_VWAP' | 'Date'> {
  rowid: number; // ROWIDが必須
}

interface EditStockRecordFormProps {
  record: DisplayableStockRecordForEdit;
  onRecordUpdated: (updatedRecord: DisplayableStockRecordForEdit) => void;
  onCancel: () => void;
  projects: Pick<Project, 'ProjectID' | 'Ticker'>[];
}

const EditStockRecordForm: React.FC<EditStockRecordFormProps> = ({ record, onRecordUpdated, onCancel, projects }) => {
  const [formData, setFormData] = useState<DisplayableStockRecordForEdit>(record);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setFormData(record);
  }, [record]);
  
  useEffect(() => {
    // 選択されたProjectIDに基づいてStockCycleを自動入力する (既存の値を上書きしないように注意)
    if (formData.ProjectID && !formData.StockCycle) { // StockCycleが空の場合のみ自動入力
        const selectedProject = projects.find(p => p.ProjectID === formData.ProjectID);
        if (selectedProject && selectedProject.Ticker) {
            let stockCycleValue = selectedProject.Ticker;
            if (stockCycleValue.match(/^\d+$/)) {
                stockCycleValue = `${stockCycleValue} JT Equity`;
            } else if (stockCycleValue.includes('.')) {
                const parts = stockCycleValue.split('.');
                if (parts.length > 1 && parts[1].toUpperCase() === 'T') {
                    stockCycleValue = `${parts[0]} JT Equity`;
                } else {
                     stockCycleValue = `${parts[0]} Equity`;
                }
            } else if (!stockCycleValue.toUpperCase().endsWith('EQUITY')) {
                 stockCycleValue = `${stockCycleValue.toUpperCase()} US Equity`;
            }
          setFormData(prev => ({ ...prev, StockCycle: stockCycleValue }));
        }
    }
  }, [formData.ProjectID, projects, formData.StockCycle]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const payload = {
      ...formData,
      FilledQty: parseFloat(String(formData.FilledQty)), // String経由で数値変換
      FilledAveragePrice: parseFloat(String(formData.FilledAveragePrice)),
      ALL_DAY_VWAP: parseFloat(String(formData.ALL_DAY_VWAP)),
    };

    if (isNaN(payload.FilledQty) || isNaN(payload.FilledAveragePrice) || isNaN(payload.ALL_DAY_VWAP)) {
        setError("数量と価格は有効な数値を入力してください。");
        setIsLoading(false);
        return;
    }

    try {
      const res = await fetch('/api/db/stock_records', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resultData = await res.json();
      if (!res.ok) {
        throw new Error(resultData.message || resultData.error || 'Failed to update stock record');
      }
      setSuccess('取引記録が正常に更新されました。');
      onRecordUpdated(resultData as DisplayableStockRecordForEdit);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  const commonInputClass = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
  const commonLabelClass = "block text-sm font-medium text-gray-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 border rounded-lg bg-white shadow-lg">
      <h3 className="text-xl font-semibold leading-6 text-gray-900">取引記録編集 (ROWID: {record.rowid})</h3>
      {error && <p className="text-red-500 text-sm p-2 bg-red-50 rounded">{error}</p>}
      {success && <p className="text-green-500 text-sm p-2 bg-green-50 rounded">{success}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`edit_sr_ProjectID_${record.rowid}`} className={commonLabelClass}>Project ID <span className="text-red-500">*</span></label>
          <select name="ProjectID" id={`edit_sr_ProjectID_${record.rowid}`} value={formData.ProjectID || ''} onChange={handleChange} className={commonInputClass} required>
            <option value="">-- ProjectIDを選択 --</option>
            {projects.map(p => (
              <option key={p.ProjectID} value={p.ProjectID || ''}>{p.ProjectID} ({p.Ticker})</option>
            ))}
          </select>
        </div>
         <div>
          <label htmlFor={`edit_sr_StockCycle_${record.rowid}`} className={commonLabelClass}>Stock Cycle (自動入力/編集可)</label>
          <input type="text" name="StockCycle" id={`edit_sr_StockCycle_${record.rowid}`} value={formData.StockCycle || ''} onChange={handleChange} className={commonInputClass} placeholder="例: 7203 JT Equity"/>
        </div>
        <div>
          <label htmlFor={`edit_sr_Date_${record.rowid}`} className={commonLabelClass}>日付 <span className="text-red-500">*</span></label>
          <input type="date" name="Date" id={`edit_sr_Date_${record.rowid}`} value={formData.Date} onChange={handleChange} className={commonInputClass} required />
        </div>
        <div>
          <label htmlFor={`edit_sr_FilledQty_${record.rowid}`} className={commonLabelClass}>約定数量 <span className="text-red-500">*</span></label>
          <input type="number" name="FilledQty" id={`edit_sr_FilledQty_${record.rowid}`} value={formData.FilledQty} onChange={handleChange} className={commonInputClass} required placeholder="例: 1000"/>
        </div>
        <div>
          <label htmlFor={`edit_sr_FilledAvgPrice_${record.rowid}`} className={commonLabelClass}>約定平均価格 <span className="text-red-500">*</span></label>
          <input type="number" step="any" name="FilledAveragePrice" id={`edit_sr_FilledAvgPrice_${record.rowid}`} value={formData.FilledAveragePrice} onChange={handleChange} className={commonInputClass} required placeholder="例: 1750.50"/>
        </div>
        <div>
          <label htmlFor={`edit_sr_AllDayVWAP_${record.rowid}`} className={commonLabelClass}>当日VWAP <span className="text-red-500">*</span></label>
          <input type="number" step="any" name="ALL_DAY_VWAP" id={`edit_sr_AllDayVWAP_${record.rowid}`} value={formData.ALL_DAY_VWAP} onChange={handleChange} className={commonInputClass} required placeholder="例: 1752.00"/>
        </div>
      </div>
      <div className="flex justify-end space-x-3 mt-6">
         <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          キャンセル
        </button>
        <button type="submit" disabled={isLoading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400">
          {isLoading ? '更新中...' : '取引記録更新'}
        </button>
      </div>
    </form>
  );
};

export default EditStockRecordForm;