import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  street: string;
  houseNumber: string;
  city: string;
  postalCode: string;
  country: string;
  role: string;
  created_at: string;
  is_active: boolean;
  wallets?: string[];
  profile_picture_id?: string;
  profile_picture_filename?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    street: string;
    houseNumber: string;
    city: string;
    postalCode: string;
    country: string;
    walletAddress?: string;
  }) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  savedEmail: string | null;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const API_BASE_URL = 'https://api.jurite.de';

const saveEmail = async (email: string) => {
  try {
    await AsyncStorage.setItem('userEmail', email);
    console.log('AuthContext: E-Mail gespeichert:', email);
  } catch (error) {
    console.error('AuthContext: Fehler beim Speichern der E-Mail:', error);
  }
};

// Füge eine Funktion hinzu, um die E-Mail zu laden
const loadEmail = async () => {
  try {
    const email = await AsyncStorage.getItem('userEmail');
    console.log('AuthContext: Geladene E-Mail:', email);
    return email;
  } catch (error) {
    console.error('AuthContext: Fehler beim Laden der E-Mail:', error);
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savedEmail, setSavedEmail] = useState<string | null>(null); 

  // Lade Token und E-Mail beim Start
  useEffect(() => {
    const initializeAuth = async () => {
      const [storedToken, storedEmail] = await Promise.all([
        AsyncStorage.getItem('token'),
        loadEmail(),
      ]);
      console.log('AuthContext: Initial fetch - token:', storedToken, 'email:', storedEmail);
      setToken(storedToken);
      setSavedEmail(storedEmail);
      setIsLoading(!!storedToken);
    };
    initializeAuth();
  }, []);

  useEffect(() => {
    const fetchToken = async () => {
      const storedToken = await AsyncStorage.getItem('token');
      console.log('AuthContext: Initial token fetch:', storedToken);
      setToken(storedToken);
      setIsLoading(!!storedToken);
    };
    fetchToken();
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          console.log('AuthContext: Fetching user with token:', token);
          const response = await axios.get(`${API_BASE_URL}/auth/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log('AuthContext: User fetched:', response.data);
          setUser(response.data);
          setError(null);
        } catch (error: any) {
          const errorMessage = error.response
            ? `Failed to fetch user: ${error.response.status} - ${error.response.data?.msg || error.response.data?.error || 'No error message'}`
            : `Failed to fetch user: ${error.message}`;
          console.error(errorMessage, error);
          setError(errorMessage);
          setToken(null);
          setUser(null);
          await AsyncStorage.removeItem('token');
        }
      }
      setIsLoading(false);
    };
    fetchUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      console.log('AuthContext: Logging in with:', { email });
      const response = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
      console.log('AuthContext: Login response:', response.data);
      const { access_token, ...userData } = response.data;
      setIsLoading(true);
      setToken(access_token);
      await AsyncStorage.setItem('token', access_token);
      await saveEmail(email); 
      setUser(userData);
      setError(null);
      setIsLoading(false);
      console.log('AuthContext: After login - user:', userData, 'isAuthenticated:', !!access_token && !!userData);
    } catch (error: any) {
      const errorMessage = error.response
        ? `Login failed: ${error.response.status} - ${error.response.data?.error || 'No error message'}`
        : `Login failed: ${error.message}`;
      console.error(errorMessage, error);
      throw new Error(errorMessage);
    }
  };

  const register = async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    street: string;
    houseNumber: string;
    city: string;
    postalCode: string;
    country: string;
    walletAddress?: string;
  }) => {
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, userData);
      await login(userData.email, userData.password);
    } catch (error: any) {
      const errorMessage = error.response
        ? `Registration failed: ${error.response.status} - ${error.response.data?.error || 'No error message'}`
        : `Registration failed: ${error.message}`;
      throw new Error(errorMessage);
    }
  };

    const logout = async () => {
        console.log('AuthContext: Logging out');
        setToken(null);
        setUser(null);
        setSavedEmail(null);
        await AsyncStorage.multiRemove(['token', 'userEmail']); 
        setError(null);
        console.log('AuthContext: After logout - token:', token, 'user:', user, 'isAuthenticated:', !!token && !!user);
    };

  const updateUser = async (userData: Partial<User>) => {
    if (!user || !token) throw new Error('No user or token available');
    try {
      const response = await axios.put(
        `${API_BASE_URL}/auth/users/${user.id}`,
        userData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('AuthContext: Update user response:', response.data);
      setUser({ ...user, ...response.data });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response
        ? `Update failed: ${error.response.status} - ${error.response.data?.error || 'No error message'}`
        : `Update failed: ${error.message}`;
      console.error(errorMessage, error);
      throw new Error(errorMessage);
    }
  };

  const isAuthenticated = !!token && !!user;
  console.log('AuthContext: Render - token:', token, 'user:', user, 'isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);

  return (
    <AuthContext.Provider
      value={{ user, token, login, register, logout, updateUser, isAuthenticated, isLoading, error, setError, savedEmail }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
