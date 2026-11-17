import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  X,
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  TrendingUp,
  Plus,
  ExternalLink,
  History,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { scheduleApi } from '../api/schedule.api';
import {
  AdherenceStatsResponseDto,
  DaySummaryDto,
  DoseItemDto,
  DoseStatus,
} from '../types/api';

interface DashboardTabProps {
  onNavigateToAdd: () => void;
}

const OFFLINE_TODAY_DOSES_KEY = 'vitatrack_offline_today_doses';
const OFFLINE_DASHBOARD_META_KEY = 'vitatrack_offline_dashboard_meta';
const OFFLINE_SYNC_QUEUE_KEY = 'vitatrack_offline_sync_queue';

interface OfflineTodayCache {
  savedAt: string;
  date: string;
  doses: DoseItemDto[];
}

interface OfflineDashboardMetaCache {
  savedAt: string;
  daysMap: Record<string, DaySummaryDto>;
  stats: AdherenceStatsResponseDto | null;
}

export interface OfflineSyncQueueItem {
  doseId: string;
  status: DoseStatus;
  timestamp: string;
}

const UKRAINIAN_MONTHS = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
];

const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatReadableDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
  });
}

function readSyncQueue(): OfflineSyncQueueItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineSyncQueueItem[]) : [];
  } catch {
    return [];
  }
}

