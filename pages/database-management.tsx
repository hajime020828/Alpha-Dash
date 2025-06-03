// pages/database-management.tsx
import { useState, useEffect, useCallback } from 'react';
import ProjectsTableViewer from '@/components/db/ProjectsTableViewer';
import StockRecordsTableViewer from '@/components/db/StockRecordsTableViewer';
import AddProjectForm from '@/components/db/AddProjectForm';
import AddStockRecordForm from '@/components/db/AddStockRecordForm';
import type { Project, StockRecord } from '@/lib/db'; //

const DatabaseManagementPage = () => {
  const [selectedTable, setSelectedTable] = useState<'projects' | 'stock_records' | null>(null);
  const [showAddForm, setShowAddForm] = useState<'projects' | 'stock_records' | null>(null);

  const [projectsKey, setProjectsKey] = useState(Date.now());
  const [stockRecordsKey, setStockRecordsKey] = useState(Date.now());
  
  const [allProjectsForDropdown, setAllProjectsForDropdown] = useState<Pick<Project, 'ProjectID' | 'Ticker'>[]>([]);


  const fetchProjectListForDropdown = useCallback(async () => {
    try {
      const res = await fetch('/api/db/projects'); // Projects APIから取得
      if (res.ok) {
        const projectsData: Project[] = await res.json();
        setAllProjectsForDropdown(projectsData.map(p => ({ ProjectID: p.ProjectID, Ticker: p.Ticker })).filter(p => p.ProjectID)); // ProjectIDがnullでないもののみ
      } else {
        console.error('Failed to fetch project list for dropdown');
        setAllProjectsForDropdown([]); // エラー時は空にする
      }
    } catch (error) {
      console.error('Error fetching project list:', error);
      setAllProjectsForDropdown([]);
    }
  }, []);

  useEffect(() => {
    // ページ読み込み時またはテーブル選択変更時にプロジェクトリストを取得
    fetchProjectListForDropdown();
  }, [fetchProjectListForDropdown]); // selectedTableの変更時にも呼ぶなら依存配列に追加


  const handleProjectAdded = (newProject: Project) => {
    console.log('Project added:', newProject);
    setShowAddForm(null); 
    setProjectsKey(Date.now()); 
    fetchProjectListForDropdown(); // プロジェクト追加後にもリストを更新
  };

  const handleRecordAdded = (newRecord: Pick<StockRecord, 'StockCycle' | 'ProjectID' | 'FilledQty' | 'FilledAveragePrice' | 'ALL_DAY_VWAP' | 'Date'> & {rowid?: number}) => {
    console.log('Record added:', newRecord);
    setShowAddForm(null); 
    setStockRecordsKey(Date.now()); 
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">データベース管理</h1>
      
      <div className="mb-4">
        <label htmlFor="table-select" className="block text-sm font-medium text-gray-700 mr-2">
          表示・編集するテーブルを選択:
        </label>
        <select
          id="table-select"
          value={selectedTable || ''}
          onChange={(e) => {
            setSelectedTable(e.target.value as 'projects' | 'stock_records' | null);
            setShowAddForm(null); 
          }}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option value="">-- テーブルを選択 --</option>
          <option value="projects">Projects</option>
          <option value="stock_records">Stock Records</option>
        </select>
      </div>

      {selectedTable && !showAddForm && (
        <div className="my-4">
          <button
            onClick={() => setShowAddForm(selectedTable)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            {selectedTable === 'projects' ? '新規プロジェクト追加' : '新規取引記録追加'}
          </button>
        </div>
      )}

      {showAddForm === 'projects' && (
        <div className="my-6 p-4 border rounded-md bg-gray-50 shadow">
          <AddProjectForm onProjectAdded={handleProjectAdded} />
          <button onClick={() => setShowAddForm(null)} className="mt-4 text-sm text-indigo-600 hover:text-indigo-800">キャンセル</button>
        </div>
      )}
      {showAddForm === 'stock_records' && (
        <div className="my-6 p-4 border rounded-md bg-gray-50 shadow">
          <AddStockRecordForm onRecordAdded={handleRecordAdded} projects={allProjectsForDropdown} />
          <button onClick={() => setShowAddForm(null)} className="mt-4 text-sm text-indigo-600 hover:text-indigo-800">キャンセル</button>
        </div>
      )}


      {selectedTable === 'projects' && !showAddForm && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-3">Projects テーブル</h2>
          <ProjectsTableViewer key={projectsKey} /> 
        </div>
      )}

      {selectedTable === 'stock_records' && !showAddForm && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-3">Stock Records テーブル</h2>
          <StockRecordsTableViewer key={stockRecordsKey} projectsForDropdown={allProjectsForDropdown} /> 
        </div>
      )}
       <p className="mt-6 p-4 bg-yellow-100 text-yellow-700 rounded-md text-sm">
        注意: データのバリデーションは基本的なもののみとなっています。
      </p>
    </div>
  );
};

export default DatabaseManagementPage;