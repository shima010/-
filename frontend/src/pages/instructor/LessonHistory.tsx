import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { lessonsApi } from '../../api/client';

export default function InstructorLessonHistory() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['lessons', 'instructor', user?.id, dateFrom, dateTo],
    queryFn: () =>
      lessonsApi.getAll({
        instructorId: user?.id,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 100,
      }),
    enabled: !!user?.id,
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
    onError: (e: any) => alert(e.response?.data?.message || 'Cannot delete this record'),
  });

  const isToday = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Lesson History</h1>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="label">Date From</label>
            <input
              type="date"
              className="input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="label">Date To</label>
            <input
              type="date"
              className="input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card p-0">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold">{data?.total ?? 0} lessons</h2>
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
                  <th>Date</th>
                  <th>Student</th>
                  <th>Type</th>
                  <th>Ticket</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.records.map((lesson: any) => (
                  <tr key={lesson.id}>
                    <td>
                      <div className="text-sm">{new Date(lesson.executedAt).toLocaleDateString()}</div>
                      {isToday(lesson.executedAt) && (
                        <span className="text-xs text-blue-500">Today</span>
                      )}
                    </td>
                    <td className="font-medium">{lesson.student?.name}</td>
                    <td>
                      <span
                        className={`badge ${
                          lesson.lessonType === 'group' ? 'badge-blue' : 'badge-green'
                        }`}
                      >
                        {lesson.lessonType}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">
                      {lesson.ticket?.ticketType?.name}
                    </td>
                    <td>
                      {editingId === lesson.id ? (
                        <input
                          className="input text-xs py-1 w-32"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                        />
                      ) : (
                        <span className="text-sm text-gray-500">{lesson.notes || '—'}</span>
                      )}
                    </td>
                    <td>
                      {lesson.isConfirmed ? (
                        <span className="badge badge-green">Confirmed</span>
                      ) : (
                        <span className="badge badge-yellow">Pending</span>
                      )}
                    </td>
                    <td>
                      {!lesson.isConfirmed && isToday(lesson.executedAt) && (
                        <div className="flex gap-2">
                          {editingId === lesson.id ? (
                            <>
                              <button
                                onClick={() =>
                                  updateMutation.mutate({ id: lesson.id, data: { notes: editNotes } })
                                }
                                className="text-green-600 text-xs hover:underline"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-gray-500 text-xs hover:underline"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingId(lesson.id);
                                  setEditNotes(lesson.notes || '');
                                }}
                                className="text-blue-600 text-xs hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('Delete this lesson? Ticket will be restored.')) {
                                    deleteMutation.mutate(lesson.id);
                                  }
                                }}
                                className="text-red-600 text-xs hover:underline"
                              >
                                Delete
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
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      No lesson records found
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
