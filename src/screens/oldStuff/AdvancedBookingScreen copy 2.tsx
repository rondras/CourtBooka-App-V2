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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Animated, { FadeIn, FadeInUp, FadeInLeft, FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from 'react-native-haptic-feedback';
import { useTheme } from '../../App';
import { getUserClubs, getClubCourts, getCourtBookings, getClubMembers, createBooking, cancelBooking, getCurrentUserName } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { format, addMinutes, setHours, setMinutes as dateSetMinutes, isAfter, startOfDay, isToday, addDays } from 'date-fns';
import Navbar from '../components/Navbar';
import UserMenu from '../components/UserMenu';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation, TFunction } from 'react-i18next';
import BookingModal from '../components/BookingModal';

// Brand-aligned color palette
const COURT_BLUE = '#5C9EAD';
const ACE_GREEN = '#4CAF50';
const NET_DARK = '#2A3D45';
const WHITE_LINES = '#FFFFFF';
const SOFT_BEIGE = '#F5F5DC';
const WARNING_YELLOW = '#FFC107';
const EVENT_BG = '#E8F5E9';

const { width: screenWidth } = Dimensions.get('window');

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
  onSlotPress: (slot: Slot) => void;
  slotListRef: (ref: FlatList<any> | null) => void;
  styles: any;
  colors: any;
  refreshing: boolean;
  onRefresh: () => void;
  t: TFunction;
}

