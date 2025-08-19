// context/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

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

interface Club {
  id: number;
  name: string;
  // ... other club fields
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  handleGoogleAuth: (role: string) => Promise<void>;
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
    invite_token?: string;  // NEW: Added for invite handling
  }) => Promise<{ access_token?: string; [key: string]: any }>;  // NEW: Return full response for token handling
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  savedEmail: string | null;
  loadPassword: (email: string) => Promise<string | null>;
  clearPassword: () => Promise<void>;
  isSuperAdmin: boolean; // NEW
  isClubAdmin: boolean; // NEW
  userClubs: Club[]; // NEW: List of user's clubs with roles
  fetchUserClubs: () => Promise<void>; // NEW
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const API_BASE_URL = 'https://api.courtbooka.rondras.com';

// Initialisiere Google Sign-In
GoogleSignin.configure({
  webClientId: '596452790791-r3tgi1q62apn42iukrit021hn2ldldq1.apps.googleusercontent.com',
  iosClientId: '596452790791-r3tgi1q62apn42iukrit021hn2ldldq1.apps.googleusercontent.com',
});

const saveEmail = async (email: string) => {
  try {
    await AsyncStorage.setItem('userEmail', email);
    console.log('AuthContext: E-Mail gespeichert:', email);
  } catch (error) {
    console.error('AuthContext: Fehler beim Speichern der E-Mail:', error);
  }
};

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

const savePassword = async (email: string, password: string) => {
  try {
    await Keychain.setGenericPassword(email, password);
    console.log('AuthContext: Password saved in Keychain for email:', email);
  } catch (error) {
    console.error('AuthContext: Error saving password to Keychain:', error);
  }
};

const loadPassword = async (email: string): Promise<string | null> => {
  try {
    const credentials = await Keychain.getGenericPassword();
    if (credentials && credentials.username === email) {
      console.log('AuthContext: Password loaded from Keychain for email:', email);
      return credentials.password;
    }
    return null;
  } catch (error) {
    console.error('AuthContext: Error loading password from Keychain:', error);
    return null;
  }
};

