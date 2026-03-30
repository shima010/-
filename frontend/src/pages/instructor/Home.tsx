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

  const { data: studentsData } = useQuery({
    queryKey: ['instructor-students', user?.id],
    queryFn: () => instructorsApi_getStudents(user!.id),
    enabled: !!user?.id,
    select: (r) => r.data,
  });

  // Simpler approach - get students through lesson history
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
      setSuccess(`Lesson recorded for ${selectedStudent?.name}!`);
      setError('');
      setSelectedStudent(null);
      setSelectedTicketId(null);
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      queryClient.invalidateQueries({ queryKey: ['activeTickets'] });
    },
    onError: (e: any) => {
      setError(e.response?.data?.message || 'Failed to consume ticket');
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
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}!</h1>
        <p className="text-gray-500 text-sm">Record today's lessons</p>
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
        {/* Quick consume */}
        <div className="card">
          <h2 className="font-semibold mb-4">Record Lesson</h2>

          {/* Student search */}
          <div className="mb-4">
            <label className="label">Search Student</label>
            <input
              type="text"
              className="input"
              placeholder="Type student name..."
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
                <label className="label">Lesson Type</label>
                <select
                  className="input"
                  value={lessonType}
                  onChange={(e) => setLessonType(e.target.value)}
                >
                  <option value="individual">Individual</option>
                  <option value="group">Group</option>
                </select>
              </div>

              <div>
                <label className="label">Select Ticket</label>
                {activeTickets?.length === 0 ? (
                  <p className="text-red-500 text-sm">No active tickets for this student</p>
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
                            {ticket.remainingCount} remaining · Expires{' '}
                            {new Date(ticket.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="label">Notes (optional)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Lesson notes..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!selectedTicketId || consumeMutation.isPending}
                  className="btn-primary flex-1"
                >
                  Record Lesson
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setSelectedTicketId(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Today's lessons */}
        <div className="card">
          <h2 className="font-semibold mb-4">
            Today's Lessons
            {todayLessons && (
              <span className="ml-2 badge badge-blue">{todayLessons.total}</span>
            )}
          </h2>
          <div className="space-y-2">
            {todayLessons?.records.map((lesson: any) => (
              <div key={lesson.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm">{lesson.student?.name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(lesson.executedAt).toLocaleTimeString()} ·{' '}
                    {lesson.ticket?.ticketType?.name}
                  </p>
                </div>
                <span
                  className={`badge ${
                    lesson.lessonType === 'group' ? 'badge-blue' : 'badge-green'
                  }`}
                >
                  {lesson.lessonType}
                </span>
              </div>
            ))}
            {!todayLessons?.records.length && (
              <p className="text-center text-gray-500 py-6 text-sm">No lessons today yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper - avoid circular import
async function instructorsApi_getStudents(id: number) {
  const { instructorsApi } = await import('../../api/client');
  return instructorsApi.getStudents(id);
}
