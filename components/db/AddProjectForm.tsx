// components/db/AddProjectForm.tsx
import { useState, FormEvent, useEffect } from 'react';
import type { Project } from '@/lib/db';
import { calculateBusinessDays } from '@/lib/dateUtils'; // ★ インポート

interface AddProjectFormProps {
  onProjectAdded: (newProject: Project) => void;
}

const AddProjectForm: React.FC<AddProjectFormProps> = ({ onProjectAdded }) => {
  const [formData, setFormData] = useState<Omit<Project, 'internal_id'>>({
    ProjectID: '', Ticker: '', Name: '', Side: 'BUY', Total_Shares: null, Total_Amount: null,
    Start_Date: '', End_Date: '', Price_Limit: null, Performance_Based_Fee_Rate: null,
    Fixed_Fee_Rate: null, Business_Days: null, Earliest_Day_Count: null, Excluded_Days: null,
    Note: '', TS_Contact: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (formData.Start_Date && formData.End_Date) {
      const calculatedDays = calculateBusinessDays(formData.Start_Date, formData.End_Date); // 休日セットはデフォルトを使用
      setFormData(prev => ({ ...prev, Business_Days: calculatedDays }));
    } else {
      setFormData(prev => ({ ...prev, Business_Days: null }));
    }
  }, [formData.Start_Date, formData.End_Date]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let processedValue: string | number | null = value;
    if (type === 'number' || 
        ['Total_Shares', 'Total_Amount', 'Price_Limit', 
         'Performance_Based_Fee_Rate', 'Fixed_Fee_Rate', 
         'Earliest_Day_Count', 'Excluded_Days'].includes(name)) {
      processedValue = value === '' ? null : parseFloat(value);
    }
    if (name === 'Business_Days') return; 
    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    const payload = { ...formData };
    (Object.keys(payload) as Array<keyof typeof payload>).forEach(key => {
        if (['Total_Shares', 'Total_Amount', 'Price_Limit', 'Performance_Based_Fee_Rate', 'Fixed_Fee_Rate', 'Business_Days', 'Earliest_Day_Count', 'Excluded_Days'].includes(key)) {
            if (payload[key] === '' || payload[key] === undefined) (payload as any)[key] = null;
            else if (payload[key] !== null && typeof payload[key] === 'string') {
                const numVal = parseFloat(payload[key] as string);
                (payload as any)[key] = isNaN(numVal) ? null : numVal;
            } else if (payload[key] !== null && typeof payload[key] === 'number' && isNaN(payload[key] as number)) (payload as any)[key] = null;
        }
    });
    try {
      const res = await fetch('/api/db/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resultData = await res.json();
      if (!res.ok) throw new Error(resultData.message || resultData.error || 'Failed to add project');
      setSuccess('プロジェクトが正常に追加されました。');
      onProjectAdded(resultData as Project); 
      setFormData({
        ProjectID: '', Ticker: '', Name: '', Side: 'BUY', Total_Shares: null, Total_Amount: null,
        Start_Date: '', End_Date: '', Price_Limit: null, Performance_Based_Fee_Rate: null,
        Fixed_Fee_Rate: null, Business_Days: null, Earliest_Day_Count: null, Excluded_Days: null,
        Note: '', TS_Contact: '',
      });
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
      <h3 className="text-lg font-medium leading-6 text-gray-900">新規プロジェクト追加</h3>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {success && <p className="text-green-500 text-sm">{success}</p>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label htmlFor="ProjectID" className={commonLabelClass}>Project ID (任意)</label><input type="text" name="ProjectID" id="ProjectID" value={formData.ProjectID || ''} onChange={handleChange} className={commonInputClass} /></div>
        <div><label htmlFor="Ticker" className={commonLabelClass}>Ticker <span className="text-red-500">*</span></label><input type="text" name="Ticker" id="Ticker" value={formData.Ticker} onChange={handleChange} className={commonInputClass} required /></div>
        <div><label htmlFor="Name" className={commonLabelClass}>銘柄名 <span className="text-red-500">*</span></label><input type="text" name="Name" id="Name" value={formData.Name} onChange={handleChange} className={commonInputClass} required /></div>
        <div><label htmlFor="Side" className={commonLabelClass}>Side <span className="text-red-500">*</span></label><select name="Side" id="Side" value={formData.Side} onChange={handleChange} className={commonInputClass} required><option value="BUY">BUY</option><option value="SELL">SELL</option></select></div>
        <div><label htmlFor="Total_Shares" className={commonLabelClass}>総株数 (任意)</label><input type="number" name="Total_Shares" id="Total_Shares" value={formData.Total_Shares ?? ''} onChange={handleChange} className={commonInputClass} placeholder="例: 10000"/></div>
        <div><label htmlFor="Total_Amount" className={commonLabelClass}>総金額 (任意)</label><input type="number" name="Total_Amount" id="Total_Amount" value={formData.Total_Amount ?? ''} onChange={handleChange} className={commonInputClass} placeholder="例: 5000000"/></div>
        <div><label htmlFor="Start_Date" className={commonLabelClass}>開始日 <span className="text-red-500">*</span></label><input type="date" name="Start_Date" id="Start_Date" value={formData.Start_Date} onChange={handleChange} className={commonInputClass} required /></div>
        <div><label htmlFor="End_Date" className={commonLabelClass}>終了日 <span className="text-red-500">*</span></label><input type="date" name="End_Date" id="End_Date" value={formData.End_Date} onChange={handleChange} className={commonInputClass} required /></div>
        <div><label htmlFor="Price_Limit" className={commonLabelClass}>価格制限 (任意)</label><input type="number" step="any" name="Price_Limit" id="Price_Limit" value={formData.Price_Limit ?? ''} onChange={handleChange} className={commonInputClass} placeholder="例: 5000"/></div>
        <div><label htmlFor="Performance_Based_Fee_Rate" className={commonLabelClass}>業績連動手数料率 (%) (任意)</label><input type="number" step="any" name="Performance_Based_Fee_Rate" id="Performance_Based_Fee_Rate" value={formData.Performance_Based_Fee_Rate ?? ''} onChange={handleChange} className={commonInputClass} placeholder="例: 10.5"/></div>
        <div><label htmlFor="Fixed_Fee_Rate" className={commonLabelClass}>固定手数料率 (%) (任意)</label><input type="number" step="any" name="Fixed_Fee_Rate" id="Fixed_Fee_Rate" value={formData.Fixed_Fee_Rate ?? ''} onChange={handleChange} className={commonInputClass} placeholder="例: 0.1"/></div>
        <div>
            <label htmlFor="Business_Days" className={commonLabelClass}>営業日数 (自動計算)</label>
            <input type="number" name="Business_Days" id="Business_Days" value={formData.Business_Days ?? ''} 
                   className={`${commonInputClass} bg-gray-100`} 
                   placeholder="自動計算" readOnly />
        </div>
        <div><label htmlFor="Earliest_Day_Count" className={commonLabelClass}>最短日数カウント (任意)</label><input type="number" name="Earliest_Day_Count" id="Earliest_Day_Count" value={formData.Earliest_Day_Count ?? ''} onChange={handleChange} className={commonInputClass} placeholder="例: 5"/></div>
        <div><label htmlFor="Excluded_Days" className={commonLabelClass}>除外日数 (任意)</label><input type="number" name="Excluded_Days" id="Excluded_Days" value={formData.Excluded_Days ?? ''} onChange={handleChange} className={commonInputClass} placeholder="例: 0"/></div>
        <div className="md:col-span-2"><label htmlFor="Note" className={commonLabelClass}>メモ (任意)</label><textarea name="Note" id="Note" value={formData.Note || ''} onChange={handleChange} rows={3} className={commonInputClass}></textarea></div>
        <div><label htmlFor="TS_Contact" className={commonLabelClass}>TS担当者 <span className="text-red-500">*</span></label><input type="text" name="TS_Contact" id="TS_Contact" value={formData.TS_Contact} onChange={handleChange} className={commonInputClass} required /></div>
      </div>
      <div><button type="submit" disabled={isLoading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400">{isLoading ? '追加中...' : 'プロジェクト追加'}</button></div>
    </form>
  );
};
export default AddProjectForm;