const clearPassword = async () => {
  try {
    await Keychain.resetGenericPassword();
    console.log('AuthContext: Password cleared from Keychain');
  } catch (error) {
    console.error('AuthContext: Error clearing password from Keychain:', error);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [userClubs, setUserClubs] = useState<Club[]>([]); // NEW
  const isSuperAdmin = user?.role === 'superadmin'; // NEW
  const isClubAdmin = userClubs.some(club => club.role === 'admin'); // NEW: Assuming club object has role; adjust based on API

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
    const fetchUser = async () => {
      if (token && savedEmail) {
        try {
          console.log('AuthContext: Fetching user with token:', token);
          const response = await axios.get(`${API_BASE_URL}/auth/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log('AuthContext: User fetched:', response.data);
          setUser(response.data);
          setError(null);
          await fetchUserClubs(); // NEW: Fetch clubs after user
        } catch (error: any) {
          const errorMessage = error.response
            ? `Failed to fetch user: ${error.response.status} - ${error.response.data?.msg || error.response.data?.error || 'No error message'}`
            : `Failed to fetch user: ${error.message}`;
          console.error(errorMessage, error);

          if (error.response?.status === 401) {
            console.log('AuthContext: Token expired, attempting re-authentication');
            const password = await loadPassword(savedEmail);
            if (password) {
              try {
                await login(savedEmail, password);
                return;
              } catch (reAuthError: any) {
                console.error('AuthContext: Re-authentication failed:', reAuthError.message);
                setError('Session expired. Please log in again.');
                setToken(null);
                setUser(null);
                await AsyncStorage.removeItem('token');
              }
            } else {
              setError('No saved credentials found. Please log in again.');
              setToken(null);
              setUser(null);
              await AsyncStorage.removeItem('token');
            }
          } else {
            setError(errorMessage);
            setToken(null);
            setUser(null);
            await AsyncStorage.removeItem('token');
          }
        }
      }
      setIsLoading(false);
    };
    fetchUser();
  }, [token, savedEmail]);

  const fetchUserClubs = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/clubs/users/me/clubs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(response.data)
      setUserClubs(response.data.map(club => ({ ...club, role: club.role || 'member' }))); // Assume API returns role in club
      console.log(userClubs)
    } catch (error) {
      console.error('Fetch user clubs error:', error);
    }
  };

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
      await savePassword(email, password);
      setUser(userData);
      setError(null);
      setSavedEmail(email);
      await fetchUserClubs(); // NEW
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

  const handleGoogleAuth = async (role: string) => {
    try {
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        throw new Error('No ID token received from Google Sign-In');
      }

      console.log('AuthContext: Google Sign-In successful, ID token:', idToken);

      // Versuche zuerst, sich einzuloggen
      try {
        const loginResponse = await axios.post(`${API_BASE_URL}/auth/google-login`, {
          idToken,
        });
        console.log('AuthContext: Google login response:', loginResponse.data);
        const { access_token, ...userData } = loginResponse.data;
        setIsLoading(true);
        setToken(access_token);
        await AsyncStorage.setItem('token', access_token);
        await saveEmail(userData.email);
        setUser(userData);
        setError(null);
        setSavedEmail(userData.email);
        await fetchUserClubs(); // NEW
        setIsLoading(false);
        console.log('AuthContext: After Google login - user:', userData, 'isAuthenticated:', !!access_token && !!userData);
      } catch (loginError: any) {
        // Wenn der Login fehlschlägt (z.B. Benutzer existiert nicht), versuche zu registrieren
        if (loginError.response?.status === 404 || loginError.response?.data?.error.includes('User not found')) {
          console.log('AuthContext: User not found, attempting registration');
          const registerResponse = await axios.post(`${API_BASE_URL}/auth/google-register`, {
            idToken,
            firstName: userInfo.data?.user?.givenName || '',
            lastName: userInfo.data?.user?.familyName || '',
            street: '',
            houseNumber: '',
            city: '',
            postalCode: '',
            country: '',
            role,
          });
          console.log('AuthContext: Google register response:', registerResponse.data);
          const { access_token, ...userData } = registerResponse.data;
          setIsLoading(true);
          setToken(access_token);
          await AsyncStorage.setItem('token', access_token);
          await saveEmail(userData.email);
          setUser(userData);
          if (!userData.street || !userData.houseNumber || !userData.city || !userData.postalCode || !userData.country) {
            setError('Bitte vervollständigen Sie Ihr Profil');
          }
          setSavedEmail(userData.email);
          await fetchUserClubs(); // NEW
          setIsLoading(false);
          console.log('AuthContext: After Google register - user:', userData, 'isAuthenticated:', !!access_token && !!userData);
        } else {
          throw loginError;
        }
      }
    } catch (error: any) {
      let errorMessage = 'Google authentication failed';
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = 'Google Sign-In cancelled';
      } else if (error.code === statusCodes.IN_PROGRESS) {
        errorMessage = 'Google Sign-In already in progress';
      } else {
        errorMessage = error.response
          ? `Google authentication failed: ${error.response.status} - ${error.response.data?.error || 'No error message'}`
          : `Google authentication failed: ${error.message}`;
      }
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
    invite_token?: string;  // NEW: Added to type for invite support
  }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, userData);
      console.log('AuthContext: Register response:', response.data);
      // NEW: If backend returns access_token (invite case), auto-authenticate
      if (response.data.access_token) {
        const { access_token, ...userDataFromResponse } = response.data;
        setIsLoading(true);
        setToken(access_token);
        await AsyncStorage.setItem('token', access_token);
        await saveEmail(userData.email);
        await savePassword(userData.email, userData.password);  // Save password for future re-auth
        setUser(userDataFromResponse);
        setError(null);
        setSavedEmail(userData.email);
        await fetchUserClubs();
        setIsLoading(false);
        console.log('AuthContext: Auto-auth after invite register - user:', userDataFromResponse, 'isAuthenticated:', !!access_token && !!userDataFromResponse);
      }
      // NEW: Return full response for screen to handle (e.g., non-invite navigation)
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response
        ? `Registration failed: ${error.response.status} - ${error.response.data?.error || 'No error message'}`
        : `Registration failed: ${error.message}`;
      console.error(errorMessage, error);
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    console.log('AuthContext: Logging out');
    try {
      await GoogleSignin.signOut();
    } catch (error) {
      console.error('AuthContext: Error signing out from Google:', error);
    }
    setToken(null);
    setUser(null);
    setSavedEmail(null);
    setUserClubs([]); // NEW
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
      await fetchUserClubs(); // NEW: Refresh clubs if role changes
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
      value={{
        user,
        token,
        login,
        handleGoogleAuth,
        register,
        logout,
        updateUser,
        isAuthenticated,
        isLoading,
        error,
        setError,
        savedEmail,
        loadPassword,
        clearPassword,
        isSuperAdmin, // NEW
        isClubAdmin, // NEW
        userClubs, // NEW
        fetchUserClubs, // NEW
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);