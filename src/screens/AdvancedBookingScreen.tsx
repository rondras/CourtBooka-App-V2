import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  Modal,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ScrollView,
  Pressable,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Animated, { 
  FadeIn, 
  FadeInUp, 
  FadeInLeft, 
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Easing,
  SlideInDown,
  ZoomIn,
  Layout
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from 'react-native-haptic-feedback';
import { useTheme } from '../../App';
import { getUserClubs, getClubCourts, getCourtBookings, getClubMembers, createBooking, cancelBooking, getCurrentUserName, updateBooking } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { format, addMinutes, setHours, setMinutes as dateSetMinutes, isAfter, startOfDay, isToday, addDays } from 'date-fns';
import { de, enUS } from 'date-fns/locale'; // Add locale imports

import Navbar from '../components/Navbar';
import UserMenu from '../components/UserMenu';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation, TFunction } from 'react-i18next';
import BookingModal from '../components/BookingModal';
import { COLORS, SPACING } from '../constants/colors';

const dateLocales = {
  en: enUS,
  de: de,
  // Add more locales as needed
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Member {
  id?: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  bookable: boolean;
  status: string;
  role: string;
}

interface Slot {
  start: Date;
  end: Date;
}

interface CourtCardProps {
  item: any;
  bookings: any[];
  slots: Slot[];
  formatToCEST: (date: Date) => string;
  onSlotPress: (slot: Slot, courtIndex: number) => void;
  slotListRef: (ref: FlatList<any> | null) => void;
  styles: any;
  colors: any;
  refreshing: boolean;
  onRefresh: () => void;
  t: TFunction;
  courtIndex: number;
  isLoading: boolean;
  scrollIndex: number;
  onScroll: (index: number) => void;
}

interface SlotItemProps {
  slot: Slot;
  bookings: any[];
  formatToCEST: (date: Date) => string;
  colors: any;
  onPress: () => void;
  styles: any;
  t: TFunction;
  index: number;
}

interface BookingsCache {
  [courtId: number]: {
    [date: string]: any[];
  };
}

const AdvancedBookingScreen: React.FC = () => {
  const theme = useTheme();
  const { colors } = theme;
  const { t, i18n } = useTranslation();
  const { user, isSuperAdmin, userClubs } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const editBooking = route.params?.editBooking;
  const [clubs, setClubs] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const [selectedClubName, setSelectedClubName] = useState('');
  const [courts, setCourts] = useState([]);
  const [selectedCourtIndex, setSelectedCourtIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Enhanced booking state with cache
  const [bookingsCache, setBookingsCache] = useState<BookingsCache>({});
  const [currentCourtBookings, setCurrentCourtBookings] = useState<any[]>([]);
  const [loadingCourts, setLoadingCourts] = useState<Set<number>>(new Set());
  
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showClubModal, setShowClubModal] = useState(false);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [duration, setDuration] = useState(60);
  const [currentUserName, setCurrentUserName] = useState(t('advancedBooking.currentUserChip', { name: 'You' }));
  
  // Single shared scroll position for all courts
  const [sharedScrollIndex, setSharedScrollIndex] = useState<number>(0);
  const isScrollingProgrammatically = useRef(false);
  
  const slotListRefs = useRef<FlatList[]>([]);
  const courtCarouselRef = useRef<FlatList>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [isInitialSet, setIsInitialSet] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEventEditModal, setShowEventEditModal] = useState(false);
  const [eventDescription, setEventDescription] = useState('');
  
  // Preloading state
  const preloadingRef = useRef(false);
  const [preloadProgress, setPreloadProgress] = useState(0);

  const styles = useMemo(() => createStyles(colors), [colors]);
  const adminClubs = userClubs.filter(club => club.role === 'admin');

  // Animation values
  const courtCardScale = useSharedValue(1);
  const headerOpacity = useSharedValue(0);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, []);

  useEffect(() => {
    fetchUserClubs();
    fetchCurrentUserName();
    if (editBooking) {
      setEditMode(true);
    }
  }, [editBooking]);

  useEffect(() => {
    if (selectedClubId) {
      fetchCourts(selectedClubId);
      fetchMembers(selectedClubId);
    }
  }, [selectedClubId]);

  useEffect(() => {
    const filtered = members.filter(m => 
      (m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.email || '').toLowerCase().includes(memberSearch.toLowerCase())
    );
    setFilteredMembers(filtered);
  }, [memberSearch, members]);

  // Update current court bookings when cache changes
  useEffect(() => {
    if (courts.length > 0) {
      const courtId = courts[selectedCourtIndex].id;
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const cachedBookings = bookingsCache[courtId]?.[dateStr];
      
      if (cachedBookings) {
        setCurrentCourtBookings(cachedBookings);
      } else {
        // Fetch if not in cache
        fetchBookingsForCourt(courtId, dateStr, selectedCourtIndex);
      }
    }
  }, [selectedDate, selectedCourtIndex, courts, bookingsCache]);

  // Preload all courts when courts list changes or date changes
  useEffect(() => {
    if (courts.length > 1 && !preloadingRef.current) {
      preloadAllCourts();
    }
  }, [courts, selectedDate]);

  useEffect(() => {
    if (editMode && editBooking && courts.length > 0 && members.length > 0 && selectedClubId === editBooking.club_id && !isInitialSet) {
      try {
        console.log('Edit booking object:', editBooking); // Debug log to see the structure
        
        const courtIndex = courts.findIndex(c => c.id === editBooking.court_id);
        if (courtIndex >= 0) {
          setSelectedCourtIndex(courtIndex);
          
          // Check if the booking has the required time properties
          if (!editBooking.start_time || !editBooking.end_time) {
            console.error('Missing time properties in editBooking:', editBooking);
            Alert.alert(t('advancedBooking.errorTitle'), t('advancedBooking.invalidBookingData'));
            return;
          }
          
          // Handle both Date objects and strings
          let bookingStart: Date;
          let bookingEnd: Date;
          
          // If already Date objects
          if (editBooking.start_time instanceof Date) {
            bookingStart = editBooking.start_time;
            bookingEnd = editBooking.end_time;
          } else {
            // If strings, parse them
            const bookingStartStr = String(editBooking.start_time);
            const bookingEndStr = String(editBooking.end_time);
            
            // Add 'Z' if not present for UTC parsing
            const startTimeStr = bookingStartStr.endsWith('Z') ? bookingStartStr : bookingStartStr + 'Z';
            const endTimeStr = bookingEndStr.endsWith('Z') ? bookingEndStr : bookingEndStr + 'Z';
            
            bookingStart = new Date(startTimeStr);
            bookingEnd = new Date(endTimeStr);
          }
          
          // Validate dates
          if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
            console.error('Invalid booking dates after parsing:', bookingStart, bookingEnd);
            Alert.alert(t('advancedBooking.errorTitle'), t('advancedBooking.invalidBookingData'));
            return;
          }
          
          setSelectedDate(bookingStart);
          setSelectedStart(bookingStart);
          setDuration((bookingEnd.getTime() - bookingStart.getTime()) / 60000);
          setSelectedParticipants(editBooking.participant_ids || []);
          setSelectedBooking(editBooking);
          
          if (editBooking.type === 'regular') {
            setShowParticipantModal(true);
          } else if (editBooking.type === 'event') {
            openEventEdit(editBooking);
          }
          setIsInitialSet(true);
        }
      } catch (error) {
        console.error('Error initializing edit mode:', error);
        Alert.alert(t('advancedBooking.errorTitle'), t('advancedBooking.loadEditError'));
      }
    }
  }, [editMode, editBooking, courts, members, selectedClubId, isInitialSet]);

  const fetchCurrentUserName = async () => {
    setLoading(true);
    try {
      const data = await getCurrentUserName();
      setCurrentUserName(t('advancedBooking.currentUserChip', { name: data }));
    } catch (error: any) {
      Alert.alert(t('advancedBooking.errorTitle'), t('advancedBooking.failedToLoadUserName'));
      console.error('Fetch user name error:', error.response?.status, error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserClubs = async () => {
    setLoading(true);
    try {
      const data = await getUserClubs();
      setClubs(data);
      if (data.length > 0) {
        const initialClubId = editBooking ? editBooking.club_id : data[0].id;
        const initialClub = data.find(c => c.id === initialClubId);
        setSelectedClubId(initialClubId);
        setSelectedClubName(initialClub ? initialClub.name : data[0].name);
      }
    } catch (error: any) {
      Alert.alert(t('advancedBooking.errorTitle'), t('advancedBooking.failedToLoadClubs'));
      console.error('Fetch clubs error:', error.response?.status, error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourts = async (clubId: number) => {
    setLoading(true);
    try {
      const data = await getClubCourts(clubId);
      setCourts(data);
      slotListRefs.current = new Array(data.length).fill(null);
      
      // Clear cache when switching clubs
      setBookingsCache({});
      setPreloadProgress(0);
      preloadingRef.current = false;
      
      // Set initial scroll position
      const slots = generateSlots(selectedDate);
      let initialIndex = 0;
      if (isToday(selectedDate)) {
        initialIndex = slots.findIndex(slot => isAfter(slot.start, new Date())) || 0;
      }
      setSharedScrollIndex(initialIndex);
      
      if (data.length > 0) {
        setSelectedCourtIndex(0);
        // Fetch first court immediately
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        await fetchBookingsForCourt(data[0].id, dateStr, 0);
      }
    } catch (error: any) {
      Alert.alert(t('advancedBooking.errorTitle'), t('advancedBooking.failedToLoadCourts'));
      console.error('Fetch courts error:', error.response?.status, error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (clubId: number) => {
    try {
      const currentUserIdNum = Number(user?.id);
      if (!currentUserIdNum) {
        console.warn('fetchMembers: user.id is invalid or undefined:', user?.id);
        Alert.alert(t('advancedBooking.errorTitle'), t('advancedBooking.invalidSession'));
        return;
      }
      const response = await getClubMembers(clubId, true);
      const data = Array.isArray(response) ? response : [];
      if (!Array.isArray(response)) {
        console.error('fetchMembers: Expected array, received:', response);
        Alert.alert(t('advancedBooking.errorTitle'), t('advancedBooking.invalidMembersData'));
      }
      const filteredData = data.filter((m: Member) => m.id !== currentUserIdNum);
      setMembers(filteredData);
      setFilteredMembers(filteredData);
    } catch (error: any) {
      Alert.alert(t('advancedBooking.errorTitle'), t('advancedBooking.failedToLoadMembers'));
      console.error('Fetch members error:', error.response?.status, error.response?.data || error.message);
    }
  };

  // New function to fetch bookings for a specific court
  const fetchBookingsForCourt = async (courtId: number, dateStr: string, courtIndex: number) => {
    try {
      // Mark as loading
      setLoadingCourts(prev => new Set(prev).add(courtId));
      
      const response = await getCourtBookings(courtId, dateStr);
      const parsedBookings = response.map((b: any) => ({
        ...b,
        start_time: new Date(b.start_time + (b.start_time.endsWith('Z') ? '' : 'Z')),
        end_time: new Date(b.end_time + (b.end_time.endsWith('Z') ? '' : 'Z')),
      }));
      
      // Update cache
      setBookingsCache(prev => ({
        ...prev,
        [courtId]: {
          ...prev[courtId],
          [dateStr]: parsedBookings
        }
      }));
      
      // If this is the currently selected court, update current bookings
      if (courtIndex === selectedCourtIndex) {
        setCurrentCourtBookings(parsedBookings);
      }
      
      // Remove from loading set
      setLoadingCourts(prev => {
        const newSet = new Set(prev);
        newSet.delete(courtId);
        return newSet;
      });
      
      return parsedBookings;
    } catch (error: any) {
      console.error('Fetch bookings error for court', courtId, error);
      setLoadingCourts(prev => {
        const newSet = new Set(prev);
        newSet.delete(courtId);
        return newSet;
      });
      return [];
    }
  };

  // Preload all courts in the background
  const preloadAllCourts = async () => {
    if (preloadingRef.current || courts.length <= 1) return;
    
    preloadingRef.current = true;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const totalCourts = courts.length;
    let loaded = 0;
    
    // Start preloading other courts after a short delay
    setTimeout(async () => {
      for (let i = 0; i < courts.length; i++) {
        // Skip if already loaded or currently selected (already loading)
        if (bookingsCache[courts[i].id]?.[dateStr]) {
          loaded++;
          setPreloadProgress((loaded / totalCourts) * 100);
          continue;
        }
        
        // Skip current court if it's being loaded
        if (i === selectedCourtIndex) {
          loaded++;
          setPreloadProgress((loaded / totalCourts) * 100);
          continue;
        }
        
        // Preload with a small delay between requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
        await fetchBookingsForCourt(courts[i].id, dateStr, i);
        
        loaded++;
        setPreloadProgress((loaded / totalCourts) * 100);
      }
      
      preloadingRef.current = false;
    }, 500); // Start preloading after 500ms
  };

  // Handle unified scroll position
  const handleSlotListScroll = useCallback((index: number) => {
    if (!isScrollingProgrammatically.current) {
      setSharedScrollIndex(index);
      
      // Sync all other court lists to the same position
      slotListRefs.current.forEach((ref, courtIndex) => {
        if (ref && courtIndex !== selectedCourtIndex) {
          isScrollingProgrammatically.current = true;
          ref.scrollToIndex({
            index,
            animated: false,
            viewPosition: 0
          });
          setTimeout(() => {
            isScrollingProgrammatically.current = false;
          }, 100);
        }
      });
    }
  }, [selectedCourtIndex]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.trigger('impactLight');
    
    // Clear cache for current date and refetch all courts
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setBookingsCache({});
    preloadingRef.current = false;
    
    // Fetch current court first
    if (courts.length > 0) {
      await fetchBookingsForCourt(courts[selectedCourtIndex].id, dateStr, selectedCourtIndex);
      // Then preload others
      preloadAllCourts();
    }
    
    setRefreshing(false);
  }, [courts, selectedCourtIndex, selectedDate]);

  const generateSlots = (date: Date) => {
    const slots: Slot[] = [];
    for (let hour = 8; hour <= 21; hour++) {
      [0, 30].forEach(min => {
        const start = dateSetMinutes(setHours(startOfDay(date), hour), min);
        const end = addMinutes(start, 30);
        slots.push({ start, end });
      });
    }
    return slots;
  };

  const toggleParticipant = (member: Member) => {
    if (!member.id || !member.bookable || member.status !== 'approved') {
      Haptics.trigger('notificationError');
      Alert.alert(t('advancedBooking.cannotSelect'), 
        member.status === 'pending' ? t('advancedBooking.cannotSelectPending') : t('advancedBooking.cannotSelectLimit'));
      return;
    }
    Haptics.trigger('impactLight');
    setSelectedParticipants(prev => {
      if (prev.includes(member.id!)) {
        return prev.filter(p => p !== member.id!);
      }
      if (prev.length >= 3) {
        Haptics.trigger('notificationWarning');
        Alert.alert(t('advancedBooking.maximumReached'), t('advancedBooking.maxParticipants'));
        return prev;
      }
      return [...prev, member.id!];
    });
  };

  const removeParticipant = (id: number) => {
    Haptics.trigger('impactLight');
    setSelectedParticipants(prev => prev.filter(p => p !== id));
  };

  const onSlotPress = (slot: Slot, courtIndex: number) => {
    const courtId = courts[courtIndex].id;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const bookings = bookingsCache[courtId]?.[dateStr] || [];
    
    const isPast = !isAfter(slot.start, new Date());
    const isBooked = bookings.some(b => slot.start < b.end_time && slot.end > b.start_time);
    const bookedBy = isBooked ? bookings.find(b => slot.start < b.end_time && slot.end > b.start_time) : null;

    if (isPast) {
      return;
    }

    if (isBooked && bookedBy) {
      Haptics.trigger('impactMedium');
      setSelectedBooking(bookedBy);
      setShowDetailsModal(true);
    } else {
      confirmBookSlot(slot.start, courtIndex);
    }
  };

  const confirmBookSlot = (start: Date, courtIndex?: number) => {
    if (!isAfter(start, new Date())) {
      Haptics.trigger('notificationError');
      Alert.alert(t('advancedBooking.invalidSelection'), t('advancedBooking.pastSlot'));
      return;
    }
    
    // If a different court was selected from the slot, switch to it
    if (courtIndex !== undefined && courtIndex !== selectedCourtIndex) {
      setSelectedCourtIndex(courtIndex);
    }
    
    Haptics.trigger('impactMedium');
    setSelectedStart(start);
    setSelectedParticipants([]);
    setDuration(60);
    setMemberSearch('');
    setShowParticipantModal(true);
  };

  const bookSlot = async () => {
    if (!selectedStart || selectedParticipants.length === 0) {
      Haptics.trigger('notificationError');
      Alert.alert(t('advancedBooking.incompleteSelection'), t('advancedBooking.selectParticipants'));
      return;
    }
    Haptics.trigger('impactHeavy');
    const action = selectedBooking ? t('advancedBooking.confirmUpdate') : t('advancedBooking.confirmBook');
    Alert.alert(
      action,
      selectedBooking 
        ? t('advancedBooking.updateConfirmation', { 
            startTime: formatToCEST(selectedStart), 
            duration, 
            participantCount: selectedParticipants.length 
          })
        : t('advancedBooking.bookConfirmation', { 
            startTime: formatToCEST(selectedStart), 
            duration, 
            participantCount: selectedParticipants.length 
          }),
      [
        { text: t('profile.cancel'), style: 'cancel' },
        {
          text: t('advancedBooking.confirmButton'),
          onPress: async () => {
            const data = { 
              court_id: courts[selectedCourtIndex].id, 
              start_time: selectedStart.toISOString(), 
              duration_minutes: duration, 
              participant_ids: selectedParticipants,
            };
            try {
              if (selectedBooking) {
                await updateBooking(selectedBooking.id, data);  // Use the imported function
                Haptics.trigger('notificationSuccess');
                Alert.alert(t('advancedBooking.updateSuccessful'), t('advancedBooking.bookingUpdated'));
              } else {
                await createBooking(data);
                Haptics.trigger('notificationSuccess');
                Alert.alert(t('advancedBooking.bookingSuccessful'), t('advancedBooking.courtBooked'));
              }
              
              // Clear cache for this court and date to force refresh
              const dateStr = format(selectedDate, 'yyyy-MM-dd');
              setBookingsCache(prev => {
                const newCache = { ...prev };
                if (newCache[courts[selectedCourtIndex].id]) {
                  delete newCache[courts[selectedCourtIndex].id][dateStr];
                }
                return newCache;
              });
              
              // Refetch bookings
              await fetchBookingsForCourt(courts[selectedCourtIndex].id, dateStr, selectedCourtIndex);
              
              setShowParticipantModal(false);
              setSelectedBooking(null);
              if (editMode) {
                setEditMode(false);
                navigation.goBack();
              }
            } catch (error: any) {
              Haptics.trigger('notificationError');
              const errMsg = error.response?.data?.error || t('advancedBooking.eventUpdateFailed');
              // ... rest of error handling
            }
          },
        },
      ]
    );
  };

  const findAlternativeSlot = async (preferredStart: Date, dur: number) => {
    try {
      const dateStr = format(preferredStart, 'yyyy-MM-dd');
      
      for (const court of courts) {
        if (court.id === courts[selectedCourtIndex].id) continue;
        
        // Check cache first
        let bookingsOther = bookingsCache[court.id]?.[dateStr];
        
        // If not in cache, fetch it
        if (!bookingsOther) {
          const response = await getCourtBookings(court.id, dateStr);
          bookingsOther = response.map(b => ({
            start_time: new Date(b.start_time),
            end_time: new Date(b.end_time)
          }));
        }
        
        const isFree = !bookingsOther.some(b => preferredStart < b.end_time && addMinutes(preferredStart, dur) > b.start_time);
        if (isFree) {
          return { court_name: court.name, court_id: court.id, start: preferredStart };
        }
      }
      return null;
    } catch (error: any) {
      console.error('Alternative search error:', error.response?.status, error.response?.data || error.message);
      return null;
    }
  };

  const handleCancel = async (id: number) => {
    Alert.alert(
      t('advancedBooking.confirmCancel'),
      t('advancedBooking.cancelConfirmation'),
      [
        { text: t('advancedBooking.noButton'), style: 'cancel' },
        {
          text: t('advancedBooking.yesButton'),
          onPress: async () => {
            try {
              await cancelBooking(id);
              Alert.alert(t('advancedBooking.cancelSuccess'), t('advancedBooking.bookingCancelled'));
              
              // Clear cache and refetch
              const dateStr = format(selectedDate, 'yyyy-MM-dd');
              setBookingsCache(prev => {
                const newCache = { ...prev };
                if (newCache[courts[selectedCourtIndex].id]) {
                  delete newCache[courts[selectedCourtIndex].id][dateStr];
                }
                return newCache;
              });
              
              await fetchBookingsForCourt(courts[selectedCourtIndex].id, dateStr, selectedCourtIndex);
              setShowDetailsModal(false);
            } catch (error: any) {
              Alert.alert(t('advancedBooking.errorTitle'), t('advancedBooking.cancelFailed'));
              console.error('Cancel error:', error.response?.status, error.response?.data || error.message);
            }
          },
        },
      ]
    );
  };

  const isEditable = (booking: any) => {
    if (!booking) return false;
    return booking.user_id === user?.id || isSuperAdmin || adminClubs.some(c => c.id === selectedClubId);
  };

  const handleDateConfirm = (date: Date) => {
    Haptics.trigger('impactLight');
    setShowDatePicker(false);
    
    // Clear cache and reset scroll position if date changed
    if (format(date, 'yyyy-MM-dd') !== format(selectedDate, 'yyyy-MM-dd')) {
      setBookingsCache({});
      preloadingRef.current = false;
      setPreloadProgress(0);
      
      // Set initial scroll for new date
      const slots = generateSlots(date);
      let initialIndex = 0;
      if (isToday(date)) {
        initialIndex = slots.findIndex(slot => isAfter(slot.start, new Date())) || 0;
      }
      setSharedScrollIndex(initialIndex);
    }
    
    setSelectedDate(date);
  };

  const handleTimeConfirm = (time: Date) => {
    Haptics.trigger('impactLight');
    setShowTimePicker(false);
    const newStart = new Date(selectedDate);
    newStart.setHours(time.getHours());
    newStart.setMinutes(time.getMinutes());
    if (newStart.getMinutes() % 30 !== 0) {
      Alert.alert(t('advancedBooking.invalidTime'), t('advancedBooking.timeRestriction'));
      return;
    }
    setSelectedStart(newStart);
  };

  const formatToCEST = (date: Date) => {
    if (isNaN(date.getTime())) return t('advancedBooking.invalidDate');
    return new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  };

  const openEventEdit = (booking: any) => {
    try {
      console.log('Opening event edit for booking:', booking); // Debug log
      
      if (!booking.start_time || !booking.end_time) {
        throw new Error('Missing time properties in booking');
      }
      
      let startTime: Date;
      let endTime: Date;
      
      // Handle both Date objects and strings
      if (booking.start_time instanceof Date) {
        startTime = booking.start_time;
        endTime = booking.end_time;
      } else {
        const startTimeStr = String(booking.start_time);
        const endTimeStr = String(booking.end_time);
        
        // Add 'Z' if not present for UTC parsing
        const startStr = startTimeStr.endsWith('Z') ? startTimeStr : startTimeStr + 'Z';
        const endStr = endTimeStr.endsWith('Z') ? endTimeStr : endTimeStr + 'Z';
        
        startTime = new Date(startStr);
        endTime = new Date(endStr);
      }
      
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new Error('Invalid booking times after parsing');
      }
      
      setSelectedBooking(booking);
      setSelectedStart(startTime);
      setDuration((endTime.getTime() - startTime.getTime()) / 60000);
      setEventDescription(booking.description || '');
      setShowEventEditModal(true);
      setShowDetailsModal(false);
    } catch (error) {
      console.error('Error opening event edit:', error);
      Alert.alert(t('advancedBooking.errorTitle'), t('advancedBooking.loadEditError'));
    }
  };

  const saveEventEdit = async () => {
    if (!selectedStart || !eventDescription) {
      Haptics.trigger('notificationError');
      Alert.alert(t('advancedBooking.incompleteEvent'), t('advancedBooking.descriptionRequired'));
      return;
    }
    Haptics.trigger('impactHeavy');
    const data = {
      court_id: courts[selectedCourtIndex].id,
      start_time: selectedStart.toISOString(),
      duration_minutes: duration,
      description: eventDescription,
    };
    try {
      await updateBooking(selectedBooking.id, data);  // Use the imported function
      Haptics.trigger('notificationSuccess');
      Alert.alert(t('advancedBooking.eventUpdateSuccessful'), t('advancedBooking.eventUpdated'));
      
      // Clear cache and refetch
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      setBookingsCache(prev => {
        const newCache = { ...prev };
        if (newCache[courts[selectedCourtIndex].id]) {
          delete newCache[courts[selectedCourtIndex].id][dateStr];
        }
        return newCache;
      });
      
      await fetchBookingsForCourt(courts[selectedCourtIndex].id, dateStr, selectedCourtIndex);
      setShowEventEditModal(false);
      setSelectedBooking(null);
    } catch (error: any) {
      Haptics.trigger('notificationError');
      Alert.alert(t('advancedBooking.operationFailed'), error.response?.data?.error || t('advancedBooking.eventUpdateFailed'));
      console.error('Event update error:', error.response?.status, error.response?.data || error.message);
    }
  };

  const editSeries = async (recurringId: number) => {
    Alert.alert(t('advancedBooking.editSeries'), t('advancedBooking.editSeriesComingSoon'));
  };

  const slots = generateSlots(selectedDate);

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: interpolate(headerOpacity.value, [0, 1], [-20, 0]) }]
  }));

  // Get bookings for a specific court
  const getBookingsForCourt = (courtIndex: number) => {
    if (courts.length === 0) return [];
    const courtId = courts[courtIndex].id;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return bookingsCache[courtId]?.[dateStr] || [];
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.loadingContainer}>
          <Animated.View entering={ZoomIn.delay(200).springify()}>
            <ActivityIndicator color={COLORS.courtBlue} size="large" />
          </Animated.View>
          <Animated.Text entering={FadeInUp.delay(300)} style={styles.loadingText}>
            {t('advancedBooking.loadingText')}
          </Animated.Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (clubs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Navbar navigation={navigation} onProfilePress={() => setShowUserMenu(true)} />
        {showUserMenu && <UserMenu onClose={() => setShowUserMenu(false)} navigation={navigation} />}
        <Animated.View entering={FadeInUp.springify()} style={styles.noDataContainer}>
          <Animated.View entering={ZoomIn.delay(200)}>
            <Icon name="error-outline" size={64} color={COLORS.grayMedium} />
          </Animated.View>
          <Text style={styles.noDataText}>{t('advancedBooking.noClubs')}</Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Navbar navigation={navigation} onProfilePress={() => setShowUserMenu(true)} />
      {showUserMenu && <UserMenu onClose={() => setShowUserMenu(false)} navigation={navigation} />}
      
      <View style={styles.content}>
        <Animated.View style={[styles.header, headerAnimatedStyle]}>
          <AnimatedPressable
            onPress={() => {
              Haptics.trigger('impactLight');
              setShowClubModal(true);
            }}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.headerButtonPressed
            ]}
            accessibilityLabel={t('advancedBooking.selectClubLabel')}
            accessibilityRole="button"
          >
            <View style={styles.headerButtonInner}>
              <View style={styles.headerButtonIcon}>
                <Icon name="location-on" size={20} color={COLORS.courtBlue} />
              </View>
              <Text style={styles.headerButtonText} numberOfLines={1}>
                {selectedClubName || t('advancedBooking.selectClubPlaceholder')}
              </Text>
              <Icon name="arrow-drop-down" size={22} color={COLORS.grayMedium} />
            </View>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => {
              Haptics.trigger('impactLight');
              setShowDatePicker(true);
            }}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.headerButtonPressed
            ]}
            accessibilityLabel={t('advancedBooking.selectDateLabel')}
            accessibilityRole="button"
          >
            <View style={styles.headerButtonInner}>
              <View style={styles.headerButtonIcon}>
                <Icon name="calendar-today" size={20} color={COLORS.courtBlue} />
              </View>
              <View style={styles.headerDateContainer}>
              <Text style={styles.headerDateDay} numberOfLines={1}>
                {isToday(selectedDate) 
                  ? t('advancedBooking.today') 
                  : format(selectedDate, 'EEEE', { locale: dateLocales[i18n.language] || enUS })}
              </Text>
              <Text style={styles.headerDateText} numberOfLines={1}>
                {format(selectedDate, 
                  i18n.language === 'de' ? 'dd. MMM yyyy' : 'MMM dd, yyyy', 
                  { locale: dateLocales[i18n.language] || enUS }
                )}
              </Text>
            </View>
              <Icon name="arrow-drop-down" size={22} color={COLORS.grayMedium} />
              
            </View>
          </AnimatedPressable>
        </Animated.View>

        {/* Preload progress indicator */}
        {preloadProgress > 0 && preloadProgress < 100 && (
          <Animated.View 
            entering={FadeIn}
            style={styles.preloadIndicator}
          >
            <View style={[styles.preloadProgress, { width: `${preloadProgress}%` }]} />
          </Animated.View>
        )}

        <FlatList
          ref={courtCarouselRef}
          data={courts}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={screenWidth}
          snapToAlignment="start"
          decelerationRate="fast"
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            if (index !== selectedCourtIndex) {
              setSelectedCourtIndex(index);
              Haptics.trigger('impactLight');
            }
          }}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item, index }) => (
            <CourtCard 
              item={item} 
              bookings={getBookingsForCourt(index)} 
              slots={slots} 
              formatToCEST={formatToCEST} 
              onSlotPress={onSlotPress}
              slotListRef={(ref: FlatList<any> | null) => (slotListRefs.current[index] = ref)} 
              styles={styles} 
              colors={colors}
              refreshing={refreshing}
              onRefresh={onRefresh}
              t={t}
              courtIndex={index}
              isLoading={loadingCourts.has(item.id)}
              scrollIndex={sharedScrollIndex}
              onScroll={handleSlotListScroll}
            />
          )}
          ListEmptyComponent={
            <Animated.View entering={FadeInUp.springify()} style={styles.noDataContainer}>
              <Icon name="search-off" size={64} color={COLORS.grayMedium} />
              <Text style={styles.noDataText}>{t('advancedBooking.noCourts')}</Text>
            </Animated.View>
          }
        />

        {courts.length > 1 && (
          <Animated.View 
            entering={FadeInUp.delay(300).springify()} 
            style={styles.pagination}
          >
            {courts.map((_, index) => (
              <Animated.View
                key={index}
                entering={ZoomIn.delay(index * 50)}
                style={[
                  styles.paginationDot,
                  index === selectedCourtIndex && styles.paginationDotActive
                ]}
              />
            ))}
          </Animated.View>
        )}

        {/* Rest of the modals remain the same */}
        <DateTimePickerModal
          isVisible={showDatePicker}
          mode="date"
          date={selectedDate}
          locale={i18n.language}
          confirmTextIOS={t('advancedBooking.confirmPicker')}
          cancelTextIOS={t('advancedBooking.cancelPicker')}
          onConfirm={handleDateConfirm}
          onCancel={() => {
            Haptics.trigger('impactLight');
            setShowDatePicker(false);
          }}
          minimumDate={new Date()}
          maximumDate={addDays(new Date(), 30)}
          accentColor={COLORS.courtBlue}
          buttonTextColorIOS={COLORS.courtBlue}
          textColor={COLORS.netDark}
          display="inline"
        />

        <DateTimePickerModal
          isVisible={showTimePicker}
          mode="time"
          date={selectedStart || new Date()}
          locale={i18n.language}
          confirmTextIOS={t('advancedBooking.confirmPicker')}
          cancelTextIOS={t('advancedBooking.cancelPicker')}
          onConfirm={handleTimeConfirm}
          onCancel={() => {
            Haptics.trigger('impactLight');
            setShowTimePicker(false);
          }}
          minuteInterval={30}
          accentColor={COLORS.courtBlue}
          buttonTextColorIOS={COLORS.courtBlue}
          textColor={COLORS.netDark}
        />

        <Modal visible={showClubModal} transparent={true} animationType="none">
          <Pressable style={styles.modalOverlay} onPress={() => setShowClubModal(false)}>
            <Animated.View entering={SlideInDown.springify()} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('advancedBooking.chooseClub')}</Text>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.trigger('impactLight');
                    setShowClubModal(false);
                  }}
                  style={styles.modalCloseIcon}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="close" size={24} color={COLORS.grayMedium} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={clubs}
                keyExtractor={(club: any) => club.id.toString()}
                renderItem={({ item: club, index }) => (
                  <Animated.View entering={FadeInLeft.delay(index * 50).springify()}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.clubItem,
                        pressed && styles.clubItemPressed,
                        selectedClubId === club.id && styles.clubItemSelected
                      ]}
                      onPress={() => {
                        Haptics.trigger('impactMedium');
                        setSelectedClubId(club.id);
                        setSelectedClubName(club.name);
                        setShowClubModal(false);
                      }}
                      accessibilityRole="button"
                    >
                      <View style={styles.clubItemIcon}>
                        <Icon name="sports-tennis" size={20} color={COLORS.courtBlue} />
                      </View>
                      <Text style={styles.clubItemText}>{club.name}</Text>
                      {selectedClubId === club.id && (
                        <View style={styles.clubItemCheck}>
                          <Icon name="check" size={20} color={COLORS.aceGreen} />
                        </View>
                      )}
                    </Pressable>
                  </Animated.View>
                )}
              />
            </Animated.View>
          </Pressable>
        </Modal>

        <BookingModal
          visible={showParticipantModal}
          onClose={() => {
            Haptics.trigger('impactLight');
            setShowParticipantModal(false);
          }}
          courtName={courts[selectedCourtIndex]?.name}
          courtId={courts[selectedCourtIndex]?.id}
          selectedStart={selectedStart}
          duration={duration}
          onChangeStart={setSelectedStart}  // Add this
          onChangeDuration={setDuration}     // Add this
          formatToCEST={formatToCEST}
          currentUserName={currentUserName}
          userId={Number(user?.id)}
          members={members}
          filteredMembers={filteredMembers}
          memberSearch={memberSearch}
          onChangeMemberSearch={setMemberSearch}
          selectedParticipants={selectedParticipants}
          onToggleParticipant={toggleParticipant}
          onRemoveParticipant={removeParticipant}
          onConfirm={bookSlot}
          selectedBooking={selectedBooking}
          bookings={currentCourtBookings}    // Add this
          t={t}
        />

        <Modal visible={showDetailsModal} transparent={true} animationType="none">
          <Pressable style={styles.modalOverlay} onPress={() => setShowDetailsModal(false)}>
            <Animated.View 
              entering={SlideInDown.springify()} 
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('advancedBooking.bookingDetails')}</Text>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.trigger('impactLight');
                    setShowDetailsModal(false);
                  }}
                  style={styles.modalCloseIcon}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="close" size={24} color={COLORS.grayMedium} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Icon name="schedule" size={20} color={COLORS.courtBlue} />
                  </View>
                  <Text style={styles.detailText}>
                    {selectedBooking ? `${formatToCEST(selectedBooking.start_time)} - ${formatToCEST(selectedBooking.end_time)}` : ''}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Icon name="category" size={20} color={COLORS.courtBlue} />
                  </View>
                  <View style={[
                    styles.detailBadge,
                    selectedBooking?.type === 'event' && styles.detailBadgeEvent
                  ]}>
                    <Text style={styles.detailBadgeText}>
                      {selectedBooking?.type === 'event' ? 'Event' : 'Regular'}
                    </Text>
                  </View>
                </View>
                
                {selectedBooking?.type === 'regular' && (
                  <>
                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Icon name="group" size={20} color={COLORS.courtBlue} />
                      </View>
                      <View style={styles.participantsList}>
                        {(() => {
                          const allPlayers = [];
                          
                          // Add the person who booked (they're playing too)
                          if (selectedBooking.booked_by) {
                            allPlayers.push(selectedBooking.booked_by);
                          }
                          
                          // Add all participants
                          if (selectedBooking.participants?.length > 0) {
                            allPlayers.push(...selectedBooking.participants);
                          }
                          
                          // Remove duplicates
                          const uniquePlayers = [...new Set(allPlayers)];
                          
                          return uniquePlayers.map((player: string, idx: number) => (
                            <View key={idx} style={styles.participantChip}>
                              <Text style={styles.participantChipText}>{player}</Text>
                            </View>
                          ));
                        })()}
                      </View>
                    </View>
                  </>
                )}

                {selectedBooking?.type === 'event' && (
                  <>
                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Icon name="person" size={20} color={COLORS.courtBlue} />
                      </View>
                      <Text style={styles.detailText}>
                        {t('advancedBooking.bookedBy')}: {selectedBooking.booked_by}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Icon name="description" size={20} color={COLORS.courtBlue} />
                      </View>
                      <Text style={styles.detailText}>
                        {selectedBooking.description}
                      </Text>
                    </View>
                  </>
)}


                
                {selectedBooking?.type === 'event' && (
                  <View style={styles.detailRow}>
                    <View style={styles.detailIcon}>
                      <Icon name="description" size={20} color={COLORS.courtBlue} />
                    </View>
                    <Text style={styles.detailText}>
                      {selectedBooking.description}
                    </Text>
                  </View>
                )}
              </View>
              
              {isEditable(selectedBooking) && (
                <View style={styles.modalButtonsContainer}>
                  {selectedBooking?.type === 'regular' && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.modalActionButton,
                        styles.modalEditButton,
                        pressed && styles.buttonPressed
                      ]}
                      onPress={() => {
                        Haptics.trigger('impactMedium');
                        setSelectedBooking(selectedBooking);
                        setSelectedStart(new Date(selectedBooking.start_time));
                        setDuration((new Date(selectedBooking.end_time).getTime() - new Date(selectedBooking.start_time).getTime()) / 60000);
                        setSelectedParticipants(selectedBooking.participant_ids || []);
                        setShowParticipantModal(true);
                        setShowDetailsModal(false);
                      }}
                    >
                      <Icon name="edit" size={20} color={COLORS.whiteLines} />
                      <Text style={styles.modalButtonTextWhite}>{t('advancedBooking.editButton')}</Text>
                    </Pressable>
                  )}
                  
                  {selectedBooking?.type === 'event' && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.modalActionButton,
                        styles.modalEditButton,
                        pressed && styles.buttonPressed
                      ]}
                      onPress={() => {
                        Haptics.trigger('impactMedium');
                        openEventEdit(selectedBooking);
                      }}
                    >
                      <Icon name="edit" size={20} color={COLORS.whiteLines} />
                      <Text style={styles.modalButtonTextWhite}>{t('advancedBooking.editSlotButton')}</Text>
                    </Pressable>
                  )}
                  
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalActionButton,
                      styles.modalCancelButton,
                      pressed && styles.buttonPressed
                    ]}
                    onPress={() => {
                      Haptics.trigger('impactMedium');
                      handleCancel(selectedBooking.id);
                    }}
                  >
                    <Icon name="cancel" size={20} color={COLORS.error} />
                    <Text style={styles.modalButtonTextCancel}>{t('advancedBooking.cancelBookingButton')}</Text>
                  </Pressable>
                </View>
              )}
            </Animated.View>
          </Pressable>
        </Modal>

        <Modal visible={showEventEditModal} transparent={true} animationType="none">
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={styles.modalOverlay}
          >
            <Pressable style={styles.modalOverlay} onPress={Keyboard.dismiss}>
              <Animated.View entering={SlideInDown.springify()} style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('advancedBooking.editEventTitle')}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.trigger('impactLight');
                      setShowEventEditModal(false);
                    }}
                    style={styles.modalCloseIcon}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name="close" size={24} color={COLORS.grayMedium} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.eventTimeContainer}>
                  <Icon name="schedule" size={20} color={COLORS.courtBlue} />
                  <Text style={styles.eventTimeText}>
                    {selectedStart ? formatToCEST(selectedStart) : ''}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.trigger('impactLight');
                      setShowTimePicker(true);
                    }}
                    style={styles.changeTimeButton}
                  >
                    <Text style={styles.changeTimeButtonText}>{t('advancedBooking.changeTime')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.eventDescriptionInput}
                    placeholder={t('advancedBooking.eventDescriptionPlaceholder')}
                    placeholderTextColor={COLORS.grayMedium}
                    value={eventDescription}
                    onChangeText={setEventDescription}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    accessibilityLabel={t('advancedBooking.eventDescriptionLabel')}
                  />
                </View>

                <View style={styles.modalButtonsContainer}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalActionButton,
                      styles.modalSaveButton,
                      (!selectedStart || !eventDescription) && styles.disabledButton,
                      pressed && !(!selectedStart || !eventDescription) && styles.buttonPressed
                    ]}
                    disabled={!selectedStart || !eventDescription}
                    onPress={() => {
                      Haptics.trigger('impactHeavy');
                      saveEventEdit();
                    }}
                  >
                    <Icon name="save" size={20} color={COLORS.whiteLines} />
                    <Text style={styles.modalButtonTextWhite}>{t('advancedBooking.updateEventButton')}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const CourtCard: React.FC<CourtCardProps> = React.memo(({ 
  item, 
  bookings, 
  slots, 
  formatToCEST, 
  onSlotPress, 
  slotListRef, 
  styles, 
  colors,
  onRefresh,
  refreshing,
  t,
  courtIndex,
  isLoading,
  scrollIndex,
  onScroll
}) => {
  const listRef = useRef<FlatList>(null);
  const hasInitiallyScrolled = useRef(false);
  const isUserScrolling = useRef(false);
  
  // Handle initial scroll and external scroll updates
  useEffect(() => {
    if (listRef.current && scrollIndex >= 0) {
      if (!hasInitiallyScrolled.current) {
        // Initial scroll without animation
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            index: scrollIndex,
            animated: false,
            viewPosition: 0
          });
          hasInitiallyScrolled.current = true;
        }, 0);
      } else if (!isUserScrolling.current) {
        // Sync scroll from other courts
        listRef.current?.scrollToIndex({
          index: scrollIndex,
          animated: false,
          viewPosition: 0
        });
      }
    }
  }, [scrollIndex]);
  
  const handleScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent;
    const index = Math.round(contentOffset.y / (80 + SPACING.sm));
    
    isUserScrolling.current = true;
    onScroll(index);
    
    // Reset user scrolling flag after a short delay
    setTimeout(() => {
      isUserScrolling.current = false;
    }, 100);
  }, [onScroll]);
  
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.courtHeader}>
          <View style={styles.courtIconContainer}>
            <Icon name="sports-tennis" size={28} color={COLORS.courtBlue} />
          </View>
          <View style={styles.courtInfo}>
            <Text style={styles.courtName}>{item.name}</Text>
            <View style={styles.courtDetailsRow}>
              <View style={styles.courtDetailBadge}>
                <Icon name="landscape" size={14} color={COLORS.grayMedium} />
                <Text style={styles.courtDetailText}>{item.surface_type}</Text>
              </View>
              {item.has_floodlights && (
                <View style={[styles.courtDetailBadge, styles.courtDetailBadgeHighlight]}>
                  <Icon name="lightbulb" size={14} color={COLORS.warningYellow} />
                  <Text style={styles.courtDetailText}>{t('advancedBooking.floodlights')}</Text>
                </View>
              )}
            </View>
          </View>
          {isLoading && (
            <ActivityIndicator size="small" color={COLORS.courtBlue} style={styles.courtLoadingIndicator} />
          )}
        </View>
        
        <FlatList
          ref={(ref) => {
            listRef.current = ref;
            slotListRef(ref);
          }}
          data={slots}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={COLORS.courtBlue}
              colors={[COLORS.courtBlue]}
            />
          }
          getItemLayout={(data, index) => ({ 
            length: 80 + SPACING.sm, 
            offset: (80 + SPACING.sm) * index, 
            index 
          })}
          initialScrollIndex={scrollIndex >= 0 ? scrollIndex : 0}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          keyExtractor={(slot) => slot.start.toISOString()}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.slotListContent}
          onScrollToIndexFailed={(info) => {
            // Fallback for scroll failure
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                index: Math.min(info.index, slots.length - 1),
                animated: false
              });
            }, 100);
          }}
          onScroll={handleScroll}
          onScrollBeginDrag={() => {
            isUserScrolling.current = true;
          }}
          onScrollEndDrag={() => {
            setTimeout(() => {
              isUserScrolling.current = false;
            }, 100);
          }}
          renderItem={({ item: slot, index }) => (
            <SlotItem 
              slot={slot} 
              bookings={bookings} 
              formatToCEST={formatToCEST} 
              colors={colors} 
              onPress={() => onSlotPress(slot, courtIndex)}
              styles={styles} 
              t={t}
              index={index}
            />
          )}
        />
      </View>
    </Animated.View>
  );
});

