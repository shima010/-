import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instructorsApi } from '../../api/client';

const REWARD_LABELS: Record<string, string> = { fixed: '固定単価', percentage: '歩合' };
const EMPLOYMENT_LABELS: Record<string, string> = { fulltime: '常勤', parttime: '非常勤', contract: '契約' };

interface InstructorForm {
  name: string; email: string; password: string;
  rewardType: string; employmentType: string;
}
const defaultForm: InstructorForm = { name: '', email: '', password: '', rewardType: 'fixed', employmentType: 'parttime' };

export default function AdminInstructors() {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<InstructorForm>(defaultForm);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.getAll({ limit: 100 }),
    select: (r) => r.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => instructorsApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['instructors'] }); setShowModal(false); setForm(defaultForm); },
    onError: (e: any) => setError(e.response?.data?.message || 'エラーが発生しました'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => instructorsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['instructors'] }); setShowModal(false); setEditingId(null); setForm(defaultForm); },
    onError: (e: any) => setError(e.response?.data?.message || 'エラーが発生しました'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => instructorsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructors'] }),
  });

  const handleOpenEdit = (instructor: any) => {
    setForm({ name: instructor.name, email: instructor.email, password: '', rewardType: instructor.rewardType, employmentType: instructor.employmentType });
    setEditingId(instructor.id); setError(''); setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form };
    if (!data.password) delete (data as any).password;
    if (editingId) { updateMutation.mutate({ id: editingId, data }); } else { createMutation.mutate(data); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">講師管理</h1>
        <button onClick={() => { setForm(defaultForm); setEditingId(null); setError(''); setShowModal(true); }} className="btn-primary">+ 講師を追加</button>
      </div>

      <div className="card p-0">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">{data?.total ?? 0} 名</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : (
          <div className="table-container rounded-none border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>氏名</th><th>メール</th><th>報酬計算方式</th><th>雇用形態</th><th>担当レッスン</th><th>操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.instructors.map((instructor: any) => (
                  <tr key={instructor.id}>
                    <td className="font-medium">{instructor.name}</td>
                    <td className="text-gray-600">{instructor.email}</td>
                    <td>
                      <span className={`badge ${instructor.rewardType === 'fixed' ? 'badge-blue' : 'badge-green'}`}>
                        {REWARD_LABELS[instructor.rewardType] || instructor.rewardType}
                      </span>
                    </td>
                    <td className="text-gray-600">{EMPLOYMENT_LABELS[instructor.employmentType] || instructor.employmentType}</td>
                    <td className="text-center"><span className="badge badge-gray">{instructor._count?.lessonRecords ?? 0} 件</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => handleOpenEdit(instructor)} className="text-blue-600 hover:underline text-sm">編集</button>
                        <button onClick={() => { if (window.confirm(`講師「${instructor.name}」を削除しますか？`)) deleteMutation.mutate(instructor.id); }} className="text-red-600 hover:underline text-sm">削除</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!data?.instructors.length && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500">講師が登録されていません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editingId ? '講師情報を編集' : '講師を新規追加'}</h2>
            {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">氏名 *</label>
                <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="山田 花子" />
              </div>
              <div>
                <label className="label">メールアドレス *</label>
                <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">{editingId ? 'パスワード（変更する場合のみ）' : 'パスワード *'}</label>
                <input className="input" type="password" required={!editingId} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">報酬計算方式</label>
                  <select className="input" value={form.rewardType} onChange={(e) => setForm({ ...form, rewardType: e.target.value })}>
                    <option value="fixed">固定単価</option>
                    <option value="percentage">歩合</option>
                  </select>
                </div>
                <div>
                  <label className="label">雇用形態</label>
                  <select className="input" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                    <option value="fulltime">常勤</option>
                    <option value="parttime">非常勤</option>
                    <option value="contract">契約</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary flex-1">
                  {editingId ? '更新する' : '追加する'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
