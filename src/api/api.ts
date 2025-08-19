import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
const API_BASE_URL = 'https://api.courtbooka.rondras.com/';
import { Platform } from 'react-native';

interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  street?: string;
  houseNumber?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  role: string;
  created_at: string;
  is_active?: boolean;
  profile_picture_id?: string;
  profile_picture_filename?: string;
  wallets?: any[];
}

interface Club {
  id: number;
  name: string;
  city?: string;
  country?: string;
  status?: string; // Added for pending/approved status
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  console.log('Request URL:', config.url, 'Token:', token);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getCurrentUserName = async () => {
  try {
    const response = await api.get('/auth/users/me');
    const { firstName, lastName } = response.data;
    return (`${firstName} ${lastName}`);
  } catch (error: any) {
    console.error('Failed to fetch current user name:', error.response?.status, error.response?.data || error.message);
    return ('You');
  }
};

export const getUserBookings = async () => {
  const response = await api.get('/bookings/users/me/bookings');
  console.log('User bookings:', response.data);
  return response.data;
};

export const getClubCourts = async (clubId: number, showAll: boolean = false) => {
  const url = `/bookings/clubs/${clubId}/courts${showAll ? '?show_all=true' : ''}`;
  const response = await api.get(url);
  console.log('Club courts:', response.data);
  return response.data;
};

export const getCourtBookings = async (courtId: number, date: string) => {
  const response = await api.get(`/bookings/courts/${courtId}/bookings?date=${date}`);
  console.log('Court bookings:', response.data);
  return response.data;
};

export const createBooking = async (data: { court_id: number; start_time: string; duration_minutes: number; participant_ids: number[] }) => {
  const response = await api.post('/bookings/', data);
  console.log('Booking created:', response.data);
  return response.data;
};

export const cancelBooking = async (bookingId: number) => {
  const response = await api.delete(`/bookings/bookings/${bookingId}`);
  console.log('Booking cancelled:', response.data);
  return response.data;
};

export const getUserClubs = async () => {
  const response = await api.get('/clubs/users/me/clubs');
  console.log('User clubs:', response.data);
  return response.data;
};

export const getUserClubStatuses = async (): Promise<Club[]> => {
  try {
    const response = await api.get('/clubs/users/me/club-statuses');
    console.log('User club statuses:', response.data);
    return response.data.map((item: any) => ({
      id: item.club_id,
      name: item.club_name,
      city: item.city || undefined,
      country: item.country || undefined,
      status: item.status,
    }));
  } catch (error: any) {
    console.error('Get user club statuses error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
};

export const getClubMembers = async (clubId: number, includePending: boolean = false) => {
  const url = `/clubs/clubs/${clubId}/members${includePending ? '?include_pending=true' : ''}`;
  const response = await api.get(url);
  console.log('Club members:', response.data);
  return response.data;
};

export const getClubSettings = async (clubId: number) => {
  const response = await api.get(`clubs/clubs/${clubId}/settings`);
  console.log('Club settings:', response.data);
  return response.data;
};

export const updateClubSettings = async (clubId: number, maxBookingsAllowed: number) => {
  console.log('Updating club settings:', { clubId, maxBookingsAllowed })
  let payload = { max_bookings_allowed: maxBookingsAllowed };
  console.log('Payload for club settings update:', payload);
  const response = await api.put(`/clubs/clubs/${clubId}/settings`, payload);
  console.log('Club settings updated:', response.data);
  return response.data;
};

export const searchPotentialMembers = async (query: string) => {
  const response = await api.get(`/clubs/users/search?q=${query}`);
  console.log('Search potential members:', response.data);
  return response.data;
};

export const addUserToClub = async (userId: number, clubId: number) => {
  const response = await api.post(`/clubs/users/${userId}/clubs`, { club_id: clubId });
  console.log('User added to club:', response.data);
  return response.data;
};

export const inviteUserToClub = async (clubId: number, email: string, firstName: string, lastName: string) => {
  const response = await api.post(`/clubs/clubs/${clubId}/invite`, {
    email,
    first_name: firstName,
    last_name: lastName,
  });
  console.log('Invite sent:', response.data);
  return response.data;
};

export const approveClubMember = async (clubId: number, userId: number) => {
  const response = await api.put(`/clubs/clubs/${clubId}/members/${userId}/approve`);
  console.log('User approved:', response.data);
  return response.data;
};

export const rejectClubMember = async (clubId: number, userId: number) => {
  const response = await api.put(`/clubs/clubs/${clubId}/members/${userId}/reject`);
  console.log('User rejected:', response.data);
  return response.data;
};

export const removeUserFromClub = async (userId: number, clubId: number) => {
  const response = await api.delete(`/clubs/users/${userId}/clubs/${clubId}`);
  console.log('User removed from club:', response.data);
  return response.data;
};

export const updateUserRole = async (clubId: number, userId: number, role: string) => {
  const response = await api.put(`/clubs/${clubId}/users/${userId}/role`, { role });
  console.log('User role updated:', response.data);
  return response.data;
};

export const createRecurringEvent = async (payload: {
  court_id: number;
  start_time_daily: string;
  end_time_daily: string;
  recurrence: { days: number[] };
  description: string;
  start_date: string;
  end_date: string;
}) => {
  console.log(payload)
  if (!payload.court_id) {
    throw new Error('Court ID must be specified');
  }
  if (!payload.recurrence || !payload.recurrence.days || payload.recurrence.days.length === 0) {
    throw new Error('Recurrence days must be specified');
  }
  if (!payload.start_time_daily || !payload.end_time_daily) {
    throw new Error('Start and end times must be specified');
  }
  if (!payload.start_date || !payload.end_date) {
    throw new Error('Start and end dates must be specified');
  }
  try {
    const response = await api.post('/bookings/bookings/recurring', payload);
    console.log('Recurring event created:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Create recurring event error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
};

export const saveCourt = async (clubId: number, court: { name: string; surface_type: string | null; has_floodlights: boolean; season: string }, courtId?: number) => {
  const payload = courtId
    ? { ...court }
    : { ...court, club_id: clubId };
  const response = courtId
    ? await api.put(`/clubs/courts/${courtId}`, payload)
    : await api.post('/clubs/courts', payload);
  console.log(courtId ? 'Court updated:' : 'Court created:', response.data);
  return response.data;
};

export const deleteCourt = async (courtId: number) => {
  const response = await api.delete(`/clubs/courts/${courtId}`);
  console.log('Court deleted:', response.data);
  return response.data;
};

export const validateInviteToken = async (token: string) => {
  const response = await api.get(`/auth/validate-invite-token?token=${token}`);
  console.log('Invite token validation:', response.data);
  return response.data;
};

export const getAllClubs = async () => {
  const response = await api.get('/clubs/clubs');
  console.log('All clubs:', response.data);
  return response.data;
};

export const joinClub = async (clubId: number) => {
  try {
    const response = await api.post(`/clubs/clubs/${clubId}/join`);
    console.log('Join club response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Join club error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
};

export const getProfilePicture = async (userId: number): Promise<string | null> => {
  try {
    const filename = `profile_picture_${userId}.png`;
    const tempPath = `${RNFS.TemporaryDirectoryPath}/${filename}`;
    const url = `/auth/users/${userId}/profile-picture`;

    const res = await RNFS.downloadFile({
      fromUrl: `${API_BASE_URL}${url}`,
      toFile: tempPath,
      headers: { Authorization: `Bearer ${await AsyncStorage.getItem('token')}` },
    }).promise;

    if (res.statusCode === 200) {
      const fileUri = `file://${tempPath}`;
      console.log('Profile pic downloaded:', fileUri);
      return fileUri;
    } else if (res.statusCode === 404) {
      console.log('No profile pic found');
      return null;
    } else {
      throw new Error(`Download failed: ${res.statusCode}`);
    }
  } catch (err: any) {
    console.error('Get profile pic error:', err.message);
    return null;
  }
};

export const uploadProfilePicture = async (uri: string, type: string = 'image/jpeg', name: string = 'profile.jpg') => {
  try {
    console.log('Uploading profile pic with params:', { uri, type, name });
    const formData = new FormData();
    formData.append('image', {
      uri,
      type,
      name,
    } as any);
    const response = await api.post('/auth/users/me/profile-picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    console.log('Profile pic uploaded:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Upload profile pic error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
};

export const updateProfile = async (data: Partial<UserProfile>) => {
  try {
    if (!data.id) {
      throw new Error('User ID is required');
    }
    const response = await api.put(`/auth/users/${data.id}`, data);
    console.log('Profile updated:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Update profile error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
};
export const requestPasswordReset = async (email: string) => {
  try {
    const response = await api.post('/auth/forgot-password', { email });
    console.log('Password reset link requested:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Request password reset error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
};
export const resetPassword = async (token: string, password: string) => {
  try {
    const response = await api.post('/auth/reset-password', { token, password });
    console.log('Password reset response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Reset password error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
};

// New function: Outsourced club creation API call
export const createClub = async (data: {
  name: string;
  street: string;
  houseNumber: string;
  city: string;
  postalCode: string;
  country: string;
  numberOfCourts: number;
  hasFloodlights: boolean;
  initial_admin_id: number;
}) => {
  try {
    const response = await api.post('/clubs', data);
    console.log('Club created:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Create club error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
};

export const getClubRecurringEvents = async (clubId: number) => {
  try {
    const response = await api.get(`/bookings/clubs/${clubId}/recurring`);
    console.log('Club recurring events:', response);
    return response.data;
  } catch (error: any) {
    console.error('Get club recurring events error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
};

export const deleteRecurringEvent = async (id: number) => {
  try {
    const response = await api.delete(`/bookings/recurring/${id}`);
    console.log('Recurring event deleted:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Delete recurring event error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
};

export const updateRecurringEvent = async (id: number, payload: {
  court_id: number;
  start_time_daily: string;
  end_time_daily: string;
  recurrence: { days: number[] };
  description: string;
  start_date: string;
  end_date: string;
}) => {
  try {
    const response = await api.put(`/bookings/recurring/${id}`, payload);
    console.log('Recurring event updated:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Update recurring event error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
};
export const updateBooking = async (bookingId: number, data: any) => {
  try {
    const response = await api.put(`/bookings/bookings/${bookingId}`, data);
    return response.data;
  } catch (error) {
    console.error('Update booking error:', error);
    throw error;
  }
};

export default api;