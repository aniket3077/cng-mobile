import React, { createContext, useContext } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  hasSubscription: boolean;
  setIsAuthenticated: (value: boolean) => void;
  checkAuth: () => Promise<void>;
  checkSubscription: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  hasSubscription: false,
  setIsAuthenticated: () => { },
  checkAuth: async () => { },
  checkSubscription: async () => { },
});

export const useAuth = () => useContext(AuthContext);
