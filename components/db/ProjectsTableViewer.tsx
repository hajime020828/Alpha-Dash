// components/db/ProjectsTableViewer.tsx
import { useEffect, useState } from 'react';
import type { Project } from '@/lib/db';
import EditProjectForm from './EditProjectForm'; // 編集フォームをインポート

const ProjectsTableViewer = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [editingProject, setEditingProject] = useState<Project | null>(null); // 編集中のプロジェクト
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  const fetchProjectsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/db/projects');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          `API request failed with status ${res.status}: ${errorData.message || res.statusText}`
        );
      }
      const data: Project[] = await res.json();
      setProjects(data);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch projects data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectsData();
  }, []);

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setShowEditModal(true);
  };

  const handleProjectUpdated = (updatedProject: Project) => {
    setProjects(prevProjects => 
      prevProjects.map(p => p.internal_id === updatedProject.internal_id ? updatedProject : p)
    );
    setShowEditModal(false);
    setEditingProject(null);
    // 必要に応じて fetchProjectsData(); を呼び出して再フェッチ
  };
  
  const handleDeleteClick = (internalId: number) => {
    setDeletingProjectId(internalId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (deletingProjectId === null) return;
    try {
      const res = await fetch(`/api/db/projects?internal_id=${deletingProjectId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete project');
      }
      setProjects(prev => prev.filter(p => p.internal_id !== deletingProjectId));
      alert('プロジェクトが削除されました。');
    } catch (err: any) {
      setError(err.message);
      alert(`削除エラー: ${err.message}`);
    } finally {
      setShowDeleteConfirm(false);
      setDeletingProjectId(null);
    }
  };


  if (loading) return <p className="text-center text-gray-500">プロジェクトデータを読み込み中...</p>;
  if (error && !showEditModal && !showDeleteConfirm) return <p className="text-center text-red-500 p-3 bg-red-50 rounded-md">エラー: {error}</p>;
  if (projects.length === 0 && !loading) return <p className="text-center text-gray-500">プロジェクトデータが見つかりません。</p>;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return dateString;
  };

  const formatNullableNumber = (num: number | null | undefined) => {
    return num === null || num === undefined ? 'N/A' : num.toLocaleString();
  }
  
  const formatNullableString = (str: string | null | undefined) => {
    return str === null || str === undefined || str.trim() === '' ? 'N/A' : str;
  }

  return (
    <>
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-200 text-gray-600 uppercase text-xs leading-normal">
              <th className="py-3 px-3 text-left">ID</th>
              <th className="py-3 px-3 text-left">ProjectID</th>
              <th className="py-3 px-3 text-left">Ticker</th>
              <th className="py-3 px-3 text-left">Name</th>
              <th className="py-3 px-3 text-left">Side</th>
              <th className="py-3 px-3 text-right">Shares</th>
              <th className="py-3 px-3 text-right">Amount</th>
              <th className="py-3 px-3 text-left">Start</th>
              <th className="py-3 px-3 text-left">End</th>
              {/* 他のヘッダーも必要に応じて短縮表示または省略 */}
              <th className="py-3 px-3 text-left">TS Contact</th>
              <th className="py-3 px-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {projects.map((project) => (
              <tr key={project.internal_id} className="border-b border-gray-200 hover:bg-gray-100">
                <td className="py-2 px-3 text-left whitespace-nowrap">{project.internal_id}</td>
                <td className="py-2 px-3 text-left whitespace-nowrap">{formatNullableString(project.ProjectID)}</td>
                <td className="py-2 px-3 text-left whitespace-nowrap">{project.Ticker}</td>
                <td className="py-2 px-3 text-left truncate max-w-xs">{project.Name}</td>
                <td className="py-2 px-3 text-left">
                   <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold
                      ${project.Side === 'BUY' ? 'bg-green-200 text-green-800' : 
                        project.Side === 'SELL' ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-800'}`}>
                      {project.Side}
                    </span>
                </td>
                <td className="py-2 px-3 text-right">{formatNullableNumber(project.Total_Shares)}</td>
                <td className="py-2 px-3 text-right">{formatNullableNumber(project.Total_Amount)}</td>
                <td className="py-2 px-3 text-left whitespace-nowrap">{formatDate(project.Start_Date)}</td>
                <td className="py-2 px-3 text-left whitespace-nowrap">{formatDate(project.End_Date)}</td>
                <td className="py-2 px-3 text-left whitespace-nowrap">{project.TS_Contact}</td>
                <td className="py-2 px-3 text-center whitespace-nowrap">
                  <button
                    onClick={() => handleEdit(project)}
                    className="text-indigo-600 hover:text-indigo-900 mr-2 text-xs"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDeleteClick(project.internal_id)}
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

      {/* 編集モーダル */}
      {showEditModal && editingProject && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-10">
          <div className="relative mx-auto p-5 border w-full max-w-2xl md:max-w-3xl lg:max-w-4xl shadow-lg rounded-md bg-white">
            <EditProjectForm
              project={editingProject}
              onProjectUpdated={handleProjectUpdated}
              onCancel={() => {
                setShowEditModal(false);
                setEditingProject(null);
                setError(null); // モーダルを閉じるときにエラーをクリア
              }}
            />
          </div>
        </div>
      )}
      
      {/* 削除確認モーダル */}
      {showDeleteConfirm && deletingProjectId !== null && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
          <div className="p-6 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-semibold text-gray-900">プロジェクト削除確認</h3>
            <p className="text-sm text-gray-600 mt-2">
              本当にプロジェクト (Internal ID: {deletingProjectId}) を削除しますか？この操作は取り消せません。
            </p>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingProjectId(null);
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

export default ProjectsTableViewer;