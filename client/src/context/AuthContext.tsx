"use client";

import { getUser } from "@/actions/auth";
import { toast } from "@/components/ui/toast";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface User {
  username: string;
  accessToken: string;
}

interface AuthContextType {
  user: User | null;
  storeUser: (user: User | null) => void;
  isAuth: boolean;
  setIsAuth: (isAuth: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuth, setIsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const storeUser = useCallback((userData: User | null) => {
    if (userData) {
      setUser(userData);
      setIsAuth(true);
    } else {
      setUser(null);
      setIsAuth(false);
    }
  }, []);

  useEffect(() => {
    getUser()
      .then(({ data, error, success }) => {
        setLoading(false);
        if (success && data) {
          storeUser(data);
        } else {
          storeUser(null);
          toast.add({
            description: error,
            type: "error",
          });
        }
      })
      .catch((e) => {
        setLoading(false);
        console.error("Error fetching user:", e);
      });
  }, [storeUser]);

  return (
    <AuthContext.Provider
      value={{ user, storeUser, isAuth, setIsAuth, error, setError, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
