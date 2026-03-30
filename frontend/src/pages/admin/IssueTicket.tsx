import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { studentsApi, ticketsApi } from '../../api/client';

export default function AdminIssueTicket() {
  const [searchParams] = useSearchParams();
  const preselectedStudentId = searchParams.get('studentId');

  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>(
    preselectedStudentId ? [parseInt(preselectedStudentId)] : [],
  );
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
      setSuccess(
        `Successfully issued ticket to ${selectedStudentIds.length} student(s)!`,
      );
      setSelectedStudentIds([]);
      setSelectedTicketTypeId(null);
      setIssuedAt('');
      setError('');
    },
    onError: (e: any) => {
      setError(e.response?.data?.message || 'Failed to issue ticket');
      setSuccess('');
    },
  });

  const toggleStudent = (id: number) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const selectedTicketType = ticketTypes?.find((t: any) => t.id === selectedTicketTypeId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketTypeId || selectedStudentIds.length === 0) {
      setError('Please select at least one student and a ticket type');
      return;
    }

    issueMutation.mutate({
      studentIds: selectedStudentIds,
      ticketTypeId: selectedTicketTypeId,
      issuedAt: issuedAt || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Issue Ticket</h1>

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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Student selection */}
          <div className="card">
            <h2 className="font-semibold mb-4">
              Select Student(s)
              {selectedStudentIds.length > 0 && (
                <span className="ml-2 badge badge-blue">
                  {selectedStudentIds.length} selected
                </span>
              )}
            </h2>
            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input mb-3"
            />
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {studentsData?.students.map((student: any) => (
                <label
                  key={student.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedStudentIds.includes(student.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(student.id)}
                    onChange={() => toggleStudent(student.id)}
                    className="rounded"
                  />
                  <div>
                    <p className="font-medium text-sm">{student.name}</p>
                    <p className="text-xs text-gray-500">{student.course || student.email}</p>
                  </div>
                  <span className="ml-auto badge badge-green text-xs">
                    {student._count?.tickets ?? 0} active
                  </span>
                </label>
              ))}
              {!studentsData?.students.length && (
                <p className="text-center text-gray-500 py-4">No students found</p>
              )}
            </div>
          </div>

          {/* Ticket type selection */}
          <div className="card">
            <h2 className="font-semibold mb-4">Select Ticket Type</h2>
            <div className="space-y-3">
              {ticketTypes?.map((type: any) => (
                <label
                  key={type.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTicketTypeId === type.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="ticketType"
                    checked={selectedTicketTypeId === type.id}
                    onChange={() => setSelectedTicketTypeId(type.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{type.name}</p>
                    <p className="text-xs text-gray-500">
                      ¥{type.price.toLocaleString()} · {type.grantCount} lessons · {type.validityDays} days
                    </p>
                    <span
                      className={`badge text-xs mt-1 ${
                        type.category === 'monthly' ? 'badge-blue' : 'badge-green'
                      }`}
                    >
                      {type.category}
                    </span>
                  </div>
                </label>
              ))}
              {!ticketTypes?.length && (
                <p className="text-center text-gray-500 py-4">
                  No ticket types. Create one in Ticket Types.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="card">
          <h2 className="font-semibold mb-4">Options</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Issue Date (optional)</label>
              <input
                type="date"
                className="input"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank for today</p>
            </div>
          </div>
        </div>

        {/* Summary & Submit */}
        {selectedTicketType && selectedStudentIds.length > 0 && (
          <div className="card border-blue-200 bg-blue-50">
            <h2 className="font-semibold mb-3">Summary</h2>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-gray-500">Students:</span>{' '}
                <strong>{selectedStudentIds.length}</strong>
              </p>
              <p>
                <span className="text-gray-500">Ticket:</span>{' '}
                <strong>{selectedTicketType.name}</strong>
              </p>
              <p>
                <span className="text-gray-500">Total Amount:</span>{' '}
                <strong className="text-blue-700">
                  ¥{(selectedTicketType.price * selectedStudentIds.length).toLocaleString()}
                </strong>
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={
              issueMutation.isPending ||
              selectedStudentIds.length === 0 ||
              !selectedTicketTypeId
            }
            className="btn-primary px-8 py-2.5"
          >
            {issueMutation.isPending ? 'Issuing...' : 'Issue Ticket(s)'}
          </button>
        </div>
      </form>
    </div>
  );
}
