import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  Star,
  Users,
  Pill,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  ExternalLink,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Heart,
} from 'lucide-react';
import { scheduleApi } from '../api/schedule.api';
import { ProductMetricsDto } from '../types/api';
import { MONOBANK_JAR_URL } from '../config/constants';
import { useAuth } from '../context/AuthContext';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Потребує покращення 😞',
  2: 'Так собі 😕',
  3: 'Нормально 😐',
  4: 'Добре 👍',
  5: 'Відмінно! 🌟',
};

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [metrics, setMetrics] = useState<ProductMetricsDto | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    setMetricsError(null);
    try {
      const data = await scheduleApi.getProductMetrics();
      setMetrics(data);
    } catch {
      setMetricsError('Не вдалося завантажити актуальні метрики з сервера.');
    } finally {
      setIsLoadingMetrics(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadMetrics();
      setSubmitSuccess(false);
      setSubmitError(null);
    }
  }, [isOpen, loadMetrics]);

  // Закриття через Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await scheduleApi.submitFeedback({
        type: 'feedback',
        rating,
        comment: comment.trim() || undefined,
      });
      setSubmitSuccess(true);
      setComment('');
      // Оновлюємо метрики, щоб одразу відобразити новий відгук
      loadMetrics();
    } catch {
      setSubmitError(
        'Не вдалося надіслати відгук. Перевірте зʼєднання або спробуйте пізніше.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    setDeletingId(feedbackId);
    try {
      await scheduleApi.deleteFeedback(feedbackId);
      await loadMetrics();
    } catch {
      setSubmitError("Не вдалося видалити відгук.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDonateClick = () => {
    // Неблокуючий фоновий запит трекінгу конверсії
    scheduleApi.trackDonateClick().catch(() => {
      // Фолбек для офлайну: не блокуємо користувача
    });
    // Невелике оновлення лічильника кліків локально для кращого відгуку UI
    setMetrics((prev) =>
      prev
        ? {
            ...prev,
            donateClicks: prev.donateClicks + 1,
            conversionPercent:
              prev.totalUsers > 0
                ? Math.round(
                    ((prev.donateClicks + 1) / prev.totalUsers) * 1000
                  ) / 10
                : 0,
          }
        : null
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-sage-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Шапка модалки */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-sage-100 bg-sage-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sage-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-800">
                Зворотний звʼязок та метрики продукту
              </h3>
              <p className="text-xs text-slate-500">
                Ваша думка допомагає покращувати VitaTrack щодня
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white transition"
            aria-label="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Тіло модалки зі скролом */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
          {/* Секція 1: Живі метрики валідації (KPI) продукту */}
          <div className="bg-gradient-to-br from-sage-50/80 to-white p-4 sm:p-5 rounded-2xl border border-sage-100 shadow-sm">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sage-600" />
                <h4 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-sage-800">
                  Метрики валідації продукту (KPI)
                </h4>
              </div>
              <button
                type="button"
                onClick={loadMetrics}
                disabled={isLoadingMetrics}
                className="inline-flex items-center gap-1 text-xs text-sage-600 hover:text-sage-800 transition disabled:opacity-50"
                title="Оновити метрики"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isLoadingMetrics ? 'animate-spin' : ''
                  }`}
                />
                <span>Оновити</span>
              </button>
            </div>

            {isLoadingMetrics && !metrics ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-white/70 rounded-xl animate-pulse border border-sage-100/60"
                  />
                ))}
              </div>
            ) : metricsError && !metrics ? (
              <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{metricsError}</span>
              </div>
            ) : metrics ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="bg-white p-3 rounded-xl border border-sage-100 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <Users className="w-3.5 h-3.5 text-sage-600" />
                    <span>Користувачі</span>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-slate-800">
                    {metrics.totalUsers}
                  </div>
                  <div className="text-[10px] text-slate-400">зареєстровано</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-sage-100 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <Pill className="w-3.5 h-3.5 text-sage-600" />
                    <span>Активні курси</span>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-slate-800">
                    {metrics.activeCourses}
                  </div>
                  <div className="text-[10px] text-slate-400">в процесі</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-sage-100 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Прийнято доз</span>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-slate-800">
                    {metrics.takenDoses}
                  </div>
                  <div className="text-[10px] text-slate-400">відмічено</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-sage-100 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                    <span>Day-7 Retention</span>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-slate-800">
                    {metrics.retentionPercent}%
                  </div>
                  <div className="text-[10px] text-slate-400">активні ≥ 7 днів</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-sage-100 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                    <span>Відгуків</span>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-slate-800">
                    {metrics.feedbackCount}
                  </div>
                  <div className="text-[10px] text-slate-400">отримано</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-sage-100 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span>Підтримка 🫙</span>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-slate-800">
                    {metrics.donateClicks}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    конверсія: {metrics.conversionPercent}%
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Секція 2: Форма зворотного зв'язку */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">
              Залишити відгук про додаток
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              Оцініть свій досвід використання та напишіть враження чи ідеї для нових функцій.
            </p>

            {submitSuccess ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-center space-y-2 animate-in fade-in">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-sm font-semibold">
                  Дякуємо за ваш відгук! 🌿
                </p>
                <p className="text-xs text-emerald-700">
                  Ваша оцінка та коментар допомагають нам робити VitaTrack зручнішим.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitSuccess(false)}
                  className="mt-2 text-xs font-medium text-emerald-700 underline hover:text-emerald-900"
                >
                  Написати ще один коментар
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                {/* Вибір зірочок */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Ваша оцінка:
                  </label>
                  <div className="flex items-center gap-1 sm:gap-2">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isActive = (hoverRating || rating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 rounded-lg transition hover:scale-110 focus:outline-none"
                          aria-label={`Оцінити на ${star} зірок`}
                        >
                          <Star
                            className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${
                              isActive
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300'
                            }`}
                          />
                        </button>
                      );
                    })}
                    <span className="text-xs font-medium text-slate-600 ml-2">
                      {RATING_LABELS[hoverRating || rating]}
                    </span>
                  </div>
                </div>

                {/* Поле коментаря */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label
                      htmlFor="feedback-comment"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Коментар чи пропозиція (необовʼязково):
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {comment.length}/1000
                    </span>
                  </div>
                  <textarea
                    id="feedback-comment"
                    rows={3}
                    maxLength={1000}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Наприклад: дуже подобаються сповіщення, але хотілося б мати додатковий віджет або експорт історії..."
                    className="w-full text-sm rounded-xl border border-slate-200 p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition"
                  />
                </div>

                {submitError && (
                  <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium text-sm shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Відправка...</span>
                    </>
                  ) : (
                    <span>Надіслати відгук</span>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Секція 2.5: Останні відгуки користувачів */}
          {metrics?.recentFeedbacks && metrics.recentFeedbacks.length > 0 && (
            <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-sage-600" />
                  <span>Останні відгуки користувачів</span>
                </h4>
                <span className="text-xs text-slate-400">
                  Показано {metrics.recentFeedbacks.length}
                </span>
              </div>
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {metrics.recentFeedbacks.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {item.authorName}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= item.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-200"
                            }`}
                          />
                          ))}
                        </div>
                        {user && item.userId === user.id && (
                          <button
                            type="button"
                            onClick={() => handleDeleteFeedback(item.id)}
                            disabled={deletingId === item.id}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                            title="Видалити свій відгук"
                            aria-label="Видалити свій відгук"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed break-words">
                      {item.comment}
                    </p>
                    <div className="text-[10px] text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString("uk-UA", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Секція 3: Донат на Монобанку всередині модалки */}
          <div className="bg-gradient-to-r from-amber-50/80 via-sage-50/70 to-emerald-50/80 p-4 sm:p-5 rounded-2xl border border-amber-200/60 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800">
                <span>🫙 Підтримка сервісу</span>
              </div>
              <p className="text-xs text-slate-600 max-w-md">
                VitaTrack розробляється без реклами. Ваш донат на банку Монобанку допомагає оплачувати сервери та надихає команду на нові фічі!
              </p>
            </div>
            <a
              href={MONOBANK_JAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleDonateClick}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs sm:text-sm shadow-md hover:shadow-lg transition group"
            >
              <span>Підтримати на Монобанку</span>
              <span className="text-base group-hover:scale-125 transition-transform">
                🫙
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