interface SlotItemProps {
  slot: Slot;
  bookings: any[];
  formatToCEST: (date: Date) => string;
  colors: any;
  onPress: () => void;
  styles: any;
  t: TFunction;
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
  const [bookings, setBookings] = useState<any[]>([]);
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
  const [currentSlotTime, setCurrentSlotTime] = useState<Date | null>(null);
  const slotListRefs = useRef<FlatList[]>([]);
  const courtCarouselRef = useRef<FlatList>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [isInitialSet, setIsInitialSet] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEventEditModal, setShowEventEditModal] = useState(false);
  const [eventDescription, setEventDescription] = useState('');

  const styles = useMemo(() => createStyles(colors), [colors]);
  const adminClubs = userClubs.filter(club => club.role === 'admin');

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

  useEffect(() => {
    if (courts.length > 0) {
      fetchBookings(courts[selectedCourtIndex].id);
    }
  }, [selectedDate, selectedCourtIndex, courts]);

  useEffect(() => {
    if (editMode && editBooking && courts.length > 0 && members.length > 0 && selectedClubId === editBooking.club_id && !isInitialSet) {
      const courtIndex = courts.findIndex(c => c.id === editBooking.court_id);
      if (courtIndex >= 0) {
        setSelectedCourtIndex(courtIndex);
        const bookingStart = new Date(editBooking.start_time);
        setSelectedDate(bookingStart);
        setSelectedStart(bookingStart);
        setDuration((new Date(editBooking.end_time).getTime() - bookingStart.getTime()) / 60000);
        setSelectedParticipants(editBooking.participant_ids || []);
        setSelectedBooking(editBooking);
        if (editBooking.type === 'regular') {
          setShowParticipantModal(true);
        } else if (editBooking.type === 'event') {
          openEventEdit(editBooking);
        }
        setIsInitialSet(true);
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
      if (data.length > 0) {
        setSelectedCourtIndex(0);
        fetchBookings(data[0].id);
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

  const fetchBookings = useCallback(async (courtId: number) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    try {
      const response = await getCourtBookings(courtId, dateStr);
      const parsedBookings = response.map((b: any) => ({
        ...b,
        start_time: new Date(b.start_time + (b.start_time.endsWith('Z') ? '' : 'Z')),
        end_time: new Date(b.end_time + (b.end_time.endsWith('Z') ? '' : 'Z')),
      }));
      setBookings(parsedBookings);

      if (courts.length > 0 && slotListRefs.current[selectedCourtIndex]) {
        const slots = generateSlots(selectedDate);
        let scrollIndex = 0;
        if (currentSlotTime) {
          scrollIndex = slots.findIndex(slot => 
            Math.abs(slot.start.getTime() - currentSlotTime.getTime()) < 1000
          );
          if (scrollIndex === -1) {
            scrollIndex = slots.findIndex(slot => isAfter(slot.start, new Date())) || 0;
          }
        } else if (isToday(selectedDate)) {
          scrollIndex = slots.findIndex(slot => isAfter(slot.start, new Date())) || 0;
        }
        if (scrollIndex >= 0 && scrollIndex < slots.length) {
          slotListRefs.current[selectedCourtIndex]?.scrollToIndex({
            index: scrollIndex,
            viewPosition: 0,
            animated: true,
          });
        }
      }
    } catch (error: any) {
      Alert.alert(t('advancedBooking.errorTitle'), t('advancedBooking.failedToFetchBookings'));
      console.error('Fetch bookings error:', error.response?.status, error.response?.data || error.message);
    }
  }, [selectedDate, currentSlotTime, selectedCourtIndex, courts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (courts.length > 0) {
      await fetchBookings(courts[selectedCourtIndex].id);
    }
    setRefreshing(false);
  }, [fetchBookings, courts, selectedCourtIndex]);

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

  const onSlotPress = (slot: Slot) => {
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
      confirmBookSlot(slot.start);
    }
  };

  const confirmBookSlot = (start: Date) => {
    if (!isAfter(start, new Date())) {
      Haptics.trigger('notificationError');
      Alert.alert(t('advancedBooking.invalidSelection'), t('advancedBooking.pastSlot'));
      return;
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
                await api.put(`/bookings/${selectedBooking.id}`, data);
                Haptics.trigger('notificationSuccess');
                Alert.alert(t('advancedBooking.updateSuccessful'), t('advancedBooking.bookingUpdated'));
              } else {
                await createBooking(data);
                Haptics.trigger('notificationSuccess');
                Alert.alert(t('advancedBooking.bookingSuccessful'), t('advancedBooking.courtBooked'));
              }
              fetchBookings(courts[selectedCourtIndex].id);
              setShowParticipantModal(false);
              setSelectedBooking(null);
              if (editMode) {
                setEditMode(false);
                navigation.goBack();
              }
            } catch (error: any) {
              Haptics.trigger('notificationError');
              const errMsg = error.response?.data?.error || t('advancedBooking.eventUpdateFailed');
              if (errMsg.includes('overlap') || errMsg.includes('conflict')) {
                const alternative = await findAlternativeSlot(selectedStart, duration);
                if (alternative) {
                  Alert.alert(
                    t('advancedBooking.slotTaken'), 
                    t('advancedBooking.alternativeSlot', { 
                      courtName: alternative.court_name, 
                      startTime: formatToCEST(alternative.start) 
                    }),
                    [
                      { text: t('profile.cancel') },
                      {
                        text: t('advancedBooking.switchButton'),
                        onPress: () => {
                          const newIndex = courts.findIndex(c => c.id === alternative.court_id);
                          if (newIndex >= 0) {
                            setSelectedCourtIndex(newIndex);
                            setSelectedStart(alternative.start);
                            bookSlot();
                          }
                        }
                      }
                    ]
                  );
                } else {
                  Alert.alert(t('advancedBooking.operationFailed'), errMsg);
                }
              } else {
                Alert.alert(t('advancedBooking.operationFailed'), errMsg);
              }
              console.error('Booking error:', error.response?.status, error.response?.data || error.message);
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
        const bookingsOther = await getCourtBookings(court.id, dateStr);
        const parsedOther = bookingsOther.map(b => ({
          start_time: new Date(b.start_time),
          end_time: new Date(b.end_time)
        }));
        const isFree = !parsedOther.some(b => preferredStart < b.end_time && addMinutes(preferredStart, dur) > b.start_time);
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
              fetchBookings(courts[selectedCourtIndex].id);
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
    setSelectedDate(date);
    setCurrentSlotTime(null);
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
    setSelectedBooking(booking);
    setSelectedStart(new Date(booking.start_time));
    setDuration((new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime()) / 60000);
    setEventDescription(booking.description || '');
    setShowEventEditModal(true);
    setShowDetailsModal(false);
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
      await api.put(`/bookings/${selectedBooking.id}`, data);
      Haptics.trigger('notificationSuccess');
      Alert.alert(t('advancedBooking.eventUpdateSuccessful'), t('advancedBooking.eventUpdated'));
      fetchBookings(courts[selectedCourtIndex].id);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View entering={FadeIn} style={styles.loadingContainer}>
          <ActivityIndicator color={COURT_BLUE} size="large" />
          <Text style={styles.loadingText}>{t('advancedBooking.loadingText')}</Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (clubs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Navbar navigation={navigation} onProfilePress={() => setShowUserMenu(true)} />
        {showUserMenu && <UserMenu onClose={() => setShowUserMenu(false)} navigation={navigation} />}
        <Animated.View entering={FadeInUp} style={styles.noDataContainer}>
          <Icon name="error-outline" size={48} color={colors.muted} />
          <Text style={styles.noDataText}>{t('advancedBooking.noClubs')}</Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Navbar navigation={navigation} onProfilePress={() => setShowUserMenu(true)} />
      {showUserMenu && <UserMenu onClose={() => setShowUserMenu(false)} navigation={navigation} />}
      <Animated.View entering={FadeInUp} style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              Haptics.trigger('impactLight');
              setShowClubModal(true);
            }}
            style={styles.clubButton}
            accessibilityLabel={t('advancedBooking.selectClubLabel')}
            accessibilityRole="button"
          >
            <Icon name="location-on" size={20} color={NET_DARK} />
            <Text style={styles.clubButtonText}>
              {selectedClubName || t('advancedBooking.selectClubPlaceholder')}
            </Text>
            <Icon name="arrow-drop-down" size={20} color={NET_DARK} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.trigger('impactLight');
              setShowDatePicker(true);
            }}
            style={styles.dateButton}
            accessibilityLabel={t('advancedBooking.selectDateLabel')}
            accessibilityRole="button"
          >
            <Icon name="calendar-today" size={20} color={NET_DARK} />
            <Text style={styles.dateButtonText}>
              {format(selectedDate, 'MMM dd, yyyy')}
            </Text>
            <Icon name="arrow-drop-down" size={20} color={NET_DARK} />
          </TouchableOpacity>
        </View>

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
            setSelectedCourtIndex(index);
            Haptics.trigger('impactLight');
            if (courts.length > 0) {
              fetchBookings(courts[index].id);
            }
          }}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item, index }) => (
            <CourtCard 
              item={item} 
              bookings={bookings} 
              slots={slots} 
              formatToCEST={formatToCEST} 
              onSlotPress={onSlotPress}
              slotListRef={(ref: FlatList<any> | null) => (slotListRefs.current[index] = ref)} 
              styles={styles} 
              colors={colors}
              refreshing={refreshing}
              onRefresh={onRefresh}
              t={t}
            />
          )}
          ListEmptyComponent={
            <Animated.View entering={FadeInUp} style={styles.noDataContainer}>
              <Icon name="search-off" size={48} color={colors.muted} />
              <Text style={styles.noDataText}>{t('advancedBooking.noCourts')}</Text>
            </Animated.View>
          }
        />

        {courts.length > 1 && (
          <View style={styles.pagination}>
            {courts.map((_, index) => (
              <Animated.View
                key={index}
                entering={FadeIn}
                style={[
                  styles.paginationDot,
                  { backgroundColor: index === selectedCourtIndex ? COURT_BLUE : colors.muted }
                ]}
              />
            ))}
          </View>
        )}

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
          accentColor={COURT_BLUE}
          buttonTextColorIOS={COURT_BLUE}
          textColor={NET_DARK}
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
          accentColor={COURT_BLUE}
          buttonTextColorIOS={COURT_BLUE}
          textColor={NET_DARK}
        />

        <Modal visible={showClubModal} transparent={true} animationType="none">
          <Animated.View entering={FadeInUp} style={styles.modalOverlay}>
            <Animated.View entering={FadeInUp} style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('advancedBooking.chooseClub')}</Text>
              <FlatList
                data={clubs}
                keyExtractor={(club: any) => club.id.toString()}
                renderItem={({ item: club }) => (
                  <TouchableOpacity
                    style={styles.clubItem}
                    onPress={() => {
                      Haptics.trigger('impactMedium');
                      setSelectedClubId(club.id);
                      setSelectedClubName(club.name);
                      setShowClubModal(false);
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.clubItemText}>{club.name}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity 
                onPress={() => {
                  Haptics.trigger('impactLight');
                  setShowClubModal(false);
                }} 
                style={styles.modalCloseButton}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>{t('advancedBooking.closeButton')}</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </Modal>

        <BookingModal
          visible={showParticipantModal}
          onClose={() => {
            Haptics.trigger('impactLight');
            setShowParticipantModal(false);
          }}
          courtName={courts[selectedCourtIndex]?.name}
          selectedStart={selectedStart}
          duration={duration}
          formatToCEST={formatToCEST}
          onPressChangeTime={() => setShowTimePicker(true)}
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
          t={t}
        />


        <Modal visible={showDetailsModal} transparent={true} animationType="none">
          <Animated.View entering={FadeInUp} style={styles.modalOverlay}>
            <Animated.View entering={FadeInUp} style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.closeIcon} 
                onPress={() => {
                  Haptics.trigger('impactLight');
                  setShowDetailsModal(false);
                }}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                accessibilityRole="button"
                accessibilityLabel={t('advancedBooking.closeDetailsModal')}
              >
                <Icon name="close" size={24} color={NET_DARK} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('advancedBooking.bookingDetails')}</Text>
              <Text style={styles.modalSubtitle}>{t('advancedBooking.timeLabel', { 
                start: selectedBooking ? formatToCEST(selectedBooking.start_time) : '', 
                end: selectedBooking ? formatToCEST(selectedBooking.end_time) : '' 
              })}</Text>
              <Text style={styles.modalSubtitle}>{t('advancedBooking.typeLabel', { type: selectedBooking?.type })}</Text>
              {selectedBooking?.type === 'regular' && (
                <>
                  <Text style={styles.modalSubtitle}>{t('advancedBooking.bookedByLabel', { bookedBy: selectedBooking.booked_by })}</Text>
                  <Text style={styles.modalSubtitle}>{t('advancedBooking.participantsLabel', { 
                    participants: selectedBooking.participants?.join(', ') || 'None' 
                  })}</Text>
                </>
              )}
              {selectedBooking?.type === 'event' && (
                <Text style={styles.modalSubtitle}>{t('advancedBooking.descriptionLabel', { description: selectedBooking.description })}</Text>
              )}
              {isEditable(selectedBooking) && (
                <View style={styles.modalButtons}>
                  {selectedBooking.type === 'regular' && (
                    <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={() => {
                      setSelectedBooking(selectedBooking);
                      setSelectedStart(new Date(selectedBooking.start_time));
                      setDuration((new Date(selectedBooking.end_time).getTime() - new Date(selectedBooking.start_time).getTime()) / 60000);
                      setSelectedParticipants(selectedBooking.participant_ids || []);
                      setShowParticipantModal(true);
                      setShowDetailsModal(false);
                    }}>
                      <Text style={[styles.buttonText, { color: WHITE_LINES }]}>{t('advancedBooking.editButton')}</Text>
                    </TouchableOpacity>
                  )}
                  {selectedBooking.type === 'event' && (
                    <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={() => openEventEdit(selectedBooking)}>
                      <Text style={styles.buttonText}>{t('advancedBooking.editSlotButton')}</Text>
                    </TouchableOpacity>
                  )}
                  {selectedBooking.recurring_event_id && (
                    <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={() => editSeries(selectedBooking.recurring_event_id)}>
                      <Text style={styles.buttonText}>{t('advancedBooking.editSeriesButton')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => handleCancel(selectedBooking.id)}>
                    <Text style={styles.buttonText}>{t('advancedBooking.cancelBookingButton')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          </Animated.View>
        </Modal>

        <Modal visible={showEventEditModal} transparent={true} animationType="none">
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={styles.modalOverlay}
          >
            <Animated.View entering={FadeInUp} style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.closeIcon} 
                onPress={() => {
                  Haptics.trigger('impactLight');
                  setShowEventEditModal(false);
                }}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                accessibilityRole="button"
                accessibilityLabel={t('advancedBooking.closeEventEditModal')}
              >
                <Icon name="close" size={24} color={NET_DARK} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('advancedBooking.editEventTitle')}</Text>
              <Text style={styles.modalSubtitle}>{t('advancedBooking.slotLabel', { time: selectedStart ? formatToCEST(selectedStart) : '' })}</Text>
              
              <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.timeButton}>
                <Text style={styles.timeButtonText}>{t('advancedBooking.changeTime')}</Text>
              </TouchableOpacity>

              <Animated.View entering={FadeInDown}>
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('advancedBooking.eventDescriptionPlaceholder')}
                  placeholderTextColor={colors.muted}
                  value={eventDescription}
                  onChangeText={setEventDescription}
                  multiline
                  accessibilityLabel={t('advancedBooking.eventDescriptionLabel')}
                />
              </Animated.View>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  onPress={saveEventEdit} 
                  style={[styles.button, styles.confirmButton, (!selectedStart || !eventDescription) && styles.disabledButton]}
                  disabled={!selectedStart || !eventDescription}
                >
                  <Text style={[styles.buttonText, { color: WHITE_LINES }]}>{t('advancedBooking.updateEventButton')}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </Modal>
      </Animated.View>
    </SafeAreaView>
  );
};

