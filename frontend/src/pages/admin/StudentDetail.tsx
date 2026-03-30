import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi, ticketsApi } from '../../api/client';

type Tab = 'info' | 'tickets' | 'lessons';

const STATUS_COLORS: Record<string, string> = {
  active: 'badge-green',
  suspended: 'badge-yellow',
  withdrawn: 'badge-gray',
  consumed: 'badge-gray',
  expired: 'badge-red',
  void: 'badge-red',
};

export default function AdminStudentDetail() {
  const { id } = useParams<{ id: string }>();
  const studentId = parseInt(id!);
  const [tab, setTab] = useState<Tab>('info');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const queryClient = useQueryClient();

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => studentsApi.getOne(studentId),
    select: (r) => r.data,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => studentsApi.update(studentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      setEditing(false);
    },
  });

  const handleEditStart = () => {
    if (student) {
      setEditForm({
        name: student.name,
        course: student.course || '',
        status: student.status,
      });
      setEditing(true);
    }
  };

  const handleEditSave = () => {
    updateMutation.mutate(editForm);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!student) return <div>Student not found</div>;

  const tabs = [
    { id: 'info' as Tab, label: 'Info' },
    { id: 'tickets' as Tab, label: `Tickets (${student.tickets?.length ?? 0})` },
    { id: 'lessons' as Tab, label: `Lessons (${student.lessonRecords?.length ?? 0})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/students" className="text-gray-500 hover:text-gray-700">
          ← Back to Students
        </Link>
      </div>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
            <p className="text-gray-500">{student.email}</p>
            <div className="flex gap-2 mt-2">
              <span className={`badge ${STATUS_COLORS[student.status]}`}>{student.status}</span>
              {student.course && <span className="badge badge-blue">{student.course}</span>}
            </div>
          </div>
          <button onClick={handleEditStart} className="btn-secondary text-sm">
            Edit
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="card border-blue-200">
          <h2 className="font-semibold mb-4">Edit Student</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Course</label>
              <input
                className="input"
                value={editForm.course}
                onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleEditSave} className="btn-primary text-sm">
              Save
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'info' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold mb-3">Student Info</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">ID</dt>
                <dd className="font-medium">#{student.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium">{student.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium">{student.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Course</dt>
                <dd className="font-medium">{student.course || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <span className={`badge ${STATUS_COLORS[student.status]}`}>
                    {student.status}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Joined</dt>
                <dd className="font-medium">
                  {new Date(student.createdAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-3">Quick Links</h3>
            <div className="space-y-2">
              <Link
                to={`/admin/issue-ticket?studentId=${student.id}`}
                className="btn-primary w-full text-sm"
              >
                🎫 Issue Ticket
              </Link>
              <Link
                to={`/admin/lesson-records?studentId=${student.id}`}
                className="btn-secondary w-full text-sm"
              >
                📝 View Lesson Records
              </Link>
            </div>
          </div>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="card p-0">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold">Ticket History</h2>
          </div>
          <div className="table-container rounded-none border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket Type</th>
                  <th>Issued</th>
                  <th>Expires</th>
                  <th>Count</th>
                  <th>Remaining</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {student.tickets?.map((ticket: any) => (
                  <tr key={ticket.id}>
                    <td className="font-medium">{ticket.ticketType?.name}</td>
                    <td className="text-gray-500">
                      {new Date(ticket.issuedAt).toLocaleDateString()}
                    </td>
                    <td className="text-gray-500">
                      {new Date(ticket.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="text-center">{ticket.initialCount}</td>
                    <td className="text-center">
                      <span
                        className={`badge ${
                          ticket.remainingCount > 0 ? 'badge-green' : 'badge-gray'
                        }`}
                      >
                        {ticket.remainingCount}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[ticket.status] || 'badge-gray'}`}>
                        {ticket.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!student.tickets?.length && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      No tickets
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'lessons' && (
        <div className="card p-0">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold">Recent Lessons</h2>
          </div>
          <div className="table-container rounded-none border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Instructor</th>
                  <th>Type</th>
                  <th>Ticket</th>
                  <th>Notes</th>
                  <th>Confirmed</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {student.lessonRecords?.map((lesson: any) => (
                  <tr key={lesson.id}>
                    <td>{new Date(lesson.executedAt).toLocaleDateString()}</td>
                    <td>{lesson.instructor?.name}</td>
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
                    <td className="text-gray-500 text-sm max-w-xs truncate">
                      {lesson.notes || '—'}
                    </td>
                    <td>
                      {lesson.isConfirmed ? (
                        <span className="badge badge-green">✓</span>
                      ) : (
                        <span className="badge badge-gray">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!student.lessonRecords?.length && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      No lesson records
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
