import React, { createContext, useContext } from 'react';
import { useAppStore } from './store/appStore';

interface AuthContextType {
  isAuthenticated: boolean;
  hasSubscription: boolean;
  setIsAuthenticated: (value: boolean) => void;
  checkAuth: () => Promise<void>;
  checkSubscription: () => Promise<boolean>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  hasSubscription: false,
  setIsAuthenticated: () => { },
  checkAuth: async () => { },
  checkSubscription: async () => false,
  logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export function useAuthContextValue(): AuthContextType {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const hasSubscription = useAppStore((state) => state.hasSubscription);
  const setAuthenticated = useAppStore((state) => state.setAuthenticated);
  const refreshAccessState = useAppStore((state) => state.refreshAccessState);
  const refreshSubscription = useAppStore((state) => state.refreshSubscription);
  const logout = useAppStore((state) => state.logout);

  return {
    isAuthenticated,
    hasSubscription,
    setIsAuthenticated: setAuthenticated,
    checkAuth: refreshAccessState,
    checkSubscription: refreshSubscription,
    logout,
  };
}
