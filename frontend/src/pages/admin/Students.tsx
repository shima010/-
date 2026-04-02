import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { studentsApi } from '../../api/client';

const STATUS_LABELS: Record<string, string> = {
  active: '在籍',
  suspended: '休会',
  withdrawn: '退会',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'badge-green',
  suspended: 'badge-yellow',
  withdrawn: 'badge-gray',
};

export default function AdminStudents() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['students', debouncedSearch, status],
    queryFn: () =>
      studentsApi.getAll({
        search: debouncedSearch || undefined,
        status: status || undefined,
        limit: 100,
      }),
    select: (r) => r.data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => studentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout((window as any)._searchTimeout);
    (window as any)._searchTimeout = setTimeout(() => setDebouncedSearch(value), 400);
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`生徒「${name}」を削除しますか？この操作は取り消せません。`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">生徒管理</h1>
      </div>

      {/* 検索・フィルター */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="氏名・メール・コースで検索..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="input flex-1"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input w-full sm:w-40"
          >
            <option value="">すべて</option>
            <option value="active">在籍</option>
            <option value="suspended">休会</option>
            <option value="withdrawn">退会</option>
          </select>
        </div>
      </div>

      {/* テーブル */}
      <div className="card p-0">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            {data?.total ?? 0} 名
          </h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="table-container rounded-none border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>メールアドレス</th>
                  <th>コース</th>
                  <th>ステータス</th>
                  <th>有効チケット</th>
                  <th>登録日</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.students.map((student: any) => (
                  <tr key={student.id}>
                    <td>
                      <Link
                        to={`/admin/students/${student.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {student.name}
                      </Link>
                    </td>
                    <td className="text-gray-600">{student.email}</td>
                    <td className="text-gray-600">{student.course || '—'}</td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[student.status] || 'badge-gray'}`}>
                        {STATUS_LABELS[student.status] || student.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="badge badge-blue">
                        {student._count?.tickets ?? 0} 枚
                      </span>
                    </td>
                    <td className="text-gray-500 text-sm">
                      {new Date(student.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/students/${student.id}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          詳細
                        </Link>
                        <button
                          onClick={() => handleDelete(student.id, student.name)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data?.students.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      生徒が見つかりません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
