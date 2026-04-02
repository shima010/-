import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { studentsApi, ticketsApi, lessonsApi } from '../../api/client';

export default function InstructorHome() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [lessonType, setLessonType] = useState('individual');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: searchResults } = useQuery({
    queryKey: ['students', 'search', search],
    queryFn: () => studentsApi.getAll({ search: search || undefined, status: 'active', limit: 10 }),
    select: (r) => r.data,
    enabled: search.length > 1,
  });

  const { data: activeTickets } = useQuery({
    queryKey: ['activeTickets', selectedStudent?.id],
    queryFn: () => ticketsApi.getActiveTickets(selectedStudent.id),
    select: (r) => r.data,
    enabled: !!selectedStudent?.id,
  });

  const consumeMutation = useMutation({
    mutationFn: (data: any) => lessonsApi.consume(data),
    onSuccess: () => {
      setSuccess(`${selectedStudent?.name} さんのレッスンを記録しました！`);
      setError('');
      setSelectedStudent(null);
      setSelectedTicketId(null);
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      queryClient.invalidateQueries({ queryKey: ['activeTickets'] });
    },
    onError: (e: any) => {
      setError(e.response?.data?.message || 'チケット消化に失敗しました');
      setSuccess('');
    },
  });

  const handleConsume = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedTicketId) return;

    consumeMutation.mutate({
      studentId: selectedStudent.id,
      ticketId: selectedTicketId,
      lessonType,
      notes: notes || undefined,
    });
  };

  const now = new Date();

  const { data: todayLessons } = useQuery({
    queryKey: ['lessons', 'today', user?.id],
    queryFn: () => {
      const today = now.toISOString().split('T')[0];
      return lessonsApi.getAll({
        instructorId: user?.id,
        dateFrom: today,
        dateTo: today,
        limit: 20,
      });
    },
    enabled: !!user?.id,
    select: (r) => r.data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{user?.name} さん、こんにちは</h1>
        <p className="text-gray-500 text-sm">
          {now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* チケット消化登録 */}
        <div className="card">
          <h2 className="font-semibold mb-4">レッスン消化登録</h2>

          {/* 生徒検索 */}
          <div className="mb-4">
            <label className="label">生徒を検索</label>
            <input
              type="text"
              className="input"
              placeholder="氏名を入力..."
              value={selectedStudent ? selectedStudent.name : search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedStudent(null);
                setSelectedTicketId(null);
              }}
            />
            {search.length > 1 && !selectedStudent && searchResults?.students.length > 0 && (
              <div className="border border-gray-200 rounded-lg mt-1 shadow-sm max-h-40 overflow-y-auto">
                {searchResults.students.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedStudent(s);
                      setSearch('');
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="text-gray-500 ml-2">{s.course}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedStudent && (
            <form onSubmit={handleConsume} className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-medium text-blue-800">{selectedStudent.name}</p>
                <p className="text-xs text-blue-600">{selectedStudent.course}</p>
              </div>

              <div>
                <label className="label">レッスン形態</label>
                <select
                  className="input"
                  value={lessonType}
                  onChange={(e) => setLessonType(e.target.value)}
                >
                  <option value="individual">個人レッスン</option>
                  <option value="group">グループレッスン</option>
                </select>
              </div>

              <div>
                <label className="label">使用チケット</label>
                {activeTickets?.length === 0 ? (
                  <p className="text-red-500 text-sm">有効なチケットがありません</p>
                ) : (
                  <div className="space-y-2">
                    {activeTickets?.map((ticket: any) => (
                      <label
                        key={ticket.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                          selectedTicketId === ticket.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="ticket"
                          checked={selectedTicketId === ticket.id}
                          onChange={() => setSelectedTicketId(ticket.id)}
                        />
                        <div className="text-sm">
                          <p className="font-medium">{ticket.ticketType.name}</p>
                          <p className="text-gray-500">
                            残{ticket.remainingCount}回 · 有効期限{' '}
                            {new Date(ticket.expiresAt).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="label">メモ（任意）</label>
                <textarea
                  className="input"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="レッスン内容など..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!selectedTicketId || consumeMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {consumeMutation.isPending ? '処理中...' : '消化登録'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setSelectedTicketId(null);
                  }}
                  className="btn-secondary"
                >
                  キャンセル
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 本日のレッスン */}
        <div className="card">
          <h2 className="font-semibold mb-4">
            本日のレッスン
            {todayLessons && (
              <span className="ml-2 badge badge-blue">{todayLessons.total} 件</span>
            )}
          </h2>
          <div className="space-y-2">
            {todayLessons?.records.map((lesson: any) => (
              <div key={lesson.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm">{lesson.student?.name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(lesson.executedAt).toLocaleTimeString('ja-JP')} ·{' '}
                    {lesson.ticket?.ticketType?.name}
                  </p>
                </div>
                <span
                  className={`badge ${
                    lesson.lessonType === 'group' ? 'badge-blue' : 'badge-green'
                  }`}
                >
                  {lesson.lessonType === 'group' ? 'グループ' : '個人'}
                </span>
              </div>
            ))}
            {!todayLessons?.records.length && (
              <p className="text-center text-gray-500 py-6 text-sm">本日のレッスン記録はまだありません</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
