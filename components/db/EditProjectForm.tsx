// components/db/EditProjectForm.tsx
import { useState, FormEvent, useEffect } from 'react';
import type { Project } from '@/lib/db';
import { calculateBusinessDays } from '@/lib/dateUtils'; // ★ インポート

interface EditProjectFormProps {
  project: Project;
  onProjectUpdated: (updatedProject: Project) => void;
  onCancel: () => void;
}

const EditProjectForm: React.FC<EditProjectFormProps> = ({ project, onProjectUpdated, onCancel }) => {
  const [formData, setFormData] = useState<Project>(project);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setFormData(project); 
  }, [project]);

  useEffect(() => {
    if (formData.Start_Date && formData.End_Date) {
      const calculatedDays = calculateBusinessDays(formData.Start_Date, formData.End_Date);
      // 既存のBusiness_Daysがない場合、または日付が変更された場合にのみ自動計算値を設定
      // もしユーザーが手動でBusiness_Daysを変更できるようにするなら、このロジックは調整が必要
      if (formData.Business_Days === null || project.Start_Date !== formData.Start_Date || project.End_Date !== formData.End_Date) {
        setFormData(prev => ({ ...prev, Business_Days: calculatedDays }));
      }
    } else {
      // 日付が不完全な場合はBusiness_Daysをnullにするか検討
      // setFormData(prev => ({ ...prev, Business_Days: null }));
    }
  }, [formData.Start_Date, formData.End_Date, project.Start_Date, project.End_Date, project.Business_Days]);


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
      const res = await fetch(`/api/db/projects`, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resultData = await res.json();
      if (!res.ok) throw new Error(resultData.message || resultData.error || 'Failed to update project');
      setSuccess('プロジェクトが正常に更新されました。');
      onProjectUpdated(resultData as Project);
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
      <h3 className="text-xl font-semibold leading-6 text-gray-900">プロジェクト編集 (ID: {project.internal_id})</h3>
      {error && <p className="text-red-500 text-sm p-2 bg-red-50 rounded">{error}</p>}
      {success && <p className="text-green-500 text-sm p-2 bg-green-50 rounded">{success}</p>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label htmlFor={`edit_ProjectID_${project.internal_id}`} className={commonLabelClass}>Project ID (任意)</label><input type="text" name="ProjectID" id={`edit_ProjectID_${project.internal_id}`} value={formData.ProjectID || ''} onChange={handleChange} className={commonInputClass} /></div>
        <div><label htmlFor={`edit_Ticker_${project.internal_id}`} className={commonLabelClass}>Ticker <span className="text-red-500">*</span></label><input type="text" name="Ticker" id={`edit_Ticker_${project.internal_id}`} value={formData.Ticker} onChange={handleChange} className={commonInputClass} required /></div>
        <div><label htmlFor={`edit_Name_${project.internal_id}`} className={commonLabelClass}>銘柄名 <span className="text-red-500">*</span></label><input type="text" name="Name" id={`edit_Name_${project.internal_id}`} value={formData.Name} onChange={handleChange} className={commonInputClass} required /></div>
        <div><label htmlFor={`edit_Side_${project.internal_id}`} className={commonLabelClass}>Side <span className="text-red-500">*</span></label><select name="Side" id={`edit_Side_${project.internal_id}`} value={formData.Side} onChange={handleChange} className={commonInputClass} required><option value="BUY">BUY</option><option value="SELL">SELL</option></select></div>
        <div><label htmlFor={`edit_Total_Shares_${project.internal_id}`} className={commonLabelClass}>総株数 (任意)</label><input type="number" name="Total_Shares" id={`edit_Total_Shares_${project.internal_id}`} value={formData.Total_Shares ?? ''} onChange={handleChange} className={commonInputClass} placeholder="例: 10000"/></div>
        <div><label htmlFor={`edit_Total_Amount_${project.internal_id}`} className={commonLabelClass}>総金額 (任意)</label><input type="number" name="Total_Amount" id={`edit_Total_Amount_${project.internal_id}`} value={formData.Total_Amount ?? ''} onChange={handleChange} className={commonInputClass} placeholder="例: 5000000"/></div>
        <div><label htmlFor={`edit_Start_Date_${project.internal_id}`} className={commonLabelClass}>開始日 <span className="text-red-500">*</span></label><input type="date" name="Start_Date" id={`edit_Start_Date_${project.internal_id}`} value={formData.Start_Date} onChange={handleChange} className={commonInputClass} required /></div>
        <div><label htmlFor={`edit_End_Date_${project.internal_id}`} className={commonLabelClass}>終了日 <span className="text-red-500">*</span></label><input type="date" name="End_Date" id={`edit_End_Date_${project.internal_id}`} value={formData.End_Date} onChange={handleChange} className={commonInputClass} required /></div>
        <div><label htmlFor={`edit_Price_Limit_${project.internal_id}`} className={commonLabelClass}>価格制限 (任意)</label><input type="number" step="any" name="Price_Limit" id={`edit_Price_Limit_${project.internal_id}`} value={formData.Price_Limit ?? ''} onChange={handleChange} className={commonInputClass} placeholder="例: 5000"/></div>
        <div><label htmlFor={`edit_Perf_Fee_${project.internal_id}`} className={commonLabelClass}>業績連動手数料率 (%) (任意)</label><input type="number" step="any" name="Performance_Based_Fee_Rate" id={`edit_Perf_Fee_${project.internal_id}`} value={formData.Performance_Based_Fee_Rate ?? ''} onChange={handleChange} className={commonInputClass} placeholder="例: 10.5"/></div>
        <div><label htmlFor={`edit_Fixed_Fee_${project.internal_id}`} className={commonLabelClass}>固定手数料率 (%) (任意)</label><input type="number" step="any" name="Fixed_Fee_Rate" id={`edit_Fixed_Fee_${project.internal_id}`} value={formData.Fixed_Fee_Rate ?? ''} onChange={handleChange} className={commonInputClass} placeholder="例: 0.1"/></div>
        <div>
            <label htmlFor={`edit_Biz_Days_${project.internal_id}`} className={commonLabelClass}>営業日数 (自動計算)</label>
            <input type="number" name="Business_Days" id={`edit_Biz_Days_${project.internal_id}`} value={formData.Business_Days ?? ''} 
                   className={`${commonInputClass} bg-gray-100`} placeholder="自動計算" readOnly />
        </div>
        <div><label htmlFor={`edit_Earliest_Day_${project.internal_id}`} className={commonLabelClass}>最短日数カウント (任意)</label><input type="number" name="Earliest_Day_Count" id={`edit_Earliest_Day_${project.internal_id}`} value={formData.Earliest_Day_Count ?? ''} onChange={handleChange} className={commonInputClass} placeholder="例: 5"/></div>
        <div><label htmlFor={`edit_Excluded_Days_${project.internal_id}`} className={commonLabelClass}>除外日数 (任意)</label><input type="number" name="Excluded_Days" id={`edit_Excluded_Days_${project.internal_id}`} value={formData.Excluded_Days ?? ''} onChange={handleChange} className={commonInputClass} placeholder="例: 0"/></div>
        <div className="md:col-span-2"><label htmlFor={`edit_Note_${project.internal_id}`} className={commonLabelClass}>メモ (任意)</label><textarea name="Note" id={`edit_Note_${project.internal_id}`} value={formData.Note || ''} onChange={handleChange} rows={3} className={commonInputClass}></textarea></div>
        <div><label htmlFor={`edit_TS_Contact_${project.internal_id}`} className={commonLabelClass}>TS担当者 <span className="text-red-500">*</span></label><input type="text" name="TS_Contact" id={`edit_TS_Contact_${project.internal_id}`} value={formData.TS_Contact} onChange={handleChange} className={commonInputClass} required /></div>
      </div>
      <div className="flex justify-end space-x-3 mt-6">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">キャンセル</button>
        <button type="submit" disabled={isLoading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400">{isLoading ? '更新中...' : 'プロジェクト更新'}</button>
      </div>
    </form>
  );
};
export default EditProjectForm;