const CourtCard: React.FC<CourtCardProps> = React.memo(({ item, bookings, slots, formatToCEST, onSlotPress, slotListRef, styles, colors, onRefresh, refreshing, t }) => (
  <Animated.View entering={FadeIn} style={styles.card}>
    <View style={styles.courtHeader}>
      <Icon name="sports-tennis" size={24} color={COURT_BLUE} />
      <Text style={styles.heading}>{t('advancedBooking.courtHeader', { name: item.name })}</Text>
    </View>
    <Text style={styles.subtext}>{t('advancedBooking.courtSubtext', { 
      surfaceType: item.surface_type, 
      floodlights: item.has_floodlights ? t('advancedBooking.floodlights') : '' 
    })}</Text>
    <FlatList
      ref={slotListRef}
      data={slots}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COURT_BLUE} />
      }
      getItemLayout={(data, index) => ({ length: 44, offset: 44 * index, index })}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      keyExtractor={(slot) => slot.start.toISOString()}
      scrollEventThrottle={16}
      renderItem={({ item: slot }) => (
        <SlotItem 
          slot={slot} 
          bookings={bookings} 
          formatToCEST={formatToCEST} 
          colors={colors} 
          onPress={() => onSlotPress(slot)}
          styles={styles} 
          t={t}
        />
      )}
    />
  </Animated.View>
));

