import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { useAuth } from '../context/AuthContext';

const themeOverlays = {
  overlay: 'from-gray-600/5 to-gray-900/20',
  abyssal: 'from-blue-800/10 to-blue-950/30',
  slate: 'from-gray-700/10 to-slate-950/30',
  solar: 'from-orange-700/10 to-yellow-950/30',
  blood: 'from-red-800/10 to-red-950/30',
  violet: 'from-purple-800/10 to-violet-950/30',
  emerald: 'from-emerald-800/10 to-green-950/30',
  sun: 'from-orange-600/10 to-red-950/30',
  plasma: 'from-yellow-600/10 to-amber-950/30',
} as const;

export function DashboardLayout() {
  const { theme } = useAuth();

  return (
    <div className="w-full h-full box-border bg-[#0d0d0d] flex overflow-hidden rounded-2xl relative">
      <div className={`absolute inset-0 bg-gradient-to-br ${themeOverlays[theme as keyof typeof themeOverlays] || themeOverlays.overlay} pointer-events-none z-10`} />
      <Sidebar />
      <div className="flex-1 overflow-y-auto relative z-20">
        <Outlet />
      </div>
    </div>
  );
}