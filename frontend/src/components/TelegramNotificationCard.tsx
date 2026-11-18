import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { telegramApi } from '../api/telegram.api';

export const TelegramNotificationCard: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasOpenedLink, setHasOpenedLink] = useState(false);

  // Автоматичне визначення часового поясу браузера
  const detectedTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Kyiv';
    } catch {
      return 'Europe/Kyiv';
    }
  }, []);

  const isConnected = Boolean(user?.isTelegramConnected);
  const activeTimezone = user?.timezone || detectedTimezone;

  // Автоматичне оновлення профілю при поверненні фокусу на вікно вкладки
  useEffect(() => {
    const handleFocus = () => {
      refreshUser();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshUser]);

  const handleConnect = async () => {
    setError(null);
    setIsLinking(true);
    try {
      const { url } = await telegramApi.link(detectedTimezone);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        setHasOpenedLink(true);
      }
    } catch (err: any) {
      console.error('Помилка при генерації посилання Telegram:', err);
      setError(
        err?.response?.data?.message ||
          'Не вдалося згенерувати посилання на Telegram-бота. Перевірте з’єднання.'
      );
    } finally {
      setIsLinking(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !window.confirm(
        'Ви впевнені, що бажаєте відключити нагадування у Telegram?'
      )
    ) {
      return;
    }

    setError(null);
    setIsUnlinking(true);
    try {
      await telegramApi.unlink();
      await refreshUser();
      setHasOpenedLink(false);
    } catch (err: any) {
      console.error('Помилка при відключенні Telegram:', err);
      setError(
        err?.response?.data?.message ||
          'Не вдалося відключити Telegram. Спробуйте пізніше.'
      );
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-sage-200/80 shadow-sm transition-all">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shrink-0 shadow-xs">
            <Send className="w-6 h-6 text-sky-500 translate-x-[-1px] translate-y-[-1px]" />
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-bold text-slate-900">
                Сповіщення у Telegram
              </h3>
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Підключено
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                  Не підключено
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Отримуйте персональні нагадування про прийом ліків та вітамінів у
              Telegram у точний запланований час.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition"
          title="Перевірити статус підключення"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
          />
          <span>{isRefreshing ? 'Перевірка...' : 'Оновити статус'}</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm">
          {error}
        </div>
      )}

      {/* Інформація про часовий пояс */}
      <div className="bg-sage-50/70 rounded-2xl p-4 border border-sage-100 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-sage-600 shrink-0" />
          <span>
            Часовий пояс:{' '}
            <strong className="text-slate-800">{activeTimezone}</strong>
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          (Визначається автоматично для точного розкладу нагадувань)
        </span>
      </div>

      {isConnected ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Бот активний. Нагадування надходитимуть за 0 хвилин до прийому.
            </span>
          </div>

          <button
            type="button"
            disabled={isUnlinking}
            onClick={handleDisconnect}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition disabled:opacity-50"
          >
            {isUnlinking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>Відключити Telegram</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs sm:text-sm text-slate-600">
              Натисніть кнопку, щоб перейти до нашого бота у Telegram та
              натиснути <strong>«Start»</strong> для автоматичної активації:
            </div>

            <button
              type="button"
              disabled={isLinking}
              onClick={handleConnect}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-sky-500 hover:bg-sky-600 active:bg-sky-700 shadow-sm transition disabled:opacity-50"
            >
              {isLinking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Підключити Telegram</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>
          </div>

          {hasOpenedLink && (
            <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-100 text-xs text-sky-800 flex items-center justify-between gap-2">
              <span>
                👉 Посилання відкрито в новій вкладці. Після натискання «Start» у
                Telegram статус оновиться автоматично.
              </span>
              <button
                type="button"
                onClick={handleManualRefresh}
                className="underline font-semibold shrink-0 hover:text-sky-950"
              >
                Оновити зараз
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