const SlotItem: React.FC<SlotItemProps> = React.memo(({ slot, bookings, formatToCEST, colors, onPress, styles, t }) => {
  const isPast = !isAfter(slot.start, new Date());
  const isBooked = bookings.some(b => slot.start < b.end_time && slot.end > b.start_time);
  const bookedBy = isBooked ? bookings.find(b => slot.start < b.end_time && slot.end > b.start_time) : null;

  let details = '';
  if (isBooked && bookedBy) {
    if (bookedBy.type === 'regular') {
      details = t('advancedBooking.slotBookedDetails', { bookedBy: bookedBy.booked_by });
      if (bookedBy.participants?.length > 0) {
        details += `\n${t('advancedBooking.slotParticipants', { participants: bookedBy.participants.join(', ') })}`;
      }
    } else if (bookedBy.type === 'event') {
      details = bookedBy.description ? bookedBy.description : '';
    }
  } else {
    details = isPast ? t('advancedBooking.slotPast') : t('advancedBooking.slotAvailable');
  }

  const slotStyle = isPast ? styles.slotPast : isBooked ? (bookedBy?.type === 'event' ? styles.slotEvent : styles.slotBooked) : styles.slotAvailable;
  const textStyle = isPast || isBooked ? styles.slotTextMuted : styles.slotTextAvailable;
  const detailsStyle = isBooked ? styles.slotDetailsBooked : styles.slotDetails;

  return (
    <Animated.View entering={FadeInLeft} style={slotStyle}>
      <TouchableOpacity
        disabled={isPast}
        onPress={onPress}
        style={styles.slotTouchable}
        accessibilityRole="button"
        accessibilityState={{ disabled: isPast }}
      >
        <Text style={textStyle}>
          {formatToCEST(slot.start)} - {formatToCEST(slot.end)}
        </Text>
        <Text style={detailsStyle}>{details}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHITE_LINES,
  },
  content: {
    flex: 1,
    backgroundColor: SOFT_BEIGE,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: WHITE_LINES,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder || '#E0E0E0',
    shadowColor: NET_DARK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE_LINES,
    padding: 12,
    borderRadius: 12,
    flex: 1,
    marginRight: 8,
    shadowColor: NET_DARK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  clubButtonText: {
    color: NET_DARK,
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    marginLeft: 8,
    flex: 1,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE_LINES,
    padding: 12,
    borderRadius: 12,
    flex: 1,
    shadowColor: NET_DARK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  dateButtonText: {
    color: NET_DARK,
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    marginLeft: 8,
    flex: 1,
  },
  card: {
    width: screenWidth,
    padding: 16,
    backgroundColor: WHITE_LINES,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: NET_DARK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  courtHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  heading: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: NET_DARK,
    marginLeft: 8,
  },
  subtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.muted,
    marginBottom: 12,
  },
  slotTouchable: {
    flex: 1,
    padding: 12,
  },
  slotAvailable: {
    padding: 0,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: COURT_BLUE,
    shadowColor: COURT_BLUE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  slotBooked: {
    padding: 0,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#EF9A9A',
  },
  slotEvent: {
    padding: 0,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: EVENT_BG,
    borderWidth: 1,
    borderColor: ACE_GREEN,
  },
  slotPast: {
    padding: 0,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  slotTextAvailable: {
    color: WHITE_LINES,
    fontFamily: 'Inter-Medium',
    fontSize: 16,
  },
  slotTextMuted: {
    color: NET_DARK,
    fontFamily: 'Inter-Medium',
    fontSize: 16,
  },
  slotDetails: {
    color: WHITE_LINES,
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },
  slotDetailsBooked: {
    color: NET_DARK,
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: WHITE_LINES,
  },
  paginationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: WHITE_LINES,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
    shadowColor: NET_DARK,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: NET_DARK,
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 16,
    fontFamily: 'Inter-Regular',
  },
  clubItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  clubItemText: {
    fontSize: 16,
    color: NET_DARK,
    fontFamily: 'Inter-Medium',
  },
  modalCloseButton: {
    marginTop: 16,
    backgroundColor: COURT_BLUE,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  searchInputContainer: {
    width: '100%',
  },
  searchInput: {
    backgroundColor: SOFT_BEIGE,
    color: NET_DARK,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    fontFamily: 'Inter-Regular',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectedParticipantItem: {
    backgroundColor: '#E6F7FF',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantName: {
    fontSize: 16,
    color: NET_DARK,
    fontFamily: 'Inter-Medium',
  },
  bookableBadge: {
    marginLeft: 8,
    fontSize: 12,
    color: '#D32F2F',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  disabledText: {
    color: colors.muted,
  },
  selectedChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  selectedLabel: {
    fontSize: 14,
    color: colors.muted,
    marginRight: 8,
    marginBottom: 8,
    fontFamily: 'Inter-Regular',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F7FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    shadowColor: NET_DARK,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  fixedChip: {
    backgroundColor: SOFT_BEIGE,
  },
  chipText: {
    color: NET_DARK,
    fontSize: 14,
    marginRight: 8,
    fontFamily: 'Inter-Medium',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: SOFT_BEIGE,
    padding: 12,
    borderRadius: 12,
  },
  durationLabel: {
    fontSize: 16,
    color: NET_DARK,
    marginRight: 16,
    fontFamily: 'Inter-Medium',
  },
  durationPicker: {
    flex: 1,
    color: NET_DARK,
    backgroundColor: WHITE_LINES,
    borderRadius: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: NET_DARK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmButton: {
    backgroundColor: COURT_BLUE,
    marginRight: 8,
  },
  disabledButton: {
    backgroundColor: '#B0BEC5',
    opacity: 0.6,
  },
  cancelButton: {
    backgroundColor: WHITE_LINES,
    borderWidth: 1,
    borderColor: COURT_BLUE,
  },
  buttonText: {
    color: COURT_BLUE,
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  noResults: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 16,
    fontFamily: 'Inter-Regular',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: WHITE_LINES,
  },
  loadingText: {
    marginTop: 16,
    color: colors.muted,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: WHITE_LINES,
  },
  noDataText: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 16,
    marginTop: 16,
    fontFamily: 'Inter-Regular',
  },
  timeButton: {
    backgroundColor: COURT_BLUE,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  timeButtonText: {
    color: WHITE_LINES,
    fontFamily: 'Inter-Medium',
  },
  closeIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 12,
    zIndex: 10,
  },
  bookingInfoContainer: {
    backgroundColor: SOFT_BEIGE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  bookingInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  bookingInfoText: {
    fontSize: 16,
    color: NET_DARK,
    fontFamily: 'Inter-Medium',
  },

  // FlatList Container anpassen:
  participantsList: {
    maxHeight: '50%',
    marginBottom: 24,  // Mehr Abstand zum Button
  },

  // Bottom Container für Buttons:
  modalBottomContainer: {
    marginTop: 'auto',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder || '#E0E0E0',
  },
});

export default AdvancedBookingScreen;