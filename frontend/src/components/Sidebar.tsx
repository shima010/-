import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: '📊' },
  { label: 'Students', path: '/admin/students', icon: '👨‍🎓' },
  { label: 'Instructors', path: '/admin/instructors', icon: '👨‍🏫' },
  { label: 'Ticket Types', path: '/admin/ticket-types', icon: '🎫' },
  { label: 'Issue Ticket', path: '/admin/issue-ticket', icon: '➕' },
  { label: 'Lesson Records', path: '/admin/lesson-records', icon: '📝' },
  { label: 'Rewards', path: '/admin/rewards', icon: '💰' },
];

const instructorNav: NavItem[] = [
  { label: 'Home', path: '/instructor', icon: '🏠' },
  { label: 'Lesson History', path: '/instructor/lesson-history', icon: '📋' },
  { label: 'My Students', path: '/instructor/my-students', icon: '👥' },
  { label: 'My Rewards', path: '/instructor/my-rewards', icon: '💴' },
];

const studentNav: NavItem[] = [
  { label: 'My Page', path: '/student', icon: '🎵' },
  { label: 'Lesson History', path: '/student/lesson-history', icon: '📅' },
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
    admin: 'Administrator',
    instructor: 'Instructor',
    student: 'Student',
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700">
        <div>
          <h1 className="text-lg font-bold text-white">Music School</h1>
          <p className="text-xs text-gray-400">Ticket Management</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white lg:hidden">
            ✕
          </button>
        )}
      </div>

      {/* User info */}
      {user && (
        <div className="px-6 py-4 border-b border-gray-700">
          <p className="text-sm font-medium text-white truncate">{user.name}</p>
          <p className="text-xs text-gray-400">{roleLabel[user.role]}</p>
        </div>
      )}

      {/* Navigation */}
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

      {/* Logout */}
      <div className="px-4 py-4 border-t border-gray-700">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span>🚪</span>
          Logout
        </button>
      </div>
    </div>
  );
}