function writeSyncQueue(queue: OfflineSyncQueueItem[]): void {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(OFFLINE_SYNC_QUEUE_KEY);
    } else {
      localStorage.setItem(OFFLINE_SYNC_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch {
    // Ігноруємо помилки localStorage
  }
}

function enqueueOfflineDoseAction(
  doseId: string,
  status: DoseStatus
): OfflineSyncQueueItem[] {
  const current = readSyncQueue();
  const existingIdx = current.findIndex((item) => item.doseId === doseId);
  const entry: OfflineSyncQueueItem = {
    doseId,
    status,
    timestamp: new Date().toISOString(),
  };

  let nextQueue: OfflineSyncQueueItem[];
  if (existingIdx >= 0) {
    nextQueue = [...current];
    nextQueue[existingIdx] = entry;
  } else {
    nextQueue = [...current, entry];
  }

  writeSyncQueue(nextQueue);
  return nextQueue;
}

function overlayQueueOnDoses(
  doses: DoseItemDto[],
  queue: OfflineSyncQueueItem[]
): DoseItemDto[] {
  if (queue.length === 0) return doses;
  const map = new Map(queue.map((q) => [q.doseId, q.status]));
  return doses.map((d) => {
    const queuedStatus = map.get(d.id);
    return queuedStatus ? { ...d, status: queuedStatus } : d;
  });
}

function recalculateDaySummary(
  daySummary: DaySummaryDto,
  updatedDoses: DoseItemDto[]
): DaySummaryDto {
  const total = updatedDoses.length;
  const taken = updatedDoses.filter((d) => d.status === 'TAKEN').length;
  const skipped = updatedDoses.filter((d) => d.status === 'SKIPPED').length;
  const pending = updatedDoses.filter((d) => d.status === 'PENDING').length;
  return {
    ...daySummary,
    total,
    taken,
    skipped,
    pending,
    allCompleted: total > 0 && taken === total,
    hasSkipped: skipped > 0,
    doses: updatedDoses,
  };
}

function readOfflineTodayCache(): DoseItemDto[] {
  try {
    const raw = localStorage.getItem(OFFLINE_TODAY_DOSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineTodayCache;
    const base = Array.isArray(parsed.doses) ? parsed.doses : [];
    return overlayQueueOnDoses(base, readSyncQueue());
  } catch {
    return [];
  }
}

function readOfflineMetaCache(): OfflineDashboardMetaCache | null {
  try {
    const raw = localStorage.getItem(OFFLINE_DASHBOARD_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineDashboardMetaCache;
    const queue = readSyncQueue();
    if (queue.length > 0 && parsed.daysMap) {
      const updatedDaysMap: Record<string, DaySummaryDto> = {};
      for (const [dateKey, dayGroup] of Object.entries(parsed.daysMap)) {
        const overlaid = overlayQueueOnDoses(dayGroup.doses, queue);
        updatedDaysMap[dateKey] = recalculateDaySummary(dayGroup, overlaid);
      }
      parsed.daysMap = updatedDaysMap;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  onNavigateToAdd,
}) => {
  const todayStr = useMemo(() => toDateStr(new Date()), []);

  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [syncQueueCount, setSyncQueueCount] = useState<number>(() => {
    return readSyncQueue().length;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month');
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [daysMap, setDaysMap] = useState<Record<string, DaySummaryDto>>(() => {
    return readOfflineMetaCache()?.daysMap || {};
  });
  const [todayDoses, setTodayDoses] = useState<DoseItemDto[]>(() => {
    return readOfflineTodayCache();
  });
  const [selectedDateDoses, setSelectedDateDoses] = useState<DoseItemDto[]>(
    () => {
      return readOfflineTodayCache();
    }
  );
  const [stats, setStats] = useState<AdherenceStatsResponseDto | null>(() => {
    return readOfflineMetaCache()?.stats || null;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Обчислюємо діапазон дат для завантаження календаря та бічної панелі
  const { rangeFrom, rangeTo, calendarCells } = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = (firstDayOfMonth.getDay() + 6) % 7;

    const gridStart = new Date(year, month, 1 - startWeekday);
    const cells: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
    }[] = [];

    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i
      );
      cells.push({
        dateStr: toDateStr(cellDate),
        dayNumber: cellDate.getDate(),
        isCurrentMonth: cellDate.getMonth() === month,
      });
    }

    return {
      rangeFrom: cells[0].dateStr,
      rangeTo: cells[cells.length - 1].dateStr,
      calendarCells: cells,
    };
  }, [currentMonthDate]);

  // Якщо режим "Тиждень", показуємо тиждень, який містить selectedDate
  const visibleCalendarCells = useMemo(() => {
    if (calendarView === 'month') {
      return calendarCells;
    }
    const idx = calendarCells.findIndex((c) => c.dateStr === selectedDate);
    if (idx === -1) {
      return calendarCells.slice(0, 7);
    }
    const weekRowStart = Math.floor(idx / 7) * 7;
    return calendarCells.slice(weekRowStart, weekRowStart + 7);
  }, [calendarCells, calendarView, selectedDate]);

  const loadFromOfflineCache = useCallback(() => {
    const cachedToday = readOfflineTodayCache();
    const cachedMeta = readOfflineMetaCache();

    setTodayDoses(cachedToday);
    if (cachedMeta) {
      setDaysMap(cachedMeta.daysMap);
      setStats(cachedMeta.stats);
      if (selectedDate === todayStr) {
        setSelectedDateDoses(cachedToday);
      } else {
        setSelectedDateDoses(cachedMeta.daysMap[selectedDate]?.doses || []);
      }
    } else {
      setSelectedDateDoses(selectedDate === todayStr ? cachedToday : []);
    }
  }, [selectedDate, todayStr]);

  /**
   * Надсилає накопичені в офлайні зміни статусів доз на сервер по черзі
   */
  const flushOfflineSyncQueue = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    const queue = readSyncQueue();
    if (queue.length === 0 || isSyncingRef.current) {
      return false;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);

    const remaining: OfflineSyncQueueItem[] = [...queue];
    try {
      for (const item of queue) {
        await scheduleApi.updateStatus(item.doseId, item.status);
        remaining.shift();
        writeSyncQueue(remaining);
        setSyncQueueCount(remaining.length);
      }
      return true;
    } catch (err) {
      console.warn(
        'Не вдалося синхронізувати частину офлайн-черги (повторимо при відновленні зв’язку):',
        err
      );
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOffline(true);
      }
      return false;
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      loadFromOfflineCache();
      setLoading(false);
      return;
    }

    try {
      // Якщо є несинхронізовані дії з офлайну — спочатку відправляємо їх на бекенд
      if (readSyncQueue().length > 0) {
        await flushOfflineSyncQueue();
      }

      const [rangeRes, todayRes, selectedRes, statsRes] = await Promise.all([
        scheduleApi.getByRange(rangeFrom, rangeTo),
        scheduleApi.getByDate(todayStr),
        selectedDate === todayStr
          ? Promise.resolve(null)
          : scheduleApi.getByDate(selectedDate),
        scheduleApi.getStats(todayStr),
      ]);

      setIsOffline(false);
      const pendingQueue = readSyncQueue();
      setSyncQueueCount(pendingQueue.length);

      const finalTodayDoses = overlayQueueOnDoses(todayRes.doses, pendingQueue);
      const finalSelectedDoses = overlayQueueOnDoses(
        selectedRes ? selectedRes.doses : todayRes.doses,
        pendingQueue
      );

      const finalDaysMap: Record<string, DaySummaryDto> = {};
      for (const [dateKey, daySummary] of Object.entries(rangeRes.days)) {
        const overlaid = overlayQueueOnDoses(daySummary.doses, pendingQueue);
        finalDaysMap[dateKey] = recalculateDaySummary(daySummary, overlaid);
      }

      setDaysMap(finalDaysMap);
      setTodayDoses(finalTodayDoses);
      setSelectedDateDoses(finalSelectedDoses);
      setStats(statsRes);

      // Зберігаємо актуальний розклад на сьогодні та мета-дані у localStorage для офлайн-режиму
      try {
        const todayCachePayload: OfflineTodayCache = {
          savedAt: new Date().toISOString(),
          date: todayStr,
          doses: finalTodayDoses,
        };
        localStorage.setItem(
          OFFLINE_TODAY_DOSES_KEY,
          JSON.stringify(todayCachePayload)
        );

        const metaCachePayload: OfflineDashboardMetaCache = {
          savedAt: new Date().toISOString(),
          daysMap: finalDaysMap,
          stats: statsRes,
        };
        localStorage.setItem(
          OFFLINE_DASHBOARD_META_KEY,
          JSON.stringify(metaCachePayload)
        );
      } catch {
        // Ігноруємо помилки переповнення localStorage
      }
    } catch (err) {
      console.warn(
        'Мережева помилка при зверненні до API — використовуємо збережений офлайн-кеш:',
        err
      );
      setIsOffline(true);
      loadFromOfflineCache();
    } finally {
      setLoading(false);
    }
  }, [
    rangeFrom,
    rangeTo,
    todayStr,
    selectedDate,
    loadFromOfflineCache,
    flushOfflineSyncQueue,
  ]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Відстеження подій online / offline у браузері та авто-синхронізація при появі мережі
  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      await flushOfflineSyncQueue();
      await fetchDashboardData();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushOfflineSyncQueue, fetchDashboardData]);

  /**
   * Миттєве оптимістичне оновлення локального стану та кешу (Optimistic UI)
   */
  const applyOptimisticStatusUpdate = (
    scheduleId: string,
    newStatus: DoseStatus
  ) => {
    const updatedToday = todayDoses.map((d) =>
      d.id === scheduleId ? { ...d, status: newStatus } : d
    );
    setTodayDoses(updatedToday);

    setSelectedDateDoses((prev) =>
      prev.map((d) => (d.id === scheduleId ? { ...d, status: newStatus } : d))
    );

    const updatedDaysMap: Record<string, DaySummaryDto> = {};
    for (const [dateKey, group] of Object.entries(daysMap)) {
      const hasTarget = group.doses.some((d) => d.id === scheduleId);
      if (hasTarget) {
        const nextDoses = group.doses.map((d) =>
          d.id === scheduleId ? { ...d, status: newStatus } : d
        );
        updatedDaysMap[dateKey] = recalculateDaySummary(group, nextDoses);
      } else {
        updatedDaysMap[dateKey] = group;
      }
    }
    setDaysMap(updatedDaysMap);

    try {
      localStorage.setItem(
        OFFLINE_TODAY_DOSES_KEY,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          date: todayStr,
          doses: updatedToday,
        } satisfies OfflineTodayCache)
      );

      localStorage.setItem(
        OFFLINE_DASHBOARD_META_KEY,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          daysMap: updatedDaysMap,
          stats,
        } satisfies OfflineDashboardMetaCache)
      );
    } catch {
      // ignore
    }
  };

  const handleStatusChange = async (
    scheduleId: string,
    newStatus: DoseStatus
  ) => {
    setUpdatingId(scheduleId);

    // 1. Одразу оновлюємо інтерфейс та локальний кеш (Optimistic UI)
    applyOptimisticStatusUpdate(scheduleId, newStatus);

    // 2. Якщо браузер у режимі офлайн — додаємо в чергу синхронізації без очікування таймауту мережі
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      const updatedQueue = enqueueOfflineDoseAction(scheduleId, newStatus);
      setSyncQueueCount(updatedQueue.length);
      setUpdatingId(null);
      return;
    }

    try {
      await scheduleApi.updateStatus(scheduleId, newStatus);
      await fetchDashboardData();
    } catch {
      // Якщо під час запиту виникла мережева помилка — зберігаємо дію в чергу синхронізації
      setIsOffline(true);
      const updatedQueue = enqueueOfflineDoseAction(scheduleId, newStatus);
      setSyncQueueCount(updatedQueue.length);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    const [y, m] = dateStr.split('-').map(Number);
    if (
      y !== currentMonthDate.getFullYear() ||
      m - 1 !== currentMonthDate.getMonth()
    ) {
      setCurrentMonthDate(new Date(y, m - 1, 1));
    }
  };

  const sortedSidebarDays = useMemo(() => {
    return Object.values(daysMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [daysMap]);

  return (
    <div className="space-y-6">
      {/* Індикатор синхронізації з сервером при відновленні зв'язку */}
      {isSyncing && (
        <div className="bg-sage-50 border border-sage-200 text-sage-800 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs sm:text-sm font-medium shadow-xs">
          <RefreshCw className="w-4 h-4 text-sage-600 animate-spin shrink-0" />
          <span>Синхронізація змін із сервером...</span>
        </div>
      )}

      {/* Ненав'язливий індикатор офлайн-режиму з лічильником несинхронізованих змін */}
      {isOffline && !isSyncing && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs sm:text-sm font-medium shadow-xs">
          <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {syncQueueCount > 0
              ? `Офлайн-режим: показано збережений розклад (несинхронізованих змін: ${syncQueueCount})`
              : 'Офлайн-режим: показано збережений розклад прийомів'}
          </span>
        </div>
      )}

      {/* 1. Статистика дотримання курсу за тиждень, місяць та сьогодні */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 border border-sage-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <div className="bg-sage-50/80 border border-sage-100 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-sage-700 mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>За 7 днів</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {stats ? `${stats.weekly.adherencePercent}%` : '—'}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Випито:{' '}
              {stats ? `${stats.weekly.taken}/${stats.weekly.total}` : '0/0'}
            </p>
          </div>

          <div className="bg-sage-50/80 border border-sage-100 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-sage-700 mb-1">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>За 30 днів</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {stats ? `${stats.monthly.adherencePercent}%` : '—'}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Випито:{' '}
              {stats ? `${stats.monthly.taken}/${stats.monthly.total}` : '0/0'}
            </p>
          </div>

          <div className="bg-sage-600 text-white rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-xs text-sage-100 font-medium">
              Сьогодні за графіком
            </span>
            <div className="text-2xl font-bold my-0.5">
              {todayDoses.filter((d) => d.status === 'TAKEN').length} /{' '}
              {todayDoses.length}
            </div>
            <span className="text-xs text-sage-100">прийомів виконано</span>
          </div>
        </div>
      </section>

      {/* Головна сітка: Ліва колонка (Блок "Прийняти сьогодні" + Інтерактивний календар) та Права бічна панель (Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* 3. Блок «Прийняти сьогодні» (Today's Doses) */}
          <section className="bg-white rounded-3xl p-6 border border-sage-200/80 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sage-500 animate-pulse" />
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    Прийняти сьогодні ({formatReadableDate(todayStr)})
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Миттєво відмічайте кожну дозу: «Випито» або «Пропущено»
                </p>
              </div>

              <button
                type="button"
                onClick={onNavigateToAdd}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-sage-50 hover:bg-sage-100 text-sage-800 border border-sage-200 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Новий препарат</span>
              </button>
            </div>

            {loading ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Завантаження розкладу на сьогодні...
              </div>
            ) : todayDoses.length === 0 ? (
              <div className="bg-sage-50/60 border border-dashed border-sage-200 rounded-2xl p-8 text-center">
                <p className="text-slate-700 font-medium mb-1">
                  На сьогодні немає запланованих прийомів
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  Додайте свій перший вітамін або препарат у вкладці «Додати
                  препарат», і розклад створиться автоматично.
                </p>
                <button
                  type="button"
                  onClick={onNavigateToAdd}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-sm font-medium transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Додати препарат до курсу</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {todayDoses.map((dose) => (
                  <DoseRowCard
                    key={dose.id}
                    dose={dose}
                    updating={updatingId === dose.id}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Якщо в календарі обрана інша дата (не сьогодні), показуємо окремий блок прийомів для обраної дати */}
          {selectedDate !== todayStr && (
            <section className="bg-white rounded-3xl p-6 border border-sage-100 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Розклад на обрану дату: {formatReadableDate(selectedDate)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ви можете переглянути або скоригувати статуси прийомів за цей
                    день
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectDate(todayStr)}
                  className="text-xs font-medium text-sage-700 hover:text-sage-900 underline"
                >
                  Повернутися до сьогодні
                </button>
              </div>

              {selectedDateDoses.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center bg-slate-50 rounded-2xl">
                  На {formatReadableDate(selectedDate)} прийомів не заплановано.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedDateDoses.map((dose) => (
                    <DoseRowCard
                      key={dose.id}
                      dose={dose}
                      updating={updatingId === dose.id}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 2. Інтерактивний календар прийому */}
          <section className="bg-white rounded-3xl p-6 border border-sage-100 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Інтерактивний календар прийому
                </h2>
                <p className="text-xs text-slate-500">
                  Клікніть по даті, щоб переглянути список препаратів на цей день
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Перемикач Місяць / Тиждень */}
                <div className="inline-flex bg-sage-50 p-1 rounded-xl border border-sage-100 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setCalendarView('month')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      calendarView === 'month'
                        ? 'bg-white text-sage-800 shadow-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    Місяць
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarView('week')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      calendarView === 'week'
                        ? 'bg-white text-sage-800 shadow-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    Тиждень
                  </button>
                </div>

                {/* Навігація по місяцях */}
                <div className="flex items-center gap-1 bg-sage-50 px-2 py-1 rounded-xl border border-sage-100">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentMonthDate(
                        new Date(
                          currentMonthDate.getFullYear(),
                          currentMonthDate.getMonth() - 1,
                          1
                        )
                      )
                    }
                    className="p-1 rounded-lg hover:bg-white text-slate-600 transition"
                    title="Попередній місяць"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs sm:text-sm font-semibold text-slate-800 min-w-[125px] text-center">
                    {UKRAINIAN_MONTHS[currentMonthDate.getMonth()]}{' '}
                    {currentMonthDate.getFullYear()}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentMonthDate(
                        new Date(
                          currentMonthDate.getFullYear(),
                          currentMonthDate.getMonth() + 1,
                          1
                        )
                      )
                    }
                    className="p-1 rounded-lg hover:bg-white text-slate-600 transition"
                    title="Наступний місяць"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Заголовки днів тижня */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
              {WEEKDAY_SHORT.map((dayName) => (
                <div
                  key={dayName}
                  className="text-center text-xs font-semibold text-slate-400 py-1"
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Сітка днів календаря */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {visibleCalendarCells.map((cell) => {
                const summary = daysMap[cell.dateStr];
                const isSelected = cell.dateStr === selectedDate;
                const isToday = cell.dateStr === todayStr;
                const isFuture = cell.dateStr > todayStr;

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => handleSelectDate(cell.dateStr)}
                    className={`group relative min-h-[68px] sm:min-h-[78px] p-2 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'border-sage-600 bg-sage-50/90 ring-2 ring-sage-500/25'
                        : isToday
                        ? 'border-sage-400 bg-white'
                        : cell.isCurrentMonth
                        ? 'border-slate-100 bg-white hover:border-sage-200 hover:bg-sage-50/40'
                        : 'border-transparent bg-slate-50/50 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs sm:text-sm font-semibold ${
                          isToday
                            ? 'bg-sage-600 text-white w-6 h-6 rounded-full inline-flex items-center justify-center'
                            : cell.isCurrentMonth
                            ? 'text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {summary && summary.total > 0 && (
                        <span>
                          {summary.allCompleted ? (
                            <span
                              title="Усі заплановані ліки прийнято (✓)"
                              className="w-5 h-5 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center text-[11px] font-bold shadow-sm"
                            >
                              ✓
                            </span>
                          ) : summary.hasSkipped ? (
                            <span
                              title="Є пропущені прийоми"
                              className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 inline-flex items-center justify-center text-[11px] font-bold"
                            >
                              !
                            </span>
                          ) : isFuture ? (
                            <span
                              title="Заплановані майбутні прийоми"
                              className="w-2 h-2 rounded-full bg-sage-400 inline-block"
                            />
                          ) : (
                            <span
                              title="Очікує прийому"
                              className="w-2 h-2 rounded-full bg-amber-400 inline-block"
                            />
                          )}
                        </span>
                      )}
                    </div>

                    {summary && summary.total > 0 ? (
                      <div className="mt-1">
                        <div className="text-[10px] sm:text-xs font-medium text-slate-600 truncate">
                          {summary.taken}/{summary.total} доз
                        </div>
                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              summary.allCompleted
                                ? 'bg-emerald-500'
                                : summary.hasSkipped
                                ? 'bg-amber-400'
                                : 'bg-sage-500'
                            }`}
                            style={{
                              width: `${Math.round(
                                (summary.taken / summary.total) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Легенда календаря */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
                <span>Усі ліки прийнято</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 inline-flex items-center justify-center text-[10px] font-bold">
                  !
                </span>
                <span>Є пропуски</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sage-400 inline-block" />
                <span>Запланований курс</span>
              </div>
            </div>
          </section>
        </div>

        {/* 4. Бічна панель (Sidebar) з історією та розкладом за датами */}
        <aside className="lg:col-span-4 bg-white rounded-3xl p-6 border border-sage-100 shadow-sm lg:sticky lg:top-24">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-sage-50 text-sage-700 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Історія та розклад за датами
              </h2>
              <p className="text-xs text-slate-500">
                Перелік препаратів по днях курсу
              </p>
            </div>
          </div>

          <div className="mt-4 max-h-[620px] overflow-y-auto pr-1 space-y-3">
            {sortedSidebarDays.length === 0 ? (
              <div className="text-center py-10 px-4 bg-sage-50/50 rounded-2xl border border-dashed border-sage-200">
                <p className="text-sm font-medium text-slate-600">
                  Історія та розклад порожні
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Після додавання препарату тут з’являться всі заплановані дати
                  прийому.
                </p>
              </div>
            ) : (
              sortedSidebarDays.map((dayGroup) => {
                const isToday = dayGroup.date === todayStr;
                const isSelected = dayGroup.date === selectedDate;

                return (
                  <div
                    key={dayGroup.date}
                    onClick={() => handleSelectDate(dayGroup.date)}
                    className={`cursor-pointer p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-sage-50/90 border-sage-400 shadow-sm'
                        : 'bg-slate-50/60 hover:bg-sage-50/40 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {formatReadableDate(dayGroup.date)}
                        </span>
                        {isToday && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sage-600 text-white">
                            Сьогодні
                          </span>
                        )}
                      </div>

                      {dayGroup.allCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Виконано
                        </span>
                      ) : dayGroup.hasSkipped ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-3 h-3" />Є пропуск
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-medium">
                          {dayGroup.taken}/{dayGroup.total}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {dayGroup.doses.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between gap-2 text-xs bg-white px-2.5 py-1.5 rounded-xl border border-slate-100"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={d.medication.imageUrl}
                              alt={d.medication.name}
                              className="w-6 h-6 rounded-lg object-cover bg-sage-50 shrink-0"
                            />
                            <span className="font-semibold text-sage-700 shrink-0">
                              {d.scheduledTime}
                            </span>
                            <span className="text-slate-700 truncate">
                              {d.medication.name}
                            </span>
                          </div>

                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
                              d.status === 'TAKEN'
                                ? 'bg-emerald-50 text-emerald-700'
                                : d.status === 'SKIPPED'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {d.status === 'TAKEN'
                              ? 'Випито'
                              : d.status === 'SKIPPED'
                              ? 'Пропущено'
                              : 'Заплановано'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

interface DoseRowCardProps {
  dose: DoseItemDto;
  updating: boolean;
  onStatusChange: (id: string, status: DoseStatus) => void;
}

const DoseRowCard: React.FC<DoseRowCardProps> = ({
  dose,
  updating,
  onStatusChange,
}) => {
  const isTaken = dose.status === 'TAKEN';
  const isSkipped = dose.status === 'SKIPPED';

  return (
    <div
      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isTaken
          ? 'bg-emerald-50/40 border-emerald-200/80'
          : isSkipped
          ? 'bg-rose-50/30 border-rose-200/70'
          : 'bg-slate-50/60 hover:bg-white border-slate-200/80'
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <img
          src={dose.medication.imageUrl}
          alt={dose.medication.name}
          className="w-14 h-14 rounded-2xl object-cover border border-sage-100 bg-white shrink-0 shadow-sm"
        />

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-sage-100 text-sage-800 text-xs font-bold">
              <Clock className="w-3.5 h-3.5" />
              {dose.scheduledTime}
            </span>

            <h4
              className={`font-bold text-sm sm:text-base truncate ${
                isTaken ? 'line-through text-slate-500' : 'text-slate-900'
              }`}
            >
              {dose.medication.name}
            </h4>

            {dose.medication.sourceUrl && (
              <a
                href={dose.medication.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-sage-600 transition"
                title="Відкрити посилання на препарат"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {dose.medication.dosage}
          </p>
        </div>
      </div>

      {/* Інтерактивні кнопки швидкої відмітки статусу: «Випито» або «Пропущено» */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          disabled={updating}
          onClick={() =>
            onStatusChange(dose.id, isTaken ? 'PENDING' : 'TAKEN')
          }
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            isTaken
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
              : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>Випито</span>
        </button>

        <button
          type="button"
          disabled={updating}
          onClick={() =>
            onStatusChange(dose.id, isSkipped ? 'PENDING' : 'SKIPPED')
          }
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            isSkipped
              ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/20'
              : 'bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-300'
          }`}
        >
          <X className="w-4 h-4" />
          <span>Пропущено</span>
        </button>
      </div>
    </div>
  );
};
