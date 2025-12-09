import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
} from 'axios';
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { API_BASE_URL } from '../lib/api';
import type { Role, User } from '../types/shared';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (fullName: string, email: string, password: string, role?: Role) => Promise<User>;
  logout: () => Promise<void>;
  changePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<void>;
  api: AxiosInstance;
}

type PersistedSession = {
  accessToken: string;
  refreshToken: string;
  user?: User | null;
};

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  user?: User;
}

interface RetriableAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

const STORAGE_KEYS = {
  access: 'teahaven_access_token',
  refresh: 'teahaven_refresh_token',
  user: 'teahaven_user',
};

const getSessionStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const apiRef = useRef<AxiosInstance>(
    axios.create({
      baseURL: API_BASE_URL,
      withCredentials: false,
    }),
  );
  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const userRef = useRef<User | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const persistSession = ({ accessToken: at, refreshToken: rt, user: nextUser }: PersistedSession) => {
    if (typeof window === 'undefined') {
      return;
    }

    setAccessToken(at);
    setRefreshToken(rt);
    const storage = getSessionStorage();
    storage?.setItem(STORAGE_KEYS.access, at);
    storage?.setItem(STORAGE_KEYS.refresh, rt);

    const userToStore = nextUser ?? userRef.current;
    if (userToStore) {
      setUser(userToStore);
      userRef.current = userToStore;
      storage?.setItem(STORAGE_KEYS.user, JSON.stringify(userToStore));
    }
  };

  const clearSession = () => {
    if (typeof window === 'undefined') {
      return;
    }
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    userRef.current = null;
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    const storage = getSessionStorage();
    storage?.removeItem(STORAGE_KEYS.access);
    storage?.removeItem(STORAGE_KEYS.refresh);
    storage?.removeItem(STORAGE_KEYS.user);
  };

  const performLogout = async (callApi: boolean) => {
    if (callApi && accessTokenRef.current) {
      try {
        await apiRef.current.post('/auth/logout');
      } catch {
        // ignore logout errors to avoid trapping user
      }
    }
    clearSession();
  };

  const performRefresh = async (): Promise<string | null> => {
    if (!refreshTokenRef.current) {
      return null;
    }

    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = axios
        .post<RefreshResponse>(`${API_BASE_URL}/auth/refresh`, {
          refreshToken: refreshTokenRef.current,
        })
        .then((response) => {
          const { access_token, refresh_token } = response.data;
          persistSession({
            accessToken: access_token,
            refreshToken: refresh_token,
            user: userRef.current ?? response.data.user ?? null,
          });
          return access_token;
        })
        .catch(() => {
          clearSession();
          return null;
        })
        .finally(() => {
          refreshPromiseRef.current = null;
        });
    }

    return refreshPromiseRef.current;
  };

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storage = getSessionStorage();
    const storedAccess = storage?.getItem(STORAGE_KEYS.access);
    const storedRefresh = storage?.getItem(STORAGE_KEYS.refresh);
    const storedUser = storage?.getItem(STORAGE_KEYS.user);

    if (storedAccess && storedRefresh && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        setAccessToken(storedAccess);
        setRefreshToken(storedRefresh);
        setUser(parsedUser);
        userRef.current = parsedUser;
      } catch {
        clearSession();
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const api = apiRef.current;

    const requestInterceptor = api.interceptors.request.use((config) => {
      const token = accessTokenRef.current;
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as RetriableAxiosRequestConfig;
        if (error.response?.status === 401 && refreshTokenRef.current && !originalRequest?._retry) {
          originalRequest._retry = true;
          const refreshed = await performRefresh();
          if (refreshed) {
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = `Bearer ${refreshed}`;
            return api(originalRequest);
          }
        }

        if (error.response?.status === 401) {
          await performLogout(false);
        }

        return Promise.reject(error);
      },
    );

    return () => {
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await apiRef.current.post<{
      access_token: string;
      refresh_token: string;
      user: User;
    }>('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });

    persistSession({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: data.user,
    });

    return data.user;
  };

  const register = async (
    fullName: string,
    email: string,
    password: string,
    role: Role = 'CUSTOMER',
  ) => {
    const { data } = await apiRef.current.post<{
      access_token: string;
      refresh_token: string;
      user: User;
    }>('/auth/register', {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
    });

    persistSession({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: data.user,
    });

    return data.user;
  };

  const changePassword = async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
    const { data } = await apiRef.current.patch<{
      access_token: string;
      refresh_token: string;
    }>('/auth/password', {
      currentPassword,
      newPassword,
    });

    persistSession({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: userRef.current,
    });
  };

  const logout = async () => {
    await performLogout(true);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      accessToken,
      loading,
      login,
      register,
      logout,
      changePassword,
      api: apiRef.current,
    }),
    [user, accessToken, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}