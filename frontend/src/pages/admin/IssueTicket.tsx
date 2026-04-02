import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { studentsApi, ticketsApi } from '../../api/client';

const CATEGORY_LABELS: Record<string, string> = { monthly: '月謝', coupon: '回数券' };

export default function AdminIssueTicket() {
  const [searchParams] = useSearchParams();
  const preselectedStudentId = searchParams.get('studentId');
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>(preselectedStudentId ? [parseInt(preselectedStudentId)] : []);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<number | null>(null);
  const [issuedAt, setIssuedAt] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const { data: studentsData } = useQuery({
    queryKey: ['students', 'issue', search],
    queryFn: () => studentsApi.getAll({ status: 'active', search: search || undefined, limit: 50 }),
    select: (r) => r.data,
  });

  const { data: ticketTypes } = useQuery({
    queryKey: ['ticketTypes'],
    queryFn: () => ticketsApi.getTypes(),
    select: (r) => r.data,
  });

  const issueMutation = useMutation({
    mutationFn: (data: any) => ticketsApi.issue(data),
    onSuccess: () => {
      setSuccess(`${selectedStudentIds.length} 名にチケットを発行しました！`);
      setSelectedStudentIds([]); setSelectedTicketTypeId(null); setIssuedAt(''); setError('');
    },
    onError: (e: any) => { setError(e.response?.data?.message || 'チケット発行に失敗しました'); setSuccess(''); },
  });

  const toggleStudent = (id: number) =>
    setSelectedStudentIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const selectedTicketType = ticketTypes?.find((t: any) => t.id === selectedTicketTypeId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketTypeId || selectedStudentIds.length === 0) { setError('生徒とチケット種別を選択してください'); return; }
    issueMutation.mutate({ studentIds: selectedStudentIds, ticketTypeId: selectedTicketTypeId, issuedAt: issuedAt || undefined });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">チケット発行</h1>

      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">{success}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 生徒選択 */}
          <div className="card">
            <h2 className="font-semibold mb-4">
              発行先生徒を選択
              {selectedStudentIds.length > 0 && (
                <span className="ml-2 badge badge-blue">{selectedStudentIds.length} 名選択中</span>
              )}
            </h2>
            <input type="text" placeholder="氏名・コースで検索..." value={search} onChange={(e) => setSearch(e.target.value)} className="input mb-3" />
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {studentsData?.students.map((student: any) => (
                <label
                  key={student.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedStudentIds.includes(student.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} className="rounded" />
                  <div>
                    <p className="font-medium text-sm">{student.name}</p>
                    <p className="text-xs text-gray-500">{student.course || student.email}</p>
                  </div>
                  <span className="ml-auto badge badge-green text-xs">{student._count?.tickets ?? 0} 枚</span>
                </label>
              ))}
              {!studentsData?.students.length && <p className="text-center text-gray-500 py-4">生徒が見つかりません</p>}
            </div>
          </div>

          {/* チケット種別選択 */}
          <div className="card">
            <h2 className="font-semibold mb-4">チケット種別を選択</h2>
            <div className="space-y-3">
              {ticketTypes?.map((type: any) => (
                <label
                  key={type.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTicketTypeId === type.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <input type="radio" name="ticketType" checked={selectedTicketTypeId === type.id} onChange={() => setSelectedTicketTypeId(type.id)} className="mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{type.name}</p>
                    <p className="text-xs text-gray-500">
                      ¥{type.price.toLocaleString()} · {type.grantCount}回 · {type.validityDays}日間有効
                    </p>
                    <span className={`badge text-xs mt-1 ${type.category === 'monthly' ? 'badge-blue' : 'badge-green'}`}>
                      {CATEGORY_LABELS[type.category] || type.category}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">¥{type.price.toLocaleString()}</span>
                </label>
              ))}
              {!ticketTypes?.length && <p className="text-center text-gray-500 py-4">チケット種別がまだ登録されていません</p>}
            </div>
          </div>
        </div>

        {/* 発行オプション */}
        <div className="card">
          <h2 className="font-semibold mb-4">発行オプション</h2>
          <div>
            <label className="label">発行日（省略時は本日）</label>
            <input type="date" className="input w-48" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
          </div>
        </div>

        {/* 発行確認サマリー */}
        {selectedTicketType && selectedStudentIds.length > 0 && (
          <div className="card border-blue-200 bg-blue-50">
            <h2 className="font-semibold mb-3">発行確認</h2>
            <div className="text-sm space-y-1">
              <p><span className="text-gray-600">対象生徒数：</span><strong>{selectedStudentIds.length} 名</strong></p>
              <p><span className="text-gray-600">チケット種別：</span><strong>{selectedTicketType.name}</strong></p>
              <p><span className="text-gray-600">有効期限：</span><strong>発行日から {selectedTicketType.validityDays} 日間</strong></p>
              <p><span className="text-gray-600">発行総額：</span><strong className="text-blue-700">¥{(selectedTicketType.price * selectedStudentIds.length).toLocaleString()}</strong></p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={issueMutation.isPending || selectedStudentIds.length === 0 || !selectedTicketTypeId}
            className="btn-primary px-8 py-2.5"
          >
            {issueMutation.isPending ? '発行中...' : `${selectedStudentIds.length || ''} 名にチケットを発行する`}
          </button>
        </div>
      </form>
    </div>
  );
}
