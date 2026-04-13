"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  getCurrentUser,
  registerUser,
  loginUser,
  logoutUser,
  verifySession,
  type QuizUser,
} from "@/lib/authStore";

interface AuthContextType {
  user: QuizUser | null;
  isLoading: boolean;
  login: (email: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<QuizUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // First load cached user immediately for fast UI
    const cached = getCurrentUser();
    if (cached) {
      setUser(cached);
    }

    // Then verify with server
    verifySession().then((verified) => {
      setUser(verified);
      setIsLoading(false);
    }).catch(() => {
      setUser(cached);
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string) => {
    const result = await loginUser(email);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return { success: result.success, error: result.error };
  }, []);

  const register = useCallback(async (name: string, email: string) => {
    const result = await registerUser(name, email);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return { success: result.success, error: result.error };
  }, []);

  const logout = useCallback(() => {
    logoutUser();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
