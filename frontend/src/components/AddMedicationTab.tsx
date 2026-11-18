import React, { useEffect, useState } from 'react';
import {
  Link2,
  Clock,
  Calendar,
  Plus,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { medicationsApi } from '../api/medications.api';
import { FrequencyType, MedicationDto } from '../types/api';
import { prepareMedicationPhotoPreview } from '../utils/imageUpload';
import axios from 'axios';

interface AddMedicationTabProps {
  onCreatedSuccess: () => void;
}

const WEEKDAYS_OPTIONS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Нд' },
];

const DEFAULT_FALLBACK_PREVIEW = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" fill="none">
    <rect width="240" height="240" rx="40" fill="#EDF3EF"/>
    <circle cx="120" cy="120" r="72" fill="#DCE8E0"/>
    <g transform="rotate(-35 120 120)">
      <rect x="92" y="64" width="56" height="112" rx="28" fill="#FFFFFF" stroke="#52796F" stroke-width="6"/>
      <path d="M92 120H148V148C148 163.464 135.464 176 120 176C104.536 176 92 163.464 92 148V120Z" fill="#749F82"/>
      <line x1="92" y1="120" x2="148" y2="120" stroke="#52796F" stroke-width="6"/>
    </g>
  </svg>`
)}`;

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const AddMedicationTab: React.FC<AddMedicationTabProps> = ({
  onCreatedSuccess,
}) => {
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string>(
    DEFAULT_FALLBACK_PREVIEW
  );
  const [isFallbackPreview, setIsFallbackPreview] = useState<boolean>(true);
  const [previewReason, setPreviewReason] = useState<string | undefined>(
    undefined
  );
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  const [frequencyType, setFrequencyType] = useState<FrequencyType>('DAILY');
  const [timesPerDay, setTimesPerDay] = useState<number>(1);
  const [timesOfDay, setTimesOfDay] = useState<string[]>(['06:00']);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 3, 5]);
  const [startDate, setStartDate] = useState<string>(getTodayDateString());
  const [durationDays, setDurationDays] = useState<number>(30);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [existingMedications, setExistingMedications] = useState<
    MedicationDto[]
  >([]);

  const loadMedications = async () => {
    try {
      const res = await medicationsApi.list();
      setExistingMedications(res.medications);
    } catch (err) {
      console.error('Помилка завантаження списку препаратів:', err);
    }
  };

  useEffect(() => {
    loadMedications();
  }, []);

  const triggerImagePreview = async (targetUrl: string) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) {
      setPreviewImageUrl(DEFAULT_FALLBACK_PREVIEW);
      setIsFallbackPreview(true);
      setPreviewReason(undefined);
      return;
    }

    let isValidHttp = false;
    try {
      const u = new URL(trimmed);
      isValidHttp = u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      isValidHttp = false;
    }

    if (!isValidHttp) {
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await medicationsApi.previewImage(trimmed);
      setPreviewImageUrl(res.imageUrl);
      setIsFallbackPreview(res.isFallback);
      setPreviewReason(res.reason);
    } catch {
      setPreviewImageUrl(DEFAULT_FALLBACK_PREVIEW);
      setIsFallbackPreview(true);
      setPreviewReason('fetch_error');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Автоматичне підтягування зображення (og:image / JSON-LD) при вставці або зміні посилання
  useEffect(() => {
    const trimmed = sourceUrl.trim();
    if (!trimmed) {
      setPreviewImageUrl(DEFAULT_FALLBACK_PREVIEW);
      setIsFallbackPreview(true);
      setPreviewReason(undefined);
      return;
    }

    const timer = setTimeout(() => {
      triggerImagePreview(trimmed);
    }, 450);

    return () => clearTimeout(timer);
  }, [sourceUrl]);

  // Синхронізація кількості полів вибору часу прийому (наприклад, 1, 2, 3 або 4 рази на день)
  const handleTimesPerDayChange = (count: number) => {
    const presets: Record<number, string[]> = {
      1: ['06:00'],
      2: ['06:00', '20:00'],
      3: ['06:00', '14:00', '21:00'],
      4: ['06:00', '12:00', '16:00', '21:00'],
    };
    setTimesPerDay(count);
    setTimesOfDay(presets[count] || ['06:00']);
  };

  const handleTimeSlotChange = (index: number, value: string) => {
    setTimesOfDay((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const toggleDayOfWeek = (dayNumber: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(dayNumber)
        ? prev.filter((d) => d !== dayNumber)
        : [...prev, dayNumber]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessBanner(null);

    if (frequencyType === 'WEEKLY' && daysOfWeek.length === 0) {
      setError('Будь ласка, оберіть хоча б один день тижня.');
      return;
    }

    setSubmitting(true);
    try {
      const manualImg = customImageUrl.trim();
      const resolvedImageToSend = manualImg
        ? manualImg
        : !isFallbackPreview
        ? previewImageUrl
        : null;

      const res = await medicationsApi.create({
        name,
        dosage,
        sourceUrl: sourceUrl.trim() || null,
        imageUrl: resolvedImageToSend,
        frequencyType,
        timesPerDay: timesOfDay.length,
        timesOfDay,
        daysOfWeek:
          frequencyType === 'DAILY' ? [0, 1, 2, 3, 4, 5, 6] : daysOfWeek,
        startDate,
        durationDays,
      });

      setSuccessBanner(
        `Препарат «${res.medication.name}» збережено! Автоматично згенеровано ${res.generatedDosesCount} прийомів у вашому розкладі.`
      );
      setName('');
      setDosage('');
      setSourceUrl('');
      setCustomImageUrl('');
      setPreviewImageUrl(DEFAULT_FALLBACK_PREVIEW);
      setIsFallbackPreview(true);
      setPreviewReason(undefined);
      await loadMedications();

      setTimeout(() => {
        onCreatedSuccess();
      }, 900);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Помилка під час створення препарату.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMedication = async (id: string) => {
    try {
      await medicationsApi.remove(id);
      await loadMedications();
    } catch (err) {
      console.error('Не вдалося видалити препарат:', err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Основна форма створення нового препарату/вітаміну */}
      <div className="lg:col-span-8 bg-white rounded-3xl p-4 sm:p-8 border border-sage-100 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Додати новий препарат або вітамін
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Вкажіть назву, посилання на препарат в аптеці та графік прийому —
            система автоматично побудує календар на весь курс.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {error}
          </div>
        )}

        {successBanner && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Назва та Дозування */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Назва препарату *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Наприклад: Вітамін D3 2000 МО"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-500 transition text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Дозування та інструкція *
              </label>
              <input
                type="text"
                required
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="Наприклад: 1 капсула під час їжі"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-500 transition text-sm"
              />
            </div>
          </div>

          {/* 2. Посилання на препарат (URL) + Автоматичне прев'ю зображення + Ручний URL картинки */}
          <div className="p-4 sm:p-5 rounded-2xl bg-sage-50/60 border border-sage-100 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative w-24 h-24 rounded-2xl bg-white border border-sage-200 overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                <img
                  src={customImageUrl.trim() || previewImageUrl}
                  alt="Прев'ю препарату"
                  onError={() => {
                    if (!customImageUrl.trim()) {
                      setPreviewImageUrl(DEFAULT_FALLBACK_PREVIEW);
                      setIsFallbackPreview(true);
                    }
                  }}
                  className="w-full h-full object-cover"
                />
                {previewLoading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-sage-600 animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 w-full space-y-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    <Link2 className="w-3.5 h-3.5 text-sage-600" />
                    <span>Посилання на препарат в аптеці чи магазині (URL)</span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="https://apteka911.ua/..."
                      className="w-full min-w-0 flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-500 transition text-sm"
                    />
                    <button
                      type="button"
                      disabled={!sourceUrl.trim() || previewLoading}
                      onClick={() => triggerImagePreview(sourceUrl)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white hover:bg-sage-100 text-sage-800 border border-sage-200 text-xs font-semibold transition shrink-0 disabled:opacity-50"
                    >
                      Підтягнути фото
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                    <ImageIcon className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                    <span>
                      {customImageUrl.trim()
                        ? 'Використовується вказане вручну пряме посилання на фото препарату'
                        : previewLoading
                        ? 'Парсимо фото зі сторінки товару...'
                        : !sourceUrl.trim()
                        ? 'Вставте посилання на ліки/вітаміни — фото підтягнеться автоматично'
                        : isFallbackPreview
                        ? previewReason?.startsWith('http_403')
                          ? 'Сайт аптеки захищений від авто-парсингу (Cloudflare) — за бажанням вставте прямий URL картинки нижче'
                          : 'Картинку за посиланням не знайдено — встановлено дефолтну іконку або вкажіть прямий URL фото нижче'
                        : 'Фото препарату успішно підтягнуто зі сторінки!'}
                    </span>
                  </div>
                </div>

                {/* Опціональне поле для прямого посилання на картинку (якщо сайт захищений Cloudflare) */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Пряме посилання на картинку (опціонально, якщо сайт аптеки блокує авто-парсинг):
                  </label>
                  <input
                    type="url"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    placeholder="https://.../product-photo.jpg"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-500 transition text-xs"
                  />
                </div>

                {/* Завантаження власного фото пакування з пристрою (опціонально) */}
                <div className="pt-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Або прикріпіть власне фото пакування препарату (опціонально):
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const dataUrl = await prepareMedicationPhotoPreview(file);
                        setCustomImageUrl(dataUrl);
                      } catch (uploadErr) {
                        setError(
                          uploadErr instanceof Error
                            ? uploadErr.message
                            : 'Не вдалося завантажити фото пакування'
                        );
                      }
                    }}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-sage-200 file:text-xs file:font-semibold file:bg-white file:text-sage-800 hover:file:bg-sage-100 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Частота та графік прийому */}
          <div className="space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Режим та частота прийому
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFrequencyType('DAILY')}
                className={`p-4 rounded-2xl border text-left transition ${
                  frequencyType === 'DAILY'
                    ? 'border-sage-600 bg-sage-50/70 ring-2 ring-sage-500/20'
                    : 'border-slate-200 hover:border-sage-300 bg-white'
                }`}
              >
                <div className="font-bold text-sm text-slate-900">
                  Щодня (N разів на день)
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Регулярний щоденний прийом у вибрані години
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFrequencyType('WEEKLY')}
                className={`p-4 rounded-2xl border text-left transition ${
                  frequencyType === 'WEEKLY'
                    ? 'border-sage-600 bg-sage-50/70 ring-2 ring-sage-500/20'
                    : 'border-slate-200 hover:border-sage-300 bg-white'
                }`}
              >
                <div className="font-bold text-sm text-slate-900">
                  Раз на тиждень / у вибрані дні тижня
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Прийом лише у конкретні дні (наприклад, Пн, Ср, Пт)
                </div>
              </button>
            </div>

            {/* Вибір днів тижня для тижневого режиму */}
            {frequencyType === 'WEEKLY' && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <label className="block text-xs font-semibold text-slate-700 mb-2.5">
                  Оберіть дні тижня для прийому:
                </label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS_OPTIONS.map((day) => {
                    const active = daysOfWeek.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDayOfWeek(day.value)}
                        className={`w-11 h-11 rounded-xl text-xs font-bold transition ${
                          active
                            ? 'bg-sage-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-sage-300'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Кількість прийомів на день та точний час для кожної дози */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start pt-2">
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Кількість прийомів на день
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleTimesPerDayChange(num)}
                      className={`py-2.5 rounded-xl text-sm font-bold border transition ${
                        timesPerDay === num
                          ? 'bg-sage-600 text-white border-sage-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-sage-300'
                      }`}
                    >
                      {num}х
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-7">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Точний час прийому для кожної дози
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5">
                  {timesOfDay.map((timeValue, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    >
                      <Clock className="w-4 h-4 text-sage-600 shrink-0" />
                      <span className="text-xs text-slate-500 font-medium">
                        Доза #{idx + 1}:
                      </span>
                      <input
                        type="time"
                        required
                        value={timeValue}
                        onChange={(e) =>
                          handleTimeSlotChange(idx, e.target.value)
                        }
                        className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none ml-auto"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Початок та тривалість курсу */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-sage-600" />
                <span>Дата початку курсу</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-500 transition text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Тривалість курсу (кількість днів)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  required
                  value={durationDays}
                  onChange={(e) =>
                    setDurationDays(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-28 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-500 transition text-sm font-bold"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[7, 14, 30, 60].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDurationDays(preset)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        durationDays === preset
                          ? 'bg-sage-100 border-sage-400 text-sage-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {preset} дн.
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 rounded-2xl bg-sage-600 hover:bg-sage-700 active:bg-sage-800 text-white font-semibold text-sm shadow-lg shadow-sage-600/20 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            <span>
              {submitting
                ? 'Створюємо розклад...'
                : 'Створити препарат та згенерувати розклад'}
            </span>
          </button>
        </form>
      </div>

      {/* Права колонка: Мої додані препарати (Активні курси) */}
      <aside className="lg:col-span-4 bg-white rounded-3xl p-6 border border-sage-100 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Активні препарати курсу
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Усі додані вами вітаміни та ліки ({existingMedications.length})
        </p>

        {existingMedications.length === 0 ? (
          <div className="p-6 rounded-2xl bg-sage-50/50 border border-dashed border-sage-200 text-center text-xs text-slate-500">
            Ви ще не додали жодного препарату. Заповніть форму ліворуч, щоб
            створити свій перший курс.
          </div>
        ) : (
          <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
            {existingMedications.map((med) => (
              <div
                key={med.id}
                className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 flex items-start gap-3 justify-between"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <img
                    src={med.imageUrl}
                    alt={med.name}
                    className="w-12 h-12 rounded-xl object-cover bg-white border border-sage-100 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {med.name}
                      </h4>
                      {med.sourceUrl && (
                        <a
                          href={med.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-sage-600 shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {med.dosage}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {med.timesOfDay.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sage-100 text-sage-800"
                        >
                          {t}
                        </span>
                      ))}
                      <span className="text-[10px] text-slate-500 px-1.5 py-0.5">
                        • {med.durationDays} дн.
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteMedication(med.id)}
                  title="Видалити препарат та його розклад"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
};
