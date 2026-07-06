import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authApi } from '../utils/api';
import type { User, AuthState } from '../types';

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem('token');
    const userRaw = localStorage.getItem('user');
    return {
      token,
      user: userRaw ? JSON.parse(userRaw) : null,
      isAuthenticated: !!token,
    };
  });

  const login = useCallback(async (username: string, password: string) => {
    const data = await authApi.login(username, password);
    const user = await (async () => {
      // fetch /me with the new token
      const r = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/auth/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      return r.json() as Promise<User>;
    })();
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(user));
    setState({ token: data.access_token, user, isAuthenticated: true });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setState({ token: null, user: null, isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
