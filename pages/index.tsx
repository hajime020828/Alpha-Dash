// pages/index.tsx
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ProjectWithProgress } from '@/lib/db'; // Path alias を使用

const HomePage = () => {
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/projects');
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(`API request failed with status ${res.status}: ${errorData.message || res.statusText}`);
        }
        const data: ProjectWithProgress[] = await res.json();
        setProjects(data);
        setError(null);
      } catch (e: any) {
        setError(e.message || 'Failed to fetch projects');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  if (loading) return <p className="text-center text-gray-500">読み込み中...</p>;
  if (error) return <p className="text-center text-red-500">エラー: {error}</p>;
  if (projects.length === 0) return <p className="text-center text-gray-500">プロジェクトが見つかりません。</p>;

  const ProgressBar = ({ progress, color = 'bg-blue-600' }: { progress: number, color?: string }) => (
    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
      <div
        className={`${color} h-2.5 rounded-full`}
        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
      ></div>
    </div>
  );

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-800">プロジェクト一覧</h1>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
              <th className="py-3 px-4 text-left">Project ID</th>
              <th className="py-3 px-4 text-left">銘柄名</th>
              <th className="py-3 px-4 text-left">Side</th>
              <th className="py-3 px-4 text-left w-40">経過日数進捗<br/><span className="text-xs normal-case font-normal">(取引日数/営業日数)</span></th>
              <th className="py-3 px-4 text-left w-40">約定進捗</th>
              <th className="py-3 px-4 text-center">アクション</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {projects.map((project) => (
              <tr key={project.internal_id} className="border-b border-gray-200 hover:bg-gray-100">
                <td className="py-3 px-4 text-left whitespace-nowrap">{project.ProjectID || 'N/A'}</td>
                <td className="py-3 px-4 text-left">{project.Name}</td>
                <td className="py-3 px-4 text-left">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold
                    ${project.Side === 'BUY' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                    {project.Side}
                  </span>
                </td>
                <td className="py-3 px-4 text-left">
                  <div className="flex items-center">
                    <span className="mr-2 text-xs w-12 text-right">{project.daysProgress.toFixed(1)}%</span>
                    <ProgressBar progress={project.daysProgress} color="bg-sky-500" />
                  </div>
                  <div className="text-xs text-gray-500">
                    ({project.tradedDaysCount || 0} / {project.Business_Days || 'N/A'} 日)
                  </div>
                </td>
                <td className="py-3 px-4 text-left">
                  <div className="flex items-center">
                    <span className="mr-2 text-xs w-12 text-right">{project.executionProgress.toFixed(1)}%</span>
                    <ProgressBar progress={project.executionProgress} color={project.Side === 'BUY' ? 'bg-green-500' : 'bg-red-500'} />
                  </div>
                   <div className="text-xs text-gray-500 truncate">
                    {project.Side === 'SELL' ?
                      `(${project.totalFilledQty?.toLocaleString() || 0} / ${project.Total_Shares?.toLocaleString() || 'N/A'} 株)` :
                      `(${project.totalFilledAmount?.toLocaleString() || 0} / ${project.Total_Amount?.toLocaleString() || 'N/A'} 円)`
                    }
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  {project.ProjectID ? (
                    <Link href={`/projects/${project.ProjectID}`} legacyBehavior>
                      <a className="text-indigo-600 hover:text-indigo-900 font-medium">詳細</a>
                    </Link>
                  ) : (
                    <span className="text-gray-400">詳細なし</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HomePage;