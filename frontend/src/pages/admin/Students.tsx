import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { studentsApi } from '../../api/client';

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
    if (window.confirm(`Delete student "${name}"? This cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <Link to="/admin/students/new" className="btn-primary hidden">
          + Add Student
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by name, email, course..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="input flex-1"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input w-full sm:w-40"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            {data?.total ?? 0} students
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
                  <th>Name</th>
                  <th>Email</th>
                  <th>Course</th>
                  <th>Status</th>
                  <th>Active Tickets</th>
                  <th>Joined</th>
                  <th>Actions</th>
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
                        {student.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="badge badge-blue">
                        {student._count?.tickets ?? 0}
                      </span>
                    </td>
                    <td className="text-gray-500 text-sm">
                      {new Date(student.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/students/${student.id}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleDelete(student.id, student.name)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data?.students.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      No students found
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
