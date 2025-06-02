// components/db/AddStockRecordForm.tsx
import { useState, FormEvent, useEffect } from 'react';
import type { StockRecord, Project } from '@/lib/db';

interface AddStockRecordFormProps {
  onRecordAdded: (newRecord: Pick<StockRecord, 'StockCycle' | 'ProjectID' | 'FilledQty' | 'FilledAveragePrice' | 'ALL_DAY_VWAP' | 'Date'>) => void;
  projects: Pick<Project, 'ProjectID' | 'Ticker'>[]; // ProjectID選択用
}

const AddStockRecordForm: React.FC<AddStockRecordFormProps> = ({ onRecordAdded, projects }) => {
  const initialFormData = {
    StockCycle: '',
    ProjectID: projects.length > 0 ? projects[0].ProjectID || '' : '',
    FilledQty: '',
    FilledAveragePrice: '',
    ALL_DAY_VWAP: '',
    Date: '',
  };
  const [formData, setFormData] = useState(initialFormData);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // projectsが変更された場合、選択可能なProjectIDがあればフォームのProjectIDを更新
    if (projects.length > 0 && !projects.find(p => p.ProjectID === formData.ProjectID)) {
      setFormData(prev => ({ ...prev, ProjectID: projects[0].ProjectID || '' }));
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]); 
  
  useEffect(() => {
    // 選択されたProjectIDに基づいてStockCycleを自動入力する
    const selectedProject = projects.find(p => p.ProjectID === formData.ProjectID);
    if (selectedProject && selectedProject.Ticker) {
        // Ticker形式からStockCycle形式へ変換 (例: 7203 -> 7203 JT Equity)
        // これは blpapi.py のティッカー変換ロジックと合わせる必要があるかもしれない
        let stockCycleValue = selectedProject.Ticker;
        if (stockCycleValue.match(/^\d+$/)) { // 数字のみの場合
            stockCycleValue = `${stockCycleValue} JT Equity`;
        } else if (stockCycleValue.includes('.')) { // .T などが含まれる場合
            const parts = stockCycleValue.split('.');
            if (parts.length > 1 && parts[1].toUpperCase() === 'T') {
                stockCycleValue = `${parts[0]} JT Equity`;
            } else {
                 stockCycleValue = `${parts[0]} Equity`; // US Equity想定など
            }
        } else if (!stockCycleValue.toUpperCase().endsWith('EQUITY')) { // それ以外でEQUITYで終わらない場合
             stockCycleValue = `${stockCycleValue.toUpperCase()} US Equity`; // デフォルトで US Equity
        }
      setFormData(prev => ({ ...prev, StockCycle: stockCycleValue }));
    }
  }, [formData.ProjectID, projects]);


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
      FilledQty: parseFloat(formData.FilledQty),
      FilledAveragePrice: parseFloat(formData.FilledAveragePrice),
      ALL_DAY_VWAP: parseFloat(formData.ALL_DAY_VWAP),
    };

    if (isNaN(payload.FilledQty) || isNaN(payload.FilledAveragePrice) || isNaN(payload.ALL_DAY_VWAP)) {
        setError("数量と価格は有効な数値を入力してください。");
        setIsLoading(false);
        return;
    }


    try {
      const res = await fetch('/api/db/stock_records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resultData = await res.json();
      if (!res.ok) {
        throw new Error(resultData.message || resultData.error || 'Failed to add stock record');
      }
      setSuccess('取引記録が正常に追加されました。');
      onRecordAdded(resultData); // APIは新しい記録オブジェクトを返す想定
      setFormData(initialFormData); // フォームリセット
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  const commonInputClass = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
  const commonLabelClass = "block text-sm font-medium text-gray-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-md bg-gray-50">
      <h3 className="text-lg font-medium leading-6 text-gray-900">新規取引記録追加</h3>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {success && <p className="text-green-500 text-sm">{success}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ProjectID_stock" className={commonLabelClass}>Project ID <span className="text-red-500">*</span></label>
          <select name="ProjectID" id="ProjectID_stock" value={formData.ProjectID} onChange={handleChange} className={commonInputClass} required>
            <option value="">-- ProjectIDを選択 --</option>
            {projects.map(p => (
              <option key={p.ProjectID} value={p.ProjectID || ''}>{p.ProjectID} ({p.Ticker})</option>
            ))}
          </select>
        </div>
         <div>
          <label htmlFor="StockCycle" className={commonLabelClass}>Stock Cycle (自動入力/編集可)</label>
          <input type="text" name="StockCycle" id="StockCycle" value={formData.StockCycle} onChange={handleChange} className={commonInputClass} placeholder="例: 7203 JT Equity"/>
        </div>
        <div>
          <label htmlFor="Date_stock" className={commonLabelClass}>日付 <span className="text-red-500">*</span></label>
          <input type="date" name="Date" id="Date_stock" value={formData.Date} onChange={handleChange} className={commonInputClass} required />
        </div>
        <div>
          <label htmlFor="FilledQty" className={commonLabelClass}>約定数量 <span className="text-red-500">*</span></label>
          <input type="number" name="FilledQty" id="FilledQty" value={formData.FilledQty} onChange={handleChange} className={commonInputClass} required placeholder="例: 1000"/>
        </div>
        <div>
          <label htmlFor="FilledAveragePrice" className={commonLabelClass}>約定平均価格 <span className="text-red-500">*</span></label>
          <input type="number" step="any" name="FilledAveragePrice" id="FilledAveragePrice" value={formData.FilledAveragePrice} onChange={handleChange} className={commonInputClass} required placeholder="例: 1750.50"/>
        </div>
        <div>
          <label htmlFor="ALL_DAY_VWAP" className={commonLabelClass}>当日VWAP <span className="text-red-500">*</span></label>
          <input type="number" step="any" name="ALL_DAY_VWAP" id="ALL_DAY_VWAP" value={formData.ALL_DAY_VWAP} onChange={handleChange} className={commonInputClass} required placeholder="例: 1752.00"/>
        </div>
      </div>
      <div>
        <button type="submit" disabled={isLoading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400">
          {isLoading ? '追加中...' : '取引記録追加'}
        </button>
      </div>
    </form>
  );
};

export default AddStockRecordForm;