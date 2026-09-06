"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface User {
  id: string;
  username: string;
  email: string;
  token: string;
}

interface AuthContextType {
  user: User | null;
  storeUser: (user: User | null) => void;
  isAuth: boolean;
  setIsAuth: (isAuth: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuth, setIsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storeUser = useCallback((userData: User | null) => {
    if (userData) {
      setUser(userData);
      setIsAuth(true);
    } else {
      setUser(null);
      setIsAuth(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, storeUser, isAuth, setIsAuth, error, setError }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
