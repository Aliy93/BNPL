
'use client';

import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useMemo,
  useCallback,
} from 'react';
import type { getCurrentUser } from '@/lib/session';

// Define a user type that matches the structure returned by getUserFromSession
export type AuthenticatedUser = Awaited<ReturnType<typeof getUserFromSession>>;

interface AuthContextType {
  currentUser: AuthenticatedUser | null;
  setCurrentUser: (user: AuthenticatedUser | null) => void;
  login: (phoneNumber: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  refetchUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  setCurrentUser: () => {},
  login: async () => {},
  logout: async () => {},
  isLoading: true,
  refetchUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
    children: React.ReactNode;
    initialUser?: AuthenticatedUser | null;
}

export const AuthProvider = ({ children, initialUser = null }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(initialUser === undefined);

  useEffect(() => {
    if(initialUser !== undefined) {
      setCurrentUser(initialUser);
      setIsLoading(false);
    }
  }, [initialUser]);


  const login = useCallback(
    async (phoneNumber: string, password: string) => {
      setIsLoading(true);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({phoneNumber, password}),
      });

      if (!response.ok) {
        setIsLoading(false);
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      // After successful login, refetch user data to update context
      const userRes = await fetch('/api/auth/user');
      if(userRes.ok) {
        const user = await userRes.json();
        setCurrentUser(user);
      }
      setIsLoading(false);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout failed:', error)
    } finally {
        setCurrentUser(null);
    }
  }, []);
  
  const refetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const userRes = await fetch('/api/auth/user');
      if (userRes.ok) {
        const user = await userRes.json();
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('Failed to refetch user:', error);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);


  const value = useMemo(
    () => ({
      currentUser,
      setCurrentUser,
      login,
      logout,
      isLoading,
      refetchUser,
    }),
    [currentUser, login, logout, isLoading, refetchUser, setCurrentUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
