import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { studentsApi, ticketsApi, lessonsApi } from '../../api/client';

interface GroupStudent {
  student: any;
  ticketId: number | null;
  tickets: any[];
}

export default function InstructorHome() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();

  // 個人レッスン用
  const [mode, setMode] = useState<'individual' | 'group'>('individual');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // グループレッスン用
  const [groupSearch, setGroupSearch] = useState('');
  const [groupStudents, setGroupStudents] = useState<GroupStudent[]>([]);
  const [groupNotes, setGroupNotes] = useState('');

  const { data: searchResults } = useQuery({
    queryKey: ['students', 'search', search],
    queryFn: () => studentsApi.getAll({ search, status: 'active', limit: 10 }),
    select: (r) => r.data,
    enabled: search.length > 1,
  });

  const { data: groupSearchResults } = useQuery({
    queryKey: ['students', 'groupSearch', groupSearch],
    queryFn: () => studentsApi.getAll({ search: groupSearch, status: 'active', limit: 10 }),
    select: (r) => r.data,
    enabled: groupSearch.length > 1,
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
      setSearch('');
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      queryClient.invalidateQueries({ queryKey: ['activeTickets'] });
    },
    onError: (e: any) => {
      setError(e.response?.data?.message || 'チケット消化に失敗しました');
      setSuccess('');
    },
  });

  const consumeGroupMutation = useMutation({
    mutationFn: (data: any) => lessonsApi.consumeGroup(data),
    onSuccess: () => {
      setSuccess(`グループレッスンを記録しました！（${groupStudents.length} 名）`);
      setError('');
      setGroupStudents([]);
      setGroupNotes('');
      setGroupSearch('');
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
    },
    onError: (e: any) => {
      setError(e.response?.data?.message || 'グループ消化に失敗しました');
      setSuccess('');
    },
  });

  const handleAddGroupStudent = async (student: any) => {
    if (groupStudents.some((gs) => gs.student.id === student.id)) {
      setGroupSearch('');
      return;
    }
    try {
      const res = await ticketsApi.getActiveTickets(student.id);
      setGroupStudents((prev) => [
        ...prev,
        { student, ticketId: res.data[0]?.id || null, tickets: res.data },
      ]);
    } catch {
      setGroupStudents((prev) => [
        ...prev,
        { student, ticketId: null, tickets: [] },
      ]);
    }
    setGroupSearch('');
  };

  const handleGroupTicketChange = (studentId: number, ticketId: number) => {
    setGroupStudents((prev) =>
      prev.map((gs) => gs.student.id === studentId ? { ...gs, ticketId } : gs),
    );
  };

  const handleConsume = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedTicketId) return;
    consumeMutation.mutate({
      studentId: selectedStudent.id,
      ticketId: selectedTicketId,
      lessonType: 'individual',
      notes: notes || undefined,
    });
  };

  const handleGroupConsume = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = groupStudents.filter((gs) => gs.ticketId !== null);
    if (valid.length === 0) {
      setError('参加生徒にチケットを選択してください');
      return;
    }
    consumeGroupMutation.mutate({
      students: valid.map((gs) => ({ studentId: gs.student.id, ticketId: gs.ticketId })),
      notes: groupNotes || undefined,
    });
  };

  const { data: todayLessons } = useQuery({
    queryKey: ['lessons', 'today', user?.id],
    queryFn: () => {
      const today = now.toISOString().split('T')[0];
      return lessonsApi.getAll({ instructorId: user?.id, dateFrom: today, dateTo: today, limit: 20 });
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
        {/* レッスン消化登録 */}
        <div className="card">
          {/* モード切替 */}
          <div className="flex mb-5 border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => { setMode('individual'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === 'individual' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              個人レッスン
            </button>
            <button
              onClick={() => { setMode('group'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === 'group' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              グループレッスン
            </button>
          </div>

          {/* 個人レッスン */}
          {mode === 'individual' && (
            <>
              <h2 className="font-semibold mb-4">個人レッスン消化登録</h2>
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
                        onClick={() => { setSelectedStudent(s); setSearch(''); }}
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
                    <label className="label">使用チケット</label>
                    {activeTickets?.length === 0 ? (
                      <p className="text-red-500 text-sm">有効なチケットがありません</p>
                    ) : (
                      <div className="space-y-2">
                        {activeTickets?.map((ticket: any) => (
                          <label
                            key={ticket.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                              selectedTicketId === ticket.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
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
                      className="input" rows={2} value={notes}
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
                      onClick={() => { setSelectedStudent(null); setSelectedTicketId(null); setSearch(''); }}
                      className="btn-secondary"
                    >
                      キャンセル
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* グループレッスン */}
          {mode === 'group' && (
            <>
              <h2 className="font-semibold mb-4">グループレッスン一括消化</h2>

              {/* 参加生徒追加 */}
              <div className="mb-4">
                <label className="label">参加生徒を追加</label>
                <input
                  type="text"
                  className="input"
                  placeholder="氏名を入力して追加..."
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                />
                {groupSearch.length > 1 && groupSearchResults?.students.length > 0 && (
                  <div className="border border-gray-200 rounded-lg mt-1 shadow-sm max-h-40 overflow-y-auto">
                    {groupSearchResults.students
                      .filter((s: any) => !groupStudents.some((gs) => gs.student.id === s.id))
                      .map((s: any) => (
                        <button
                          key={s.id}
                          onClick={() => handleAddGroupStudent(s)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-gray-500 ml-2">{s.course}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* 参加生徒リスト */}
              {groupStudents.length > 0 && (
                <form onSubmit={handleGroupConsume} className="space-y-3">
                  <p className="text-sm text-gray-600 font-medium">
                    参加生徒 {groupStudents.length} 名
                  </p>
                  {groupStudents.map((gs) => (
                    <div key={gs.student.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium text-sm">{gs.student.name}</span>
                          <span className="text-gray-500 text-xs ml-2">{gs.student.course}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setGroupStudents((p) => p.filter((x) => x.student.id !== gs.student.id))}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          削除
                        </button>
                      </div>
                      <select
                        className="input text-sm py-1"
                        value={gs.ticketId || ''}
                        onChange={(e) => handleGroupTicketChange(gs.student.id, parseInt(e.target.value))}
                      >
                        <option value="">チケットを選択...</option>
                        {gs.tickets.map((t: any) => (
                          <option key={t.id} value={t.id}>
                            {t.ticketType.name} (残{t.remainingCount}回)
                          </option>
                        ))}
                      </select>
                      {gs.tickets.length === 0 && (
                        <p className="text-red-500 text-xs mt-1">有効なチケットなし</p>
                      )}
                    </div>
                  ))}

                  <div>
                    <label className="label">メモ（任意）</label>
                    <textarea
                      className="input" rows={2} value={groupNotes}
                      onChange={(e) => setGroupNotes(e.target.value)}
                      placeholder="グループレッスン内容など..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={consumeGroupMutation.isPending}
                    className="btn-primary w-full"
                  >
                    {consumeGroupMutation.isPending ? '処理中...' : `${groupStudents.length}名を一括消化登録`}
                  </button>
                </form>
              )}

              {groupStudents.length === 0 && (
                <p className="text-center text-gray-400 py-8 text-sm">
                  上の検索ボックスから参加生徒を追加してください
                </p>
              )}
            </>
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
                <span className={`badge ${lesson.lessonType === 'group' ? 'badge-blue' : 'badge-green'}`}>
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
