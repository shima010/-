import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { lessonsApi } from '../../api/client';

const LESSON_TYPE_LABELS: Record<string, string> = { individual: '個人', group: 'グループ' };

export default function AdminLessonRecords() {
  const [searchParams] = useSearchParams();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [studentId, setStudentId] = useState(searchParams.get('studentId') || '');
  const [instructorId, setInstructorId] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['lessons', dateFrom, dateTo, studentId, instructorId],
    queryFn: () =>
      lessonsApi.getAll({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        studentId: studentId ? parseInt(studentId) : undefined,
        instructorId: instructorId ? parseInt(instructorId) : undefined,
        limit: 100,
      }),
    select: (r) => r.data,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => lessonsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => lessonsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lessons'] }),
  });

  const handleEdit = (lesson: any) => {
    setEditingId(lesson.id);
    setEditNotes(lesson.notes || '');
  };

  const handleSave = (id: number) => {
    updateMutation.mutate({ id, data: { notes: editNotes } });
  };

  const handleDelete = (id: number) => {
    if (window.confirm('このレッスン記録を削除しますか？チケットは返還されます。')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">レッスン実績</h1>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">開始日</label>
            <input
              type="date"
              className="input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="label">終了日</label>
            <input
              type="date"
              className="input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div>
            <label className="label">生徒ID</label>
            <input
              type="number"
              className="input"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="生徒IDで絞り込み"
            />
          </div>
          <div>
            <label className="label">講師ID</label>
            <input
              type="number"
              className="input"
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              placeholder="講師IDで絞り込み"
            />
          </div>
        </div>
        <button
          onClick={() => { setDateFrom(''); setDateTo(''); setStudentId(''); setInstructorId(''); }}
          className="mt-3 text-sm text-gray-500 hover:text-gray-700"
        >
          フィルタをクリア
        </button>
      </div>

      {/* Table */}
      <div className="card p-0">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">{data?.total ?? 0} 件</h2>
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
                  <th>日時</th>
                  <th>生徒名</th>
                  <th>講師名</th>
                  <th>種別</th>
                  <th>チケット</th>
                  <th>メモ</th>
                  <th>状態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.records.map((lesson: any) => (
                  <tr key={lesson.id}>
                    <td>{new Date(lesson.executedAt).toLocaleDateString('ja-JP')}</td>
                    <td className="font-medium">{lesson.student?.name}</td>
                    <td className="text-gray-600">{lesson.instructor?.name}</td>
                    <td>
                      <span
                        className={`badge ${
                          lesson.lessonType === 'group' ? 'badge-blue' : 'badge-green'
                        }`}
                      >
                        {LESSON_TYPE_LABELS[lesson.lessonType] || lesson.lessonType}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">
                      {lesson.ticket?.ticketType?.name}
                    </td>
                    <td className="max-w-xs">
                      {editingId === lesson.id ? (
                        <input
                          className="input text-xs py-1"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                        />
                      ) : (
                        <span className="text-sm text-gray-500 truncate block max-w-xs">
                          {lesson.notes || '—'}
                        </span>
                      )}
                    </td>
                    <td>
                      {lesson.isConfirmed ? (
                        <span className="badge badge-green">確定済み</span>
                      ) : (
                        <span className="badge badge-yellow">未確定</span>
                      )}
                    </td>
                    <td>
                      {!lesson.isConfirmed && (
                        <div className="flex gap-2">
                          {editingId === lesson.id ? (
                            <>
                              <button
                                onClick={() => handleSave(lesson.id)}
                                className="text-green-600 hover:underline text-xs"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-gray-600 hover:underline text-xs"
                              >
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(lesson)}
                                className="text-blue-600 hover:underline text-xs"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDelete(lesson.id)}
                                className="text-red-600 hover:underline text-xs"
                              >
                                削除
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!data?.records.length && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      レッスン記録がありません
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
