import { useQuery } from '@tanstack/react-query';
import { studentsApi, lessonsApi, ticketsApi } from '../../api/client';
import { Link } from 'react-router-dom';

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  return (
    <div className={`card border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="text-4xl opacity-60">{icon}</div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = `${yearMonth}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthEnd = `${yearMonth}-${lastDay}`;

  const { data: studentsData } = useQuery({
    queryKey: ['students', 'dashboard'],
    queryFn: () => studentsApi.getAll({ status: 'active', limit: 1 }),
    select: (r) => r.data,
  });

  const { data: lessonsData } = useQuery({
    queryKey: ['lessons', 'dashboard', yearMonth],
    queryFn: () =>
      lessonsApi.getAll({ dateFrom: monthStart, dateTo: monthEnd, limit: 1 }),
    select: (r) => r.data,
  });

  const { data: expiringData } = useQuery({
    queryKey: ['tickets', 'expiring'],
    queryFn: () => ticketsApi.getExpiring(7),
    select: (r) => r.data,
  });

  const { data: allStudents } = useQuery({
    queryKey: ['students', 'all'],
    queryFn: () => studentsApi.getAll({ limit: 1 }),
    select: (r) => r.data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">{yearMonth} Overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={allStudents?.total ?? '—'}
          icon="👨‍🎓"
          color="border-blue-500"
        />
        <StatCard
          title="Active Students"
          value={studentsData?.total ?? '—'}
          icon="✅"
          color="border-green-500"
        />
        <StatCard
          title="Lessons This Month"
          value={lessonsData?.total ?? '—'}
          icon="📝"
          color="border-purple-500"
        />
        <StatCard
          title="Expiring Tickets (7d)"
          value={expiringData?.length ?? '—'}
          icon="⚠️"
          color="border-yellow-500"
        />
      </div>

      {/* Expiring tickets alert */}
      {expiringData && expiringData.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              ⚠️ Expiring Tickets (Next 7 Days)
            </h2>
            <Link to="/admin/students" className="text-sm text-blue-600 hover:underline">
              View All Students →
            </Link>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Ticket Type</th>
                  <th>Remaining</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expiringData.slice(0, 10).map((ticket: any) => {
                  const daysLeft = Math.ceil(
                    (new Date(ticket.expiresAt).getTime() - now.getTime()) /
                      (1000 * 60 * 60 * 24),
                  );
                  return (
                    <tr key={ticket.id}>
                      <td>
                        <Link
                          to={`/admin/students/${ticket.student.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {ticket.student.name}
                        </Link>
                      </td>
                      <td className="text-gray-600">{ticket.ticketType.name}</td>
                      <td>
                        <span className="badge badge-yellow">
                          {ticket.remainingCount} remaining
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${daysLeft <= 3 ? 'badge-red' : 'badge-yellow'}`}
                        >
                          {daysLeft}d left
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: '/admin/students', label: 'Manage Students', icon: '👥', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700' },
          { to: '/admin/issue-ticket', label: 'Issue Ticket', icon: '🎫', color: 'bg-green-50 hover:bg-green-100 text-green-700' },
          { to: '/admin/lesson-records', label: 'Lesson Records', icon: '📋', color: 'bg-purple-50 hover:bg-purple-100 text-purple-700' },
          { to: '/admin/rewards', label: 'Rewards', icon: '💰', color: 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700' },
        ].map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`${link.color} p-5 rounded-xl text-center font-medium transition-colors`}
          >
            <div className="text-3xl mb-2">{link.icon}</div>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
