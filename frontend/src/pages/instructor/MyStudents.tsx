import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { instructorsApi } from '../../api/client';
import { Link } from 'react-router-dom';

export default function InstructorMyStudents() {
  const { user } = useAuth();

  const { data: students, isLoading } = useQuery({
    queryKey: ['instructor-students', user?.id],
    queryFn: () => instructorsApi.getStudents(user!.id),
    enabled: !!user?.id,
    select: (r) => r.data,
  });

  const STATUS_COLORS: Record<string, string> = {
    active: 'badge-green',
    suspended: 'badge-yellow',
    withdrawn: 'badge-gray',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Students</h1>
      <p className="text-gray-500 text-sm">Students you have taught lessons to.</p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students?.map((student: any) => (
            <div key={student.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{student.name}</h3>
                  <p className="text-sm text-gray-500">{student.email}</p>
                </div>
                <span className={`badge ${STATUS_COLORS[student.status] || 'badge-gray'}`}>
                  {student.status}
                </span>
              </div>
              {student.course && (
                <p className="text-sm text-blue-600">
                  <span className="text-gray-500">Course:</span> {student.course}
                </p>
              )}
            </div>
          ))}
          {!students?.length && (
            <div className="col-span-3 text-center py-12 text-gray-500">
              No students assigned yet. Record a lesson to see students here.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
