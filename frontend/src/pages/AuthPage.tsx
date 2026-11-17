import React, { useState } from 'react';
import { Pill, Link2, ArrowRight, ShieldCheck, Clock } from 'lucide-react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const configuredGoogleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';
const isGoogleOAuthEnabled =
  Boolean(configuredGoogleClientId) &&
  configuredGoogleClientId !==
    'your-google-oauth-client-id.apps.googleusercontent.com';

export const AuthPage: React.FC = () => {
  const { login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'register') {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Не вдалося виконати запит. Перевірте підключення до сервера.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (
    credentialResponse: CredentialResponse
  ) => {
    if (!credentialResponse.credential) {
      setError('Не отримано токен авторизації від Google.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle(credentialResponse.credential);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Не вдалося увійти через Google.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 via-white to-sage-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 bg-white rounded-3xl shadow-xl shadow-sage-900/5 border border-sage-100 overflow-hidden">
        {/* Ліва інформаційна wellness-панель */}
        <div className="lg:col-span-5 bg-sage-600 text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2.5 bg-white/15 backdrop-blur-sm px-3.5 py-2 rounded-2xl mb-8">
              <div className="w-8 h-8 rounded-xl bg-white text-sage-700 flex items-center justify-center">
                <Pill className="w-5 h-5" />
              </div>
              <span className="font-semibold tracking-tight text-lg">
                VitaTrack
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold leading-snug mb-4">
              Твій спокійний ритм прийому вітамінів та ліків
            </h1>
            <p className="text-sage-100 text-sm sm:text-base leading-relaxed">
              Забудь про пропущені капсули, хаос в інструкціях та раптове
              закінчення курсу. Увесь розклад у чистому й наочному трекері.
            </p>
          </div>

          <div className="relative z-10 space-y-4 mt-8 pt-8 border-t border-white/15 text-sm">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-sage-200 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-white">Точний розклад за часом</p>
                <p className="text-sage-100 text-xs">
                  Автоматична генерація графіка на весь курс прийому
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Link2 className="w-5 h-5 text-sage-200 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-white">
                  Авто-прев’ю препарату за посиланням
                </p>
                <p className="text-sage-100 text-xs">
                  Встав лінк з аптеки чи iHerb — фото підтягнеться миттєво
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-sage-200 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-white">Контроль дотримання курсу</p>
                <p className="text-sage-100 text-xs">
                  Інтерактивний календар із відмітками «Випито» та «Пропущено»
                </p>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-sage-500/40 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Права частина: Форма входу / реєстрації + Google OAuth 2.0 */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            <div className="inline-flex p-1 rounded-2xl bg-sage-50 border border-sage-100 mb-6 w-full">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  mode === 'login'
                    ? 'bg-white text-sage-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Вхід в акаунт
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  mode === 'register'
                    ? 'bg-white text-sage-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Реєстрація
              </button>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {mode === 'login' ? 'З поверненням!' : 'Створити особистий трекер'}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              {mode === 'login'
                ? 'Увійдіть, щоб переглянути заплановані на сьогодні прийоми'
                : 'Заповніть коротку форму, щоб почати відстежувати свій курс'}
            </p>

            {error && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                    Ваше ім’я
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Наприклад, Олена"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-500 transition text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Електронна пошта (Email)
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="olena@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-500 transition text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Пароль
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Мінімум 6 символів"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-500 transition text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-5 rounded-xl bg-sage-600 hover:bg-sage-700 active:bg-sage-800 text-white font-medium text-sm shadow-md shadow-sage-600/20 flex items-center justify-center gap-2 transition disabled:opacity-60"
              >
                <span>
                  {submitting
                    ? 'Зачекайте...'
                    : mode === 'login'
                    ? 'Увійти до трекера'
                    : 'Зареєструватися'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Розділювач «або» */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400 font-medium">
                  або
                </span>
              </div>
            </div>

            {/* Кнопка входу через Google OAuth 2.0 */}
            {isGoogleOAuthEnabled ? (
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() =>
                    setError('Не вдалося виконати вхід через Google.')
                  }
                  shape="pill"
                  size="large"
                  width="360"
                  text="continue_with"
                />
              </div>
            ) : (
              <button
                type="button"
                disabled
                title="Вкажіть VITE_GOOGLE_CLIENT_ID у файлі .env для активації Google OAuth 2.0"
                className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium flex items-center justify-center gap-2.5 cursor-not-allowed"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                <span>Увійти через Google (вкажіть VITE_GOOGLE_CLIENT_ID)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
