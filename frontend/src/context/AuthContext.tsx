import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { googleLogout } from '@react-oauth/google';
import { UserDto } from '../types/api';
import { authApi } from '../api/auth.api';
import { TOKEN_STORAGE_KEY } from '../api/client';

export const CACHED_USER_STORAGE_KEY = 'vitatrack_cached_user';

interface AuthContextValue {
  user: UserDto | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    saveCachedUser(res.user);
    setUser(res.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await authApi.register({ name, email, password });
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    saveCachedUser(res.user);
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
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(CACHED_USER_STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, loginWithGoogle, logout }}
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
