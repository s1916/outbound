import { useState, createContext, useContext, ReactNode, useEffect } from 'react';
import axios from 'axios';

interface User {
  employee_id: string;
  name: string;
  department: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loginMock: (employee_id: string) => Promise<void>;
  loginWithToken: (accessToken: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
    };
    
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      if (token) {
        try {
          // Verify token and get user info
          const response = await axios.get('/api/v1/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (isMounted) {
             setUser(response.data);
          }
        } catch (error) {
          console.error("Token verification failed in AuthContext:", error);
          if (isMounted) {
            setToken(null);
            setUser(null);
            localStorage.removeItem('token');
          }
        }
      }
      if (isMounted) {
        setIsLoading(false);
      }
    };

    initAuth();
    return () => { isMounted = false; }
  }, [token]);

  const loginWithToken = async (accessToken: string) => {
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
    const userResponse = await axios.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    setUser(userResponse.data);
  };

  const loginMock = async (employee_id: string) => {
    try {
      const response = await axios.post(`/api/v1/auth/login/mock?employee_id=${employee_id}`);
      const newToken = response.data.access_token;
      await loginWithToken(newToken);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loginMock, loginWithToken, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
