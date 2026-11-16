import React from 'react';
import { CalendarCheck2, PlusCircle, LogOut, Pill } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActiveTab = 'dashboard' | 'add-medication';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-sage-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Логотип */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sage-600 text-white flex items-center justify-center shadow-sm shadow-sage-600/20">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-slate-900 tracking-tight text-lg">
              VitaTrack
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-sage-100 text-sage-800 font-medium">
              Wellness & Meds
            </span>
          </div>
        </div>

        {/* Навігація між 2 основними вкладками */}
        <nav className="flex items-center gap-1.5 bg-sage-50 p-1 rounded-2xl border border-sage-100">
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-white text-sage-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarCheck2 className="w-4 h-4" />
            <span>Головна / Мій трекер</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('add-medication')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'add-medication'
                ? 'bg-sage-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Додати препарат</span>
          </button>
        </nav>

        {/* Інформація про користувача та вихід */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-sm font-semibold text-slate-800">
              {user?.name}
            </span>
            <span className="text-xs text-slate-500">{user?.email}</span>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Вийти з акаунту"
            className="p-2.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
