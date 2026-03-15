import { NavLink, useNavigate } from 'react-router';
import { Logo } from './Logo';
import { LayoutGrid, Settings, User, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Sidebar() {
  const navigate = useNavigate();
  const { isOwner, logout } = useAuth();
  const navItems = [
    { path: '/library', icon: LayoutGrid, label: 'Library' },
    { path: '/settings', icon: Settings, label: 'Settings' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  if (isOwner) {
    navItems.push({ path: '/owner', icon: Shield, label: 'Owner Panel' });
  }

  return (
    <div className="w-20 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col items-center py-6 h-full relative z-20">
      <div className="mb-6">
        <Logo size={32} />
      </div>

      <div className="mb-8">
        <div className="bg-[#2563eb] text-white text-xs px-2.5 py-1 rounded-full font-medium shadow-lg shadow-[#2563eb]/20">
          4.0
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-3 w-full px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center justify-center w-full h-12 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-[#0a1628] text-white shadow-lg shadow-[#0a1628]/50 border border-[#152a45]'
                  : 'text-gray-400 hover:text-white hover:bg-[#0a1628]/50 hover:scale-105'
              }`
            }
          >
            <item.icon size={20} />
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => {
          logout();
          navigate('/');
        }}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-[#0f1623] text-gray-400 hover:text-white hover:bg-[#1a2332] transition-all duration-200 hover:scale-110 shadow-md"
      >
        <LogOut size={18} />
      </button>
    </div>
  );
}