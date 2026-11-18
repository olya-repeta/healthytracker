import React from 'react';
import { User, Mail, Calendar, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TelegramNotificationCard } from './TelegramNotificationCard';

export const SettingsTab: React.FC = () => {
  const { user } = useAuth();

  const formattedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Налаштування та профіль
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Керуйте своїм обліковим записом, часовим поясом та сповіщеннями
        </p>
      </div>

      {/* 1. Картка сповіщень у Telegram */}
      <TelegramNotificationCard />

      {/* 2. Картка профілю користувача */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-sage-100 shadow-sm">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4">
          Дані облікового запису
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-sage-50/60 border border-sage-100 flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-white border border-sage-200 text-sage-700 flex items-center justify-center font-bold shadow-xs">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-10 h-10 rounded-xl object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-sage-600" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs text-slate-400 font-medium block">
                Ім'я
              </span>
              <p className="text-sm font-semibold text-slate-800 truncate">
                {user?.name || '—'}
              </p>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-sage-50/60 border border-sage-100 flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-white border border-sage-200 text-sage-700 flex items-center justify-center font-bold shadow-xs">
              <Mail className="w-5 h-5 text-sage-600" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs text-slate-400 font-medium block">
                Email
              </span>
              <p className="text-sm font-semibold text-slate-800 break-all">
                {user?.email || '—'}
              </p>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-sage-50/60 border border-sage-100 flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-white border border-sage-200 text-sage-700 flex items-center justify-center font-bold shadow-xs">
              <Calendar className="w-5 h-5 text-sage-600" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs text-slate-400 font-medium block">
                Дата реєстрації
              </span>
              <p className="text-sm font-semibold text-slate-800">
                {formattedDate}
              </p>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-sage-50/60 border border-sage-100 flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-white border border-sage-200 text-sage-700 flex items-center justify-center font-bold shadow-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs text-slate-400 font-medium block">
                Безпека
              </span>
              <p className="text-sm font-semibold text-emerald-700">
                Сесія активна (JWT)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
