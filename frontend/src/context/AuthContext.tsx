import React, { createContext, useContext, useEffect, useState } from 'react';
import { googleLogout } from '@react-oauth/google';
import { UserDto } from '../types/api';
import { authApi } from '../api/auth.api';
import { TOKEN_STORAGE_KEY } from '../api/client';

interface AuthContextValue {
  user: UserDto | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }

    authApi
      .getMe()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    setUser(res.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await authApi.register({ name, email, password });
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    setUser(res.user);
  };

  const loginWithGoogle = async (idToken: string) => {
    const res = await authApi.loginWithGoogle(idToken);
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    setUser(res.user);
  };

  const logout = () => {
    try {
      googleLogout();
    } catch {
      // Ігноруємо, якщо Google SDK ще не ініціалізований
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
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