const SlotItem: React.FC<SlotItemProps> = React.memo(({ 
  slot, 
  bookings, 
  formatToCEST, 
  colors, 
  onPress, 
  styles, 
  t,
  index 
}) => {
  const isPast = !isAfter(slot.start, new Date());
  const isBooked = bookings.some(b => slot.start < b.end_time && slot.end > b.start_time);
  const bookedBy = isBooked ? bookings.find(b => slot.start < b.end_time && slot.end > b.start_time) : null;

  const scaleValue = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }]
  }));

  let details = '';
  let icon = 'check-circle';
  
  if (isBooked && bookedBy) {
    if (bookedBy.type === 'regular') {
      // Show players instead of who booked it
      const players = [];
      
      // Add the person who booked (they're playing too)
      if (bookedBy.booked_by) {
        players.push(bookedBy.booked_by);
      }
      
      // Add all participants
      if (bookedBy.participants && bookedBy.participants.length > 0) {
        players.push(...bookedBy.participants);
      }
      
      // Remove duplicates and format
      const uniquePlayers = [...new Set(players)];
      
      if (uniquePlayers.length === 0) {
        details = t('advancedBooking.bookedSlot'); // Fallback
      } else if (uniquePlayers.length === 1) {
        details = uniquePlayers[0];
      } else if (uniquePlayers.length === 2) {
        details = uniquePlayers.join(' & ');
      } else {
        // For more than 2 players, show first player + count
        const firstName = uniquePlayers[0].split(' ')[0]; // First name only to save space
        details = `${firstName} +${uniquePlayers.length - 1}`;
      }
      
      icon = 'group'; // Change icon to group for regular bookings
    } else if (bookedBy.type === 'event') {
      // For events, show who booked it or the description
      details = bookedBy.description || bookedBy.booked_by || t('advancedBooking.eventSlot');
      icon = 'event';
    }
  } else if (isPast) {
    details = t('advancedBooking.slotPast');
    icon = 'history';
  } else {
    details = t('advancedBooking.slotAvailable');
    icon = 'add-circle';
  }

  const getSlotStyle = () => {
    if (isPast) return styles.slotPast;
    if (isBooked) {
      return bookedBy?.type === 'event' ? styles.slotEvent : styles.slotBooked;
    }
    return styles.slotAvailable;
  };

  return (
    <Animated.View 
      style={[animatedStyle]}
    >
      <Pressable
        disabled={isPast}
        onPress={() => {
          if (!isPast) {
            scaleValue.value = withSpring(0.95, {}, () => {
              scaleValue.value = withSpring(1);
            });
            onPress();
          }
        }}
        style={({ pressed }) => [
          styles.slotContainer,
          getSlotStyle(),
          pressed && !isPast && styles.slotPressed
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: isPast }}
      >
        <View style={styles.slotContent}>
          <View style={styles.slotTimeContainer}>
            <View style={[
              styles.slotIconContainer,
              isPast && styles.slotIconPast,
              isBooked && styles.slotIconBooked,
              !isPast && !isBooked && styles.slotIconAvailable
            ]}>
              <Icon 
                name={icon} 
                size={24} 
                color={isPast ? COLORS.grayMedium : (isBooked ? (bookedBy?.type === 'event' ? COLORS.aceGreen : COLORS.courtBlueDark) : COLORS.courtBlue)} 
              />
            </View>
            <View style={styles.slotTimeInfo}>
              <Text style={[
                styles.slotTime,
                isPast && styles.slotTimePast,
                isBooked && styles.slotTimeBooked
              ]}>
                {formatToCEST(slot.start)} - {formatToCEST(slot.end)}
              </Text>
              <Text style={[
                styles.slotDetails,
                isPast && styles.slotDetailsPast,
                isBooked && styles.slotDetailsBooked
              ]} numberOfLines={1}>
                {details}
              </Text>
            </View>
          </View>
          {!isPast && !isBooked && (
            <Icon name="chevron-right" size={24} color={COLORS.courtBlue} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
});

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.grayLight,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.whiteLines,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 5,
    gap: SPACING.sm,
  },
  headerButton: {
    flex: 1,
    backgroundColor: COLORS.whiteLines,
    borderRadius: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  headerButtonPressed: {
    backgroundColor: COLORS.courtBlueLight,
    transform: [{ scale: 0.98 }],
  },
  headerButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
  },
  headerButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.courtBlueLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    flex: 1,
    color: COLORS.netDark,
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
  },
  preloadIndicator: {
    height: 2,
    backgroundColor: COLORS.grayBorder,
    overflow: 'hidden',
  },
  preloadProgress: {
    height: '100%',
    backgroundColor: COLORS.courtBlue,
  },
  card: {
    width: screenWidth,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    height: screenHeight - 200,
  },
  cardContent: {
    flex: 1,
    backgroundColor: COLORS.whiteLines,
    borderRadius: SPACING.lg,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  courtHeader: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.whiteLines,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  courtIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.courtBlueLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  courtInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  courtName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
    marginBottom: SPACING.xs,
  },
  courtDetailsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  courtDetailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grayLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: SPACING.sm,
    gap: SPACING.xs,
  },
  courtDetailBadgeHighlight: {
    backgroundColor: COLORS.softBeige,
  },
  courtDetailText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: COLORS.grayMedium,
  },
  courtLoadingIndicator: {
    marginLeft: SPACING.md,
  },
  slotListContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  slotContainer: {
    marginBottom: SPACING.sm,
    borderRadius: SPACING.md,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  slotContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  slotTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  slotIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotIconAvailable: {
    backgroundColor: COLORS.courtBlueLight,
  },
  slotIconBooked: {
    backgroundColor: COLORS.grayLight,
  },
  slotIconPast: {
    backgroundColor: COLORS.grayLight,
  },
  slotTimeInfo: {
    flex: 1,
  },
  slotTime: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.netDark,
    marginBottom: SPACING.xs,
  },
  slotTimePast: {
    color: COLORS.grayMedium,
  },
  slotTimeBooked: {
    color: COLORS.netDark,
  },
  slotDetails: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
  },
  slotDetailsPast: {
    color: COLORS.grayMedium,
  },
  slotDetailsBooked: {
    color: COLORS.netDark,
  },
  slotAvailable: {
    backgroundColor: COLORS.whiteLines,
    borderWidth: 2,
    borderColor: COLORS.courtBlue,
  },
  slotBooked: {
    backgroundColor: COLORS.whiteLines,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  slotEvent: {
    backgroundColor: COLORS.courtBlueLight,
    borderWidth: 1,
    borderColor: COLORS.aceGreen,
  },
  slotPast: {
    backgroundColor: COLORS.grayLight,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    opacity: 0.6,
  },
  slotPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.whiteLines,
    gap: SPACING.sm,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.grayBorder,
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: COLORS.courtBlue,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(42, 61, 69, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.whiteLines,
    borderTopLeftRadius: SPACING.xl,
    borderTopRightRadius: SPACING.xl,
    paddingBottom: SPACING.xxl,
    maxHeight: '85%',
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
  },
  modalCloseIcon: {
    padding: SPACING.sm,
  },
  clubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
    gap: SPACING.md,
  },
  clubItemPressed: {
    backgroundColor: COLORS.grayLight,
  },
  clubItemSelected: {
    backgroundColor: COLORS.courtBlueLight,
  },
  clubItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.courtBlueLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clubItemText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: COLORS.netDark,
  },
  clubItemCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.whiteLines,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    gap: SPACING.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.courtBlueLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: COLORS.netDark,
    paddingTop: SPACING.sm,
  },
  detailBadge: {
    backgroundColor: COLORS.grayLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: SPACING.sm,
    alignSelf: 'flex-start',
  },
  detailBadgeEvent: {
    backgroundColor: COLORS.courtBlueLight,
  },
  detailBadgeText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.netDark,
  },
  participantsList: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  participantChip: {
    backgroundColor: COLORS.courtBlueLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: SPACING.md,
  },
  participantChipText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: COLORS.netDark,
  },
  modalButtonsContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: SPACING.md,
    gap: SPACING.sm,
  },
  modalEditButton: {
    backgroundColor: COLORS.courtBlue,
  },
  modalSaveButton: {
    backgroundColor: COLORS.aceGreen,
  },
  modalCancelButton: {
    backgroundColor: COLORS.whiteLines,
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  modalButtonTextWhite: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.whiteLines,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.error,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabledButton: {
    backgroundColor: COLORS.disabled,
    opacity: 0.5,
  },
  eventTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.courtBlueLight,
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    borderRadius: SPACING.md,
    gap: SPACING.md,
  },
  eventTimeText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: COLORS.netDark,
  },
  changeTimeButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.courtBlue,
    borderRadius: SPACING.sm,
  },
  changeTimeButtonText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: COLORS.whiteLines,
  },
  inputContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  eventDescriptionInput: {
    backgroundColor: COLORS.grayLight,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    borderRadius: SPACING.md,
    padding: SPACING.lg,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: COLORS.netDark,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.whiteLines,
    gap: SPACING.lg,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: COLORS.grayMedium,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
    gap: SPACING.lg,
  },
  noDataText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    textAlign: 'center',
  },
  headerDateDay: {
    color: COLORS.grayMedium,
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  headerDateText: {
    color: COLORS.netDark,
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
  },
});

export default AdvancedBookingScreen;