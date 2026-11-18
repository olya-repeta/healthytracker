import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { googleLogout } from '@react-oauth/google';
import { UserDto } from '../types/api';
import { authApi } from '../api/auth.api';
import { TOKEN_STORAGE_KEY } from '../api/client';

export const CACHED_USER_STORAGE_KEY = 'vitatrack_cached_user';
export const OFFLINE_AUTH_STORAGE_KEY = 'vitatrack_offline_auth';

interface OfflineAuthSnapshot {
  email: string;
  credentialHash: string;
  token: string;
  user: UserDto;
}

interface AuthContextValue {
  user: UserDto | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Резервна реалізація SHA-256 для HTTP-контекстів (наприклад, http://IP), де crypto.subtle може бути недоступним
 */
function sha256Fallback(ascii: string): string {
  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);

      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

async function computeCredentialHash(
  email: string,
  password: string
): Promise<string> {
  const normalized = `${email.toLowerCase().trim()}:${password}`;
  try {
    if (
      typeof window !== 'undefined' &&
      window.crypto &&
      window.crypto.subtle
    ) {
      const encoded = new TextEncoder().encode(normalized);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fallback нижче
  }
  const utf8Str = unescape(encodeURIComponent(normalized));
  return sha256Fallback(utf8Str);
}

function saveOfflineAuthSnapshot(snapshot: OfflineAuthSnapshot): void {
  try {
    localStorage.setItem(OFFLINE_AUTH_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ігноруємо помилки запису в localStorage
  }
}

function readOfflineAuthSnapshot(): OfflineAuthSnapshot | null {
  try {
    const raw = localStorage.getItem(OFFLINE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineAuthSnapshot;
    if (
      parsed &&
      parsed.email &&
      parsed.credentialHash &&
      parsed.token &&
      parsed.user
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveCachedUser(user: UserDto): void {
  try {
    localStorage.setItem(CACHED_USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ігноруємо помилки запису в localStorage
  }
}

function decodeUserFromJwt(token: string): UserDto | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload) as {
      userId?: string;
      email?: string;
      name?: string;
    };
    if (!parsed.userId || !parsed.email) return null;
    return {
      id: parsed.userId,
      email: parsed.email,
      name: parsed.name || parsed.email.split('@')[0],
      createdAt: new Date().toISOString(),
      isTelegramConnected: false,
      timezone: 'Europe/Kyiv',
    };
  } catch {
    return null;
  }
}

function readCachedUser(token: string | null): UserDto | null {
  if (!token) return null;
  try {
    const raw = localStorage.getItem(CACHED_USER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UserDto;
      if (parsed && parsed.id && parsed.email) {
        return parsed;
      }
    }
  } catch {
    // Якщо кеш пошкоджений — пробуємо відновити з JWT
  }

  const fallbackFromJwt = decodeUserFromJwt(token);
  if (fallbackFromJwt) {
    saveCachedUser(fallbackFromJwt);
  }
  return fallbackFromJwt;
}

const OFFLINE_LOGIN_ERROR_MESSAGE =
  'Немає підключення до сервера. В офлайн-режимі доступний вхід лише в акаунт, який раніше відкривався на цьому пристрої (перевірте пароль)';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserDto | null>(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    return readCachedUser(token);
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      localStorage.removeItem(CACHED_USER_STORAGE_KEY);
      setUser(null);
      setIsLoading(false);
      return;
    }

    // Якщо браузер в офлайні — одразу відновлюємо користувача з кешу без скидання сесії
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = readCachedUser(token);
      if (cached) {
        setUser(cached);
      }
      setIsLoading(false);
      return;
    }

    authApi
      .getMe()
      .then((res) => {
        setUser(res.user);
        saveCachedUser(res.user);
      })
      .catch((err: unknown) => {
        // Виконуємо логаут ЛИШЕ при реальній відповіді 401 Unauthorized від сервера
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(CACHED_USER_STORAGE_KEY);
          setUser(null);
          return;
        }

        // При мережевій помилці або відсутності інтернету зберігаємо сесію з кешу
        const cached = readCachedUser(token);
        if (cached) {
          setUser(cached);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const tryOfflineLogin = async (
    email: string,
    password: string
  ): Promise<boolean> => {
    const snapshot = readOfflineAuthSnapshot();
    if (!snapshot) {
      return false;
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (snapshot.email !== normalizedEmail) {
      return false;
    }

    const inputHash = await computeCredentialHash(normalizedEmail, password);
    if (inputHash !== snapshot.credentialHash) {
      return false;
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, snapshot.token);
    saveCachedUser(snapshot.user);
    setUser(snapshot.user);
    return true;
  };

  const login = async (email: string, password: string) => {
    const normalizedEmail = email.toLowerCase().trim();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const ok = await tryOfflineLogin(normalizedEmail, password);
      if (!ok) {
        throw new Error(OFFLINE_LOGIN_ERROR_MESSAGE);
      }
      return;
    }

    try {
      const res = await authApi.login({ email: normalizedEmail, password });
      const credentialHash = await computeCredentialHash(
        normalizedEmail,
        password
      );
      localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
      saveCachedUser(res.user);
      saveOfflineAuthSnapshot({
        email: normalizedEmail,
        credentialHash,
        token: res.token,
        user: res.user,
      });
      setUser(res.user);
    } catch (err: unknown) {
      // Якщо сервер відповів помилкою валідації/авторизації (наприклад, 400 або 401) — прокидаємо далі
      if (axios.isAxiosError(err) && err.response) {
        throw err;
      }

      // Якщо сталася мережева помилка (сервер недоступний) — пробуємо офлайн-вхід за збереженим хешем
      const ok = await tryOfflineLogin(normalizedEmail, password);
      if (!ok) {
        throw new Error(OFFLINE_LOGIN_ERROR_MESSAGE);
      }
    }
  };

  const register = async (name: string, email: string, password: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    const res = await authApi.register({
      name,
      email: normalizedEmail,
      password,
    });
    const credentialHash = await computeCredentialHash(
      normalizedEmail,
      password
    );
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    saveCachedUser(res.user);
    saveOfflineAuthSnapshot({
      email: normalizedEmail,
      credentialHash,
      token: res.token,
      user: res.user,
    });
    setUser(res.user);
  };

  const loginWithGoogle = async (idToken: string) => {
    const res = await authApi.loginWithGoogle(idToken);
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    saveCachedUser(res.user);
    setUser(res.user);
  };

  const logout = () => {
    try {
      googleLogout();
    } catch {
      // Ігноруємо, якщо Google SDK ще не ініціалізований
    }
    // Видаляємо лише активну сесію (token та cached_user), зберігаючи vitatrack_offline_auth для повторного входу в офлайні
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(CACHED_USER_STORAGE_KEY);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      setUser(res.user);
      saveCachedUser(res.user);
    } catch (err) {
      console.warn('Не вдалося оновити профіль користувача:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        loginWithGoogle,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth має використовуватися всередині AuthProvider');
  }
  return ctx;
};
