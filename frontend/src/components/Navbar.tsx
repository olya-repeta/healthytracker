import React, { useEffect, useState } from 'react';
import {
  CalendarCheck2,
  PlusCircle,
  LogOut,
  Pill,
  Download,
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActiveTab = 'dashboard' | 'add-medication' | 'settings';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab }) => {
  const { user, logout } = useAuth();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

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

          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'settings'
                ? 'bg-white text-sage-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Налаштування</span>
          </button>
        </nav>

        {/* Кнопка встановлення PWA, інформація про користувача та кнопка виходу */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {deferredPrompt && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-sage-100 hover:bg-sage-200 text-sage-800 border border-sage-200 transition"
              title="Встановити VitaTrack як додаток на пристрій"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Встановити додаток</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            className="hidden md:flex flex-col items-end text-right hover:opacity-80 transition cursor-pointer"
            title="Перейти до налаштувань профілю"
          >
            <span className="text-sm font-semibold text-slate-800">
              {user?.name}
            </span>
            <span className="text-xs text-slate-500">{user?.email}</span>
          </button>
          <button
            type="button"
            onClick={logout}
            title="Вийти з акаунту"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Вийти</span>
          </button>
        </div>
      </div>
    </header>
  );
};
