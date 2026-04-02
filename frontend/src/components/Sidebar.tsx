import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const adminNav: NavItem[] = [
  { label: 'ダッシュボード', path: '/admin', icon: '📊' },
  { label: '生徒管理', path: '/admin/students', icon: '👨‍🎓' },
  { label: '講師管理', path: '/admin/instructors', icon: '👨‍🏫' },
  { label: 'チケット種別', path: '/admin/ticket-types', icon: '🎫' },
  { label: 'チケット発行', path: '/admin/issue-ticket', icon: '➕' },
  { label: 'レッスン実績', path: '/admin/lesson-records', icon: '📝' },
  { label: '報酬管理', path: '/admin/rewards', icon: '💰' },
  { label: '監査ログ', path: '/admin/audit-logs', icon: '🔍' },
];

const instructorNav: NavItem[] = [
  { label: 'ホーム', path: '/instructor', icon: '🏠' },
  { label: 'レッスン履歴', path: '/instructor/lesson-history', icon: '📋' },
  { label: '担当生徒', path: '/instructor/my-students', icon: '👥' },
  { label: '報酬確認', path: '/instructor/my-rewards', icon: '💴' },
];

const studentNav: NavItem[] = [
  { label: 'マイページ', path: '/student', icon: '🎵' },
  { label: '受講履歴', path: '/student/lesson-history', icon: '📅' },
];

const navMap: Record<string, NavItem[]> = {
  admin: adminNav,
  instructor: instructorNav,
  student: studentNav,
};

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navItems = user ? navMap[user.role] || [] : [];

  const roleLabel: Record<string, string> = {
    admin: '管理者',
    instructor: '講師',
    student: '生徒',
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* ロゴ */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700">
        <div>
          <h1 className="text-lg font-bold text-white">音楽教室</h1>
          <p className="text-xs text-gray-400">チケット管理システム</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white lg:hidden">
            ✕
          </button>
        )}
      </div>

      {/* ユーザー情報 */}
      {user && (
        <div className="px-6 py-4 border-b border-gray-700">
          <p className="text-sm font-medium text-white truncate">{user.name}</p>
          <p className="text-xs text-gray-400">{roleLabel[user.role]}</p>
        </div>
      )}

      {/* ナビゲーション */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin' || item.path === '/instructor' || item.path === '/student'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* ログアウト */}
      <div className="px-4 py-4 border-t border-gray-700">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span>🚪</span>
          ログアウト
        </button>
      </div>
    </div>
  );
}
