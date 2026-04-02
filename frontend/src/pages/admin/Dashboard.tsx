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
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-gray-500 text-sm mt-1">{yearMonth} 月次概要</p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="登録生徒数（合計）"
          value={allStudents?.total ?? '—'}
          icon="👨‍🎓"
          color="border-blue-500"
        />
        <StatCard
          title="在籍生徒数"
          value={studentsData?.total ?? '—'}
          icon="✅"
          color="border-green-500"
        />
        <StatCard
          title="今月のレッスン数"
          value={lessonsData?.total ?? '—'}
          icon="📝"
          color="border-purple-500"
        />
        <StatCard
          title="期限切れ間近（7日以内）"
          value={expiringData?.length ?? '—'}
          icon="⚠️"
          color="border-yellow-500"
        />
      </div>

      {/* 期限切れ間近チケットアラート */}
      {expiringData && expiringData.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              ⚠️ 期限切れ間近チケット（7日以内）
            </h2>
            <Link to="/admin/students" className="text-sm text-blue-600 hover:underline">
              生徒一覧を見る →
            </Link>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>生徒名</th>
                  <th>チケット種別</th>
                  <th>残回数</th>
                  <th>有効期限</th>
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
                          残{ticket.remainingCount}回
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${daysLeft <= 3 ? 'badge-red' : 'badge-yellow'}`}
                        >
                          あと{daysLeft}日
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

      {/* クイックリンク */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: '/admin/students', label: '生徒管理', icon: '👥', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700' },
          { to: '/admin/issue-ticket', label: 'チケット発行', icon: '🎫', color: 'bg-green-50 hover:bg-green-100 text-green-700' },
          { to: '/admin/lesson-records', label: 'レッスン実績', icon: '📋', color: 'bg-purple-50 hover:bg-purple-100 text-purple-700' },
          { to: '/admin/rewards', label: '報酬管理', icon: '💰', color: 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700' },
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
