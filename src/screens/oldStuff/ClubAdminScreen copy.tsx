import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  FlatList,
  Modal,
  ActivityIndicator,
  Animated,
  RefreshControl,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  Switch,
} from 'react-native';
import { Picker as RNPicker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../App';
import api, { getClubCourts, getClubSettings, getClubMembers, updateClubSettings, searchPotentialMembers, addUserToClub, inviteUserToClub, approveClubMember, rejectClubMember, removeUserFromClub, updateUserRole, createRecurringEvent, saveCourt, deleteCourt } from '../api/api';
import { RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';

// Brand-aligned color palette
const COURT_BLUE = '#5C9EAD';
const ACE_GREEN = '#4CAF50';
const NET_DARK = '#2A3D45';
const WHITE_LINES = '#FFFFFF';

type ClubAdminScreenRouteProp = RouteProp<RootStackParamList, 'ClubAdmin'>;

interface UserItem {
  id?: number;
  email?: string;
  firstName: string;
  lastName: string;
  role: string;
  bookable: boolean;
  status: string;
}

interface CourtItem {
  id: number;
  name: string;
  surface_type: string | null;
  has_floodlights: boolean;
  season: string;
}

const ClubAdminScreen: React.FC<{ route: ClubAdminScreenRouteProp }> = ({ route }) => {
  const { clubId } = route.params;
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { userClubs, user, fetchUserClubs } = useAuth();
  const [maxBookings, setMaxBookings] = useState('');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [tempRoleFilter, setTempRoleFilter] = useState('All');
  const [tempSortBy, setTempSortBy] = useState('name');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [activeSelection, setActiveSelection] = useState<
    'form' | 'court' | 'weekdays' | 'startDate' | 'endDate' | 'startTime' | 'endTime'
  >('form');
  const [addSearch, setAddSearch] = useState('');
  const [potentialMembers, setPotentialMembers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState('member');
  const [hasFetched, setHasFetched] = useState(false);
  const [courts, setCourts] = useState<CourtItem[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);
  const [selectedCourtName, setSelectedCourtName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [showCourtModal, setShowCourtModal] = useState(false);
  const [editingCourt, setEditingCourt] = useState<CourtItem | null>(null);
  const [courtName, setCourtName] = useState('');
  const [surfaceType, setSurfaceType] = useState('');
  const [hasFloodlights, setHasFloodlights] = useState(false);
  const [courtSeason, setCourtSeason] = useState('all_year');

  const possibleRoles = ['member', 'admin', 'coach', 'team_captain'];

  const weekdaysOptions = [
    t('clubAdmin.monday'),
    t('clubAdmin.tuesday'),
    t('clubAdmin.wednesday'),
    t('clubAdmin.thursday'),
    t('clubAdmin.friday'),
    t('clubAdmin.saturday'),
    t('clubAdmin.sunday')
  ];

  const roleColors = {
    member: colors.muted,
    admin: COURT_BLUE,
    coach: colors.secondary,
    team_captain: colors.accent,
    unknown: '#ccc',
  };

  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    sectionHeader: { color: colors.text },
    input: { backgroundColor: colors.surface, color: colors.text },
    buttonPrimary: { backgroundColor: COURT_BLUE },
    buttonMuted: { backgroundColor: colors.muted },
    userCard: { backgroundColor: colors.surface },
    userName: { color: colors.text },
    roleBadge: (role: string) => ({ backgroundColor: roleColors[role] || '#ccc' }),
    roleDesc: { color: colors.muted },
    modalContent: { backgroundColor: colors.surface },
    modalTitle: { color: colors.text },
    itemText: { color: colors.text },
    filterButton: { backgroundColor: COURT_BLUE },
  };

  useEffect(() => {
    const clubRole = userClubs.find(c => c.id === clubId)?.role;
    if (clubRole === 'admin') {
      setIsAdmin(true);
      if (!hasFetched) {
        fetchData();
        setHasFetched(true);
      }
    } else {
      setIsAdmin(false);
      setLoading(false);
      Toast.show({ type: 'error', text1: t('clubAdmin.adminAccessRequired') });
    }
  }, [clubId, userClubs, hasFetched, t]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchSettings(), fetchClubUsers(), fetchCourts()]);
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.failedToLoadData') });
      console.error('fetchData error:', error);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData().then(() => setRefreshing(false));
  }, [fetchData]);

  useEffect(() => {
    let tempUsers = users.filter(u =>
      (u.id ? `${u.firstName} ${u.lastName}` : u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (roleFilter !== 'All') {
      tempUsers = tempUsers.filter(u => u.role === roleFilter.toLowerCase());
    }
    if (sortBy === 'name') {
      tempUsers.sort((a, b) => (a.id ? `${a.firstName} ${a.lastName}` : a.email || '').localeCompare(b.id ? `${b.firstName} ${b.lastName}` : b.email || ''));
    } else if (sortBy === 'role') {
      tempUsers.sort((a, b) => a.role.localeCompare(b.role));
    }
    setFilteredUsers(tempUsers);
  }, [searchQuery, roleFilter, sortBy, users]);

  const fetchSettings = async () => {
    try {
      const response = await getClubSettings(clubId);
      setMaxBookings(response.max_bookings_allowed.toString());
    } catch (error) {
      console.error('Fetch settings error:', error);
    }
  };

  const fetchClubUsers = async () => {
    try {
      const response = await getClubMembers(clubId, true);
      const usersWithRoles = response.map(user => ({
        id: user.id,
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role || 'unknown',
        status: user.status || 'approved',
        bookable: user.id ? user.bookable ?? true : true,
      }));
      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Fetch users error:', error);
      Toast.show({ type: 'error', text1: t('clubAdmin.failedToFetchMembers'), text2: error.response?.data?.error || t('clubAdmin.errorGeneric') });
    }
  };

  const fetchCourts = async () => {
    try {
      const courtsData = await getClubCourts(clubId, true);
      setCourts(courtsData || []);
    } catch (error) {
      console.error('Fetch courts error:', error);
      setCourts([]);
      Toast.show({ type: 'error', text1: t('clubAdmin.failedToLoadCourts') });
    }
  };

  const retryFetchCourts = async () => {
    Toast.show({ type: 'info', text1: t('clubAdmin.retryingCourts') });
    await fetchCourts();
  };

  const updateSettings = async () => {
    if (!maxBookings || isNaN(Number(maxBookings)) || Number(maxBookings) < 1) {
      return Toast.show({ type: 'error', text1: t('clubAdmin.invalidMaxBookings') });
    }
    try {
      await updateClubSettings(clubId, Number(maxBookings));
      Toast.show({ type: 'success', text1: t('clubAdmin.settingsUpdated'), text2: t('clubAdmin.settingsUpdatedMessage') });
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.failedToUpdateSettings'), text2: error.response?.data?.error || t('clubAdmin.errorGeneric') });
    }
  };

  const searchPotentialMembers = async (query: string) => {
    if (query.length < 3) return;
    try {
      const response = await searchPotentialMembers(query);
      setPotentialMembers(response.filter(u => !users.some(existing => existing.id === u.id)));
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.failedToSearchUsers'), text2: error.response?.data?.error || t('clubAdmin.errorGeneric') });
    }
  };

  const addUser = async (userId: number) => {
    try {
      await addUserToClub(userId, clubId);
      Toast.show({ type: 'success', text1: t('clubAdmin.userAdded'), text2: t('clubAdmin.userAddedMessage') });
      setShowAddModal(false);
      fetchClubUsers();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.failedToAddUser'), text2: error.response?.data?.error || t('clubAdmin.errorGeneric') });
    }
  };

  const inviteUser = async () => {
    if (!inviteEmail) {
      Toast.show({ type: 'error', text1: t('clubAdmin.emailRequired') });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      Toast.show({ type: 'error', text1: t('clubAdmin.invalidEmailFormat') });
      return;
    }
    try {
      await inviteUserToClub(clubId, inviteEmail, inviteFirstName, inviteLastName);
      Toast.show({ type: 'success', text1: t('clubAdmin.inviteSent'), text2: t('clubAdmin.inviteSentMessage', { email: inviteEmail }), visibilityTime: 4000 });
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteFirstName('');
      setInviteLastName('');
      fetchClubUsers();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.failedToSendInvite'), text2: error.response?.data?.error || t('clubAdmin.errorGeneric') });
    }
  };

  const approveUser = async (userId: number) => {
    try {
      await approveClubMember(clubId, userId);
      Toast.show({ type: 'success', text1: t('clubAdmin.userApproved'), text2: t('clubAdmin.userApprovedMessage') });
      fetchClubUsers();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.failedToApproveUser'), text2: error.response?.data?.error || t('clubAdmin.errorGeneric') });
    }
  };

  const rejectUser = async (userId: number) => {
    try {
      await rejectClubMember(clubId, userId);
      Toast.show({ type: 'success', text1: t('clubAdmin.userRejected'), text2: t('clubAdmin.userRejectedMessage') });
      fetchClubUsers();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.failedToRejectUser'), text2: error.response?.data?.error || t('clubAdmin.errorGeneric') });
    }
  };

  const removeUser = (userId: number) => {
    Alert.alert(t('clubAdmin.confirmButton'), t('clubAdmin.confirmRemoveUser'), [
      { text: t('profile.cancel') },
      {
        text: t('clubAdmin.removeButton'),
        onPress: async () => {
          try {
            await removeUserFromClub(userId, clubId);
            Toast.show({ type: 'success', text1: t('clubAdmin.userRemoved'), text2: t('clubAdmin.userRemovedMessage') });
            fetchClubUsers();
          } catch (error) {
            Toast.show({ type: 'error', text1: t('clubAdmin.failedToRemoveUser'), text2: error.response?.data?.error || t('clubAdmin.errorGeneric') });
          }
        },
      },
    ]);
  };

  const openRoleModal = (userId: number, currentRole: string) => {
    setSelectedUserId(userId);
    setSelectedNewRole(currentRole);
    setShowRoleModal(true);
  };

  const confirmUpdateRole = async () => {
    if (selectedUserId) {
      Alert.alert(t('clubAdmin.confirmButton'), t('clubAdmin.confirmChangeRole', { role: selectedNewRole }), [
        { text: t('profile.cancel') },
        {
          text: t('clubAdmin.confirmButton'),
          onPress: async () => {
            try {
              await updateUserRole(clubId, selectedUserId, selectedNewRole);
              Toast.show({ type: 'success', text1: t('clubAdmin.roleUpdated'), text2: t('clubAdmin.roleUpdatedMessage', { role: selectedNewRole }) });
              fetchClubUsers();
              fetchUserClubs();
            } catch (error) {
              Toast.show({ type: 'error', text1: t('clubAdmin.failedToUpdateRole'), text2: error.response?.data?.error || t('clubAdmin.errorGeneric') });
            }
          },
        },
      ]);
    }
    setShowRoleModal(false);
  };

  const openFilterModal = () => {
    setTempRoleFilter(roleFilter);
    setTempSortBy(sortBy);
    setShowFilterModal(true);
  };

  const applyFilters = () => {
    setRoleFilter(tempRoleFilter);
    setSortBy(tempSortBy);
    setShowFilterModal(false);
  };

  const confirmRecurringEvent = () => {
    if (!selectedCourtId || !description || selectedWeekdays.length === 0 || startDate >= endDate) {
      Toast.show({ type: 'error', text1: t('clubAdmin.fillFieldsCorrectly') });
      return;
    }

    const formatTime = (time: Date) => time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    Alert.alert(
      t('clubAdmin.confirmButton'),
      t('clubAdmin.confirmRecurringEvent', {
        courtName: selectedCourtName,
        weekdays: selectedWeekdays.join(', '),
        startDate: startDate.toDateString(),
        endDate: endDate.toDateString(),
        startTime: formatTime(startTime),
        endTime: formatTime(endTime),
      }),
      [
        { text: t('profile.cancel') },
        {
          text: t('clubAdmin.confirmButton'),
          onPress: async () => {
            try {
              await createRecurringEvent(
                clubId,
                selectedCourtId!,
                formatTime(startTime),
                formatTime(endTime),
                {
                  days: selectedWeekdays,
                  start_date: startDate.toISOString().split('T')[0],
                  end_date: endDate.toISOString().split('T')[0],
                },
                description
              );
              Toast.show({ type: 'success', text1: t('clubAdmin.recurringEventsCreated'), text2: t('clubAdmin.recurringEventsCreatedMessage') });
              setShowRecurringModal(false);
              setSelectedCourtId(null);
              setSelectedCourtName('');
              setDescription('');
              setSelectedWeekdays([]);
              setStartDate(new Date());
              setEndDate(new Date());
              setStartTime(new Date());
              setEndTime(new Date());
              setActiveSelection('form');
            } catch (error) {
              Toast.show({ type: 'error', text1: t('clubAdmin.failedToCreateRecurring'), text2: error.response?.data?.error || t('clubAdmin.errorGeneric') });
            }
          },
        },
      ],
      { accessibilityLabel: t('clubAdmin.confirmRecurringDialogLabel') }
    );
  };

  const toggleWeekday = (day: string) => {
    setSelectedWeekdays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const selectCourt = (court: CourtItem) => {
    setSelectedCourtId(court.id);
    setSelectedCourtName(court.name);
    setActiveSelection('form');
  };

  const openCourtSelection = () => setActiveSelection('court');
  const openWeekdaySelection = () => setActiveSelection('weekdays');
  const openStartDateSelection = () => setActiveSelection('startDate');
  const openEndDateSelection = () => setActiveSelection('endDate');
  const openStartTimeSelection = () => setActiveSelection('startTime');
  const openEndTimeSelection = () => setActiveSelection('endTime');

  const openRecurringModal = () => setShowRecurringModal(true);

  const openCourtModal = (court?: CourtItem) => {
    if (court) {
      setEditingCourt(court);
      setCourtName(court.name);
      setSurfaceType(court.surface_type || '');
      setHasFloodlights(court.has_floodlights);
      setCourtSeason(court.season);
    } else {
      setEditingCourt(null);
      setCourtName('');
      setSurfaceType('');
      setHasFloodlights(false);
      setCourtSeason('all_year');
    }
    setShowCourtModal(true);
  };

  const saveCourt = async () => {
    if (!courtName.trim()) {
      Toast.show({ type: 'error', text1: t('clubAdmin.courtNameRequired') });
      return;
    }

    const payload = {
      name: courtName,
      surface_type: surfaceType || null,
      has_floodlights: hasFloodlights,
      season: courtSeason,
    };

    try {
      await saveCourt(clubId, payload, editingCourt?.id);
      Toast.show({
        type: 'success',
        text1: editingCourt ? t('clubAdmin.courtUpdated') : t('clubAdmin.courtAdded'),
        text2: editingCourt ? t('clubAdmin.courtUpdatedMessage') : t('clubAdmin.courtAddedMessage'),
      });
      setShowCourtModal(false);
      fetchCourts();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.failedToSaveCourt'), text2: error.response?.data?.error || t('clubAdmin.errorGeneric') });
    }
  };

  const confirmDeleteCourt = (courtId: number) => {
    Alert.alert(t('clubAdmin.confirmDeleteCourt'), t('clubAdmin.confirmDeleteCourt'), [
      { text: t('profile.cancel') },
      {
        text: t('clubAdmin.deleteButton'),
        onPress: async () => {
          try {
            await deleteCourt(courtId);
            Toast.show({ type: 'success', text1: t('clubAdmin.courtDeleted'), text2: t('clubAdmin.courtDeletedMessage') });
            fetchCourts();
          } catch (error) {
            Toast.show({ type: 'error', text1: t('clubAdmin.failedToDeleteCourt'), text2: error.response?.data?.error || t('clubAdmin.errorGeneric') });
          }
        },
      },
    ]);
  };

  const RenderUser = memo(({ item }: { item: UserItem }) => {
    const scaleAnim = useState(new Animated.Value(1))[0];
    const onPressIn = () => Animated.timing(scaleAnim, { toValue: 0.98, duration: 100, useNativeDriver: true }).start();
    const onPressOut = () => Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start();

    return (
      <Animated.View style={[styles.userCard, { transform: [{ scale: scaleAnim }], ...dynamicStyles.userCard }]}>
        <View style={styles.userInfo}>
          <Icon name="person" size={24} color={colors.muted} accessibilityLabel={t('clubAdmin.userIconLabel')} />
          <Text style={[styles.userName, dynamicStyles.userName]}>
            {item.id ? `${item.firstName} ${item.lastName}` : `${item.email} (${t('clubAdmin.pendingInvite')})`}
            {item.status === 'pending' && item.id ? ` (${t('clubAdmin.pendingApproval')})` : ''}
          </Text>
          <View style={[styles.roleBadge, dynamicStyles.roleBadge(item.role)]}>
            <Text style={styles.roleText}>{item.role}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          {item.status === 'pending' && item.id ? (
            <>
              <TouchableOpacity
                onPress={() => approveUser(item.id!)}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                accessibilityRole="button"
                accessibilityLabel={t('clubAdmin.approveUserLabel', { firstName: item.firstName })}
              >
                <Text style={{ color: ACE_GREEN }}>{t('clubAdmin.approve')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => rejectUser(item.id!)}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                accessibilityRole="button"
                accessibilityLabel={t('clubAdmin.rejectUserLabel', { firstName: item.firstName })}
              >
                <Text style={{ color: colors.error }}>{t('clubAdmin.reject')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => openRoleModal(item.id!, item.role)}
                disabled={item.id === user?.id || !item.id}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                accessibilityRole="button"
                accessibilityLabel={item.id === user?.id ? t('clubAdmin.cannotChangeOwnRoleLabel') : t('clubAdmin.changeRoleLabel', { firstName: item.firstName })}
              >
                <Text style={{ color: item.id === user?.id || !item.id ? colors.muted : COURT_BLUE }}>
                  {t('clubAdmin.changeRole')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeUser(item.id!)}
                disabled={item.id === user?.id || item.role === 'admin' || !item.id}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                accessibilityRole="button"
                accessibilityLabel={item.id === user?.id ? t('clubAdmin.cannotRemoveSelfLabel') : t('clubAdmin.removeUserLabel', { firstName: item.firstName || item.email })}
              >
                <Text style={{ color: (item.id === user?.id || item.role === 'admin' || !item.id) ? colors.muted : colors.error }}>
                  {t('clubAdmin.removeButton')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>
    );
  });

  const RenderCourt = memo(({ item }: { item: CourtItem }) => {
    const scaleAnim = useState(new Animated.Value(1))[0];
    const onPressIn = () => Animated.timing(scaleAnim, { toValue: 0.98, duration: 100, useNativeDriver: true }).start();
    const onPressOut = () => Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start();

    return (
      <Animated.View style={[styles.userCard, { transform: [{ scale: scaleAnim }], ...dynamicStyles.userCard }]}>
        <View style={styles.userInfo}>
          <Icon name="sports-tennis" size={24} color={colors.muted} accessibilityLabel={t('clubAdmin.courtIconLabel')} />
          <Text style={[styles.userName, dynamicStyles.userName]}>
            {item.name}
          </Text>
          <View style={[styles.roleBadge, dynamicStyles.roleBadge('member')]}>
            <Text style={styles.roleText}>{item.season}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => openCourtModal(item)}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            accessibilityRole="button"
            accessibilityLabel={t('clubAdmin.editCourtLabel', { name: item.name })}
          >
            <Text style={{ color: COURT_BLUE }}>{t('clubAdmin.edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => confirmDeleteCourt(item.id)}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            accessibilityRole="button"
            accessibilityLabel={t('clubAdmin.deleteCourtLabel', { name: item.name })}
          >
            <Text style={styles.buttonText}>{t('clubAdmin.deleteButton')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  });

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, dynamicStyles.container]}>
        <View style={styles.innerContainer}>
          <Text style={[styles.title, { color: colors.text }]}>{t('clubAdmin.accessDenied')}</Text>
          <Text style={{ color: colors.muted }}>{t('clubAdmin.notAdminSubtext')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, dynamicStyles.container]}>
        <ActivityIndicator size="large" color={COURT_BLUE} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel={t('clubAdmin.clubAdminContent')}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COURT_BLUE} />}
      >
        <View style={styles.innerContainer}>
          

          <View style={styles.section}>
            <View style={styles.headerRow}>
              <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>{t('clubAdmin.manageUsers')}</Text>
              <TouchableOpacity
                style={[styles.filterButton, dynamicStyles.filterButton]}
                onPress={openFilterModal}
                accessibilityRole="button"
                accessibilityLabel={t('clubAdmin.openFilterSettingsLabel')}
              >
                <Icon name="filter-list" size={24} color={WHITE_LINES} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, dynamicStyles.input, { marginBottom: 12 }]}
              placeholder={t('clubAdmin.searchUsersPlaceholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              accessibilityLabel={t('clubAdmin.searchUsersLabel')}
            />
            <TouchableOpacity
              style={[styles.button, dynamicStyles.buttonPrimary, { marginBottom: 12 }]}
              onPress={() => setShowInviteModal(true)}
              accessibilityRole="button"
              accessibilityLabel={t('clubAdmin.inviteNewUserLabel')}
            >
              <Text style={styles.buttonText}>{t('clubAdmin.inviteNewUser')}</Text>
            </TouchableOpacity>
            <View>
              {filteredUsers.length === 0 ? (
                <Text style={{ color: colors.muted, textAlign: 'center', padding: 16 }}>
                  {t('clubAdmin.noUsersFound')}
                </Text>
              ) : (
                filteredUsers.map(item => <RenderUser key={item.id?.toString() || item.email!} item={item} />)
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>{t('clubAdmin.manageCourts')}</Text>
            {courts.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: 'center', padding: 16 }}>
                {t('clubAdmin.noCourtsFound')}
              </Text>
            ) : (
              courts.map(item => <RenderCourt key={item.id.toString()} item={item} />)
            )}
            <TouchableOpacity
              style={[styles.button, dynamicStyles.buttonPrimary]}
              onPress={() => openCourtModal()}
              accessibilityRole="button"
              accessibilityLabel={t('clubAdmin.addNewCourtLabel')}
            >
              <Text style={styles.buttonText}>{t('clubAdmin.addCourtButton')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.button, dynamicStyles.buttonPrimary]}
              onPress={openRecurringModal}
              accessibilityRole="button"
              accessibilityLabel={t('clubAdmin.createRecurringEventLabel')}
            >
              <Text style={styles.buttonText}>{t('clubAdmin.createRecurringEvent')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showFilterModal} transparent animationType="slide">
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { width: '95%' }]}>
            <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>{t('clubAdmin.filterModalTitle')}</Text>
            <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.roleFilter')}</Text>
            <RNPicker
              selectedValue={tempRoleFilter}
              onValueChange={setTempRoleFilter}
              style={styles.picker}
              accessibilityLabel={t('clubAdmin.selectRoleFilterLabel')}
            >
              <RNPicker.Item label={t('clubAdmin.allRoles')} value="All" />
              <RNPicker.Item label={t('clubAdmin.adminRole')} value="admin" />
              <RNPicker.Item label={t('clubAdmin.memberRole')} value="member" />
              <RNPicker.Item label={t('clubAdmin.coachRole')} value="coach" />
              <RNPicker.Item label={t('clubAdmin.teamCaptainRole')} value="team_captain" />
            </RNPicker>
            <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.sortBy')}</Text>
            <RNPicker
              selectedValue={tempSortBy}
              onValueChange={setTempSortBy}
              style={styles.picker}
              accessibilityLabel={t('clubAdmin.sortByLabel')}
            >
              <RNPicker.Item label={t('clubAdmin.sortByName')} value="name" />
              <RNPicker.Item label={t('clubAdmin.sortByRole')} value="role" />
            </RNPicker>
            <TouchableOpacity
              style={[styles.button, dynamicStyles.buttonPrimary]}
              onPress={applyFilters}
              accessibilityRole="button"
              accessibilityLabel={t('clubAdmin.applyFiltersLabel')}
            >
              <Text style={styles.buttonText}>{t('clubAdmin.applyButton')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, dynamicStyles.buttonMuted]}
              onPress={() => setShowFilterModal(false)}
              accessibilityRole="button"
              accessibilityLabel={t('clubAdmin.cancelFilterChangesLabel')}
            >
              <Text style={styles.buttonText}>{t('profile.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={showRoleModal} transparent animationType="slide">
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { width: '95%' }]}>
            <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>{t('clubAdmin.selectNewRole')}</Text>
            <RNPicker
              selectedValue={selectedNewRole}
              onValueChange={setSelectedNewRole}
              style={styles.picker}
              accessibilityLabel={t('clubAdmin.selectNewRoleLabel')}
            >
              {possibleRoles.map(role => (
                <RNPicker.Item
                  key={role}
                  label={t(`clubAdmin.${role}Role`)}
                  value={role}
                />
              ))}
            </RNPicker>
            <Text style={[styles.roleDesc, dynamicStyles.roleDesc]}>
              {selectedNewRole === 'admin'
                ? t('clubAdmin.adminRoleDesc')
                : selectedNewRole === 'coach'
                ? t('clubAdmin.coachRoleDesc')
                : selectedNewRole === 'team_captain'
                ? t('clubAdmin.teamCaptainRoleDesc')
                : t('clubAdmin.memberRoleDesc')}
            </Text>
            <TouchableOpacity
              style={[styles.button, dynamicStyles.buttonPrimary]}
              onPress={confirmUpdateRole}
              accessibilityRole="button"
              accessibilityLabel={t('clubAdmin.confirmRoleChangeLabel')}
            >
              <Text style={styles.buttonText}>{t('clubAdmin.confirmButton')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, dynamicStyles.buttonMuted]}
              onPress={() => setShowRoleModal(false)}
              accessibilityRole="button"
              accessibilityLabel={t('clubAdmin.cancelRoleChangeLabel')}
            >
              <Text style={styles.buttonText}>{t('profile.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={showAddModal} transparent animationType="slide">
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { width: '95%' }]}>
            <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>{t('clubAdmin.addExistingUser')}</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder={t('clubAdmin.searchUsersPlaceholder')}
              value={addSearch}
              onChangeText={text => {
                setAddSearch(text);
                searchPotentialMembers(text);
              }}
              accessibilityLabel={t('clubAdmin.searchUsersToAddLabel')}
            />
            <FlatList
              data={potentialMembers}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => addUser(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('clubAdmin.addUserLabel', { firstName: item.firstName, lastName: item.lastName })}
                >
                  <Text style={[styles.itemText, dynamicStyles.itemText]}>
                    {item.firstName} {item.lastName}
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={item => item.id.toString()}
            />
            <TouchableOpacity
              style={[styles.button, dynamicStyles.buttonMuted]}
              onPress={() => setShowAddModal(false)}
              accessibilityRole="button"
              accessibilityLabel={t('clubAdmin.cancelAddUserLabel')}
            >
              <Text style={styles.buttonText}>{t('profile.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={showInviteModal} transparent animationType="slide">
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { width: '95%' }]}>
            <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>{t('clubAdmin.inviteModalTitle')}</Text>
            <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.emailLabel')}</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder={t('clubAdmin.emailPlaceholder')}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityLabel={t('clubAdmin.inviteEmailLabel')}
            />
            <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.firstNameLabel')}</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder={t('clubAdmin.firstNamePlaceholder')}
              value={inviteFirstName}
              onChangeText={setInviteFirstName}
              accessibilityLabel={t('clubAdmin.inviteFirstNameLabel')}
            />
            <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.lastNameLabel')}</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder={t('clubAdmin.lastNamePlaceholder')}
              value={inviteLastName}
              onChangeText={setInviteLastName}
              accessibilityLabel={t('clubAdmin.inviteLastNameLabel')}
            />
            <TouchableOpacity
              style={[styles.button, dynamicStyles.buttonPrimary]}
              onPress={inviteUser}
              accessibilityRole="button"
              accessibilityLabel={t('clubAdmin.sendInviteButton')}
            >
              <Text style={styles.buttonText}>{t('clubAdmin.sendInviteButton')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, dynamicStyles.buttonMuted]}
              onPress={() => setShowInviteModal(false)}
              accessibilityRole="button"
              accessibilityLabel={t('clubAdmin.cancelInviteLabel')}
            >
              <Text style={styles.buttonText}>{t('profile.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={showCourtModal} transparent animationType="slide">
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { width: '95%' }]}>
            <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>
              {editingCourt ? t('clubAdmin.editCourtTitle') : t('clubAdmin.addCourtTitle')}
            </Text>
            <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.courtNameLabel')}</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder={t('clubAdmin.courtNamePlaceholder')}
              value={courtName}
              onChangeText={setCourtName}
              accessibilityLabel={t('clubAdmin.courtNameLabel')}
            />
            <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.surfaceTypeLabel')}</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder={t('clubAdmin.surfaceTypePlaceholder')}
              value={surfaceType}
              onChangeText={setSurfaceType}
              accessibilityLabel={t('clubAdmin.surfaceTypeLabel')}
            />
            <View style={styles.switchRow}>
              <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.floodlightsLabel')}</Text>
              <Switch
                value={hasFloodlights}
                onValueChange={setHasFloodlights}
                trackColor={{ false: colors.muted, true: COURT_BLUE }}
                thumbColor={WHITE_LINES}
                accessibilityLabel={t('clubAdmin.toggleFloodlightsLabel')}
              />
            </View>
            <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.seasonLabel')}</Text>
            <RNPicker
              selectedValue={courtSeason}
              onValueChange={setCourtSeason}
              style={styles.picker}
              accessibilityLabel={t('clubAdmin.selectCourtSeasonLabel')}
            >
              <RNPicker.Item label={t('clubAdmin.allYear')} value="all_year" />
              <RNPicker.Item label={t('clubAdmin.summer')} value="summer" />
              <RNPicker.Item label={t('clubAdmin.winter')} value="winter" />
            </RNPicker>
            <TouchableOpacity
              style={[styles.button, dynamicStyles.buttonPrimary]}
              onPress={saveCourt}
              accessibilityRole="button"
              accessibilityLabel={editingCourt ? t('clubAdmin.saveCourtLabel') : t('clubAdmin.addCourtLabel')}
            >
              <Text style={styles.buttonText}>{editingCourt ? t('profile.save') : t('clubAdmin.addCourtButton')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, dynamicStyles.buttonMuted]}
              onPress={() => setShowCourtModal(false)}
              accessibilityRole="button"
              accessibilityLabel={t('clubAdmin.cancelCourtChangesLabel')}
            >
              <Text style={styles.buttonText}>{t('profile.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={showRecurringModal} transparent animationType="slide">
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { width: '95%' }]}>
            <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>{t('clubAdmin.createRecurringEvent')}</Text>
            {activeSelection === 'form' && (
              <>
                <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.courtLabel')}</Text>
                <TouchableOpacity
                  style={[styles.button, dynamicStyles.buttonPrimary]}
                  onPress={openCourtSelection}
                  accessibilityRole="button"
                  accessibilityLabel={t('clubAdmin.selectCourtLabel')}
                >
                  <Text style={styles.buttonText}>
                    {selectedCourtName || t('clubAdmin.selectCourtPlaceholder')}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.descriptionLabel')}</Text>
                <TextInput
                  style={[styles.input, dynamicStyles.input]}
                  placeholder={t('clubAdmin.descriptionPlaceholder')}
                  value={description}
                  onChangeText={setDescription}
                  accessibilityLabel={t('clubAdmin.descriptionLabel')}
                />
                <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.weekdaysLabel')}</Text>
                <TouchableOpacity
                  style={[styles.button, dynamicStyles.buttonPrimary]}
                  onPress={openWeekdaySelection}
                  accessibilityRole="button"
                  accessibilityLabel={t('clubAdmin.selectWeekdaysLabel')}
                >
                  <Text style={styles.buttonText}>
                    {selectedWeekdays.length > 0 ? selectedWeekdays.join(', ') : t('clubAdmin.selectWeekdaysPlaceholder')}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.startDateLabel')}</Text>
                <TouchableOpacity
                  style={[styles.button, dynamicStyles.buttonPrimary]}
                  onPress={openStartDateSelection}
                  accessibilityRole="button"
                  accessibilityLabel={t('clubAdmin.selectStartDateLabel')}
                >
                  <Text style={styles.buttonText}>{startDate.toDateString()}</Text>
                </TouchableOpacity>
                <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.endDateLabel')}</Text>
                <TouchableOpacity
                  style={[styles.button, dynamicStyles.buttonPrimary]}
                  onPress={openEndDateSelection}
                  accessibilityRole="button"
                  accessibilityLabel={t('clubAdmin.selectEndDateLabel')}
                >
                  <Text style={styles.buttonText}>{endDate.toDateString()}</Text>
                </TouchableOpacity>
                <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.startTimeLabel')}</Text>
                <TouchableOpacity
                  style={[styles.button, dynamicStyles.buttonPrimary]}
                  onPress={openStartTimeSelection}
                  accessibilityRole="button"
                  accessibilityLabel={t('clubAdmin.selectStartTimeLabel')}
                >
                  <Text style={styles.buttonText}>{startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
                <Text style={[styles.modalSubtitle, dynamicStyles.sectionHeader]}>{t('clubAdmin.endTimeLabel')}</Text>
                <TouchableOpacity
                  style={[styles.button, dynamicStyles.buttonPrimary]}
                  onPress={openEndTimeSelection}
                  accessibilityRole="button"
                  accessibilityLabel={t('clubAdmin.selectEndTimeLabel')}
                >
                  <Text style={styles.buttonText}>{endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, dynamicStyles.buttonPrimary]}
                  onPress={confirmRecurringEvent}
                  disabled={recurringLoading}
                  accessibilityRole="button"
                  accessibilityLabel={t('clubAdmin.confirmRecurringEventLabel')}
                >
                  {recurringLoading ? (
                    <ActivityIndicator size="small" color={WHITE_LINES} />
                  ) : (
                    <Text style={styles.buttonText}>{t('clubAdmin.confirmButton')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, dynamicStyles.buttonMuted]}
                  onPress={() => setShowRecurringModal(false)}
                  accessibilityRole="button"
                  accessibilityLabel={t('clubAdmin.confirmRecurringLabel')}
                >
                  <Text style={styles.buttonText}>{t('profile.cancel')}</Text>
                </TouchableOpacity>
              </>
            )}
            {activeSelection === 'court' && (
              <FlatList
                data={courts}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.courtItem}
                    onPress={() => selectCourt(item)}
                    accessibilityRole="button"
                    accessibilityLabel={t('clubAdmin.selectCourtLabel', { name: item.name })}
                  >
                    <Text style={[styles.itemText, dynamicStyles.itemText]}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                keyExtractor={item => item.id.toString()}
              />
            )}
            {activeSelection === 'weekdays' && (
              <>
                {weekdaysOptions.map(day => (
                  <TouchableOpacity
                    key={day}
                    style={styles.participantItem}
                    onPress={() => toggleWeekday(day)}
                    accessibilityRole="button"
                    accessibilityLabel={t('clubAdmin.toggleWeekdayLabel', { day })}
                  >
                    <Text style={[styles.itemText, dynamicStyles.itemText]}>{day}</Text>
                    {selectedWeekdays.includes(day) && (
                      <Icon name="check" size={20} color={ACE_GREEN} style={styles.checkIcon} />
                    )}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.button, dynamicStyles.buttonPrimary]}
                  onPress={() => setActiveSelection('form')}
                  accessibilityRole="button"
                  accessibilityLabel={t('clubAdmin.confirmWeekdaysLabel')}
                >
                  <Text style={styles.buttonText}>{t('clubAdmin.confirmButton')}</Text>
                </TouchableOpacity>
              </>
            )}
            {activeSelection === 'startDate' && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  if (date) setStartDate(date);
                  setActiveSelection('form');
                }}
                style={styles.datePicker}
                accessibilityLabel={t('clubAdmin.selectStartDateLabel')}
              />
            )}
            {activeSelection === 'endDate' && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  if (date) setEndDate(date);
                  setActiveSelection('form');
                }}
                style={styles.datePicker}
                accessibilityLabel={t('clubAdmin.selectEndDateLabel')}
              />
            )}
            {activeSelection === 'startTime' && (
              <DateTimePicker
                value={startTime}
                mode="time"
                display="default"
                onChange={(event, date) => {
                  if (date) setStartTime(date);
                  setActiveSelection('form');
                }}
                style={styles.datePicker}
                accessibilityLabel={t('clubAdmin.selectStartTimeLabel')}
              />
            )}
            {activeSelection === 'endTime' && (
              <DateTimePicker
                value={endTime}
                mode="time"
                display="default"
                onChange={(event, date) => {
                  if (date) setEndTime(date);
                  setActiveSelection('form');
                }}
                style={styles.datePicker}
                accessibilityLabel={t('clubAdmin.selectEndTimeLabel')}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: COURT_BLUE }]}
        onPress={() => setShowAddModal(true)}
        accessibilityRole="button"
        accessibilityLabel={t('clubAdmin.addExistingUserLabel')}
      >
        <Icon name="person-add" size={24} color={WHITE_LINES} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  innerContainer: { padding: 12 },
  scrollContent: { paddingBottom: 80 },
  section: { marginBottom: 24 },
  sectionHeader: { fontSize: 20, fontFamily: 'Inter-Bold', marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  filterButton: { padding: 8, borderRadius: 8 },
  input: { 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 12, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 4,
    fontFamily: 'Inter-Regular',
  },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  halfPicker: { flex: 1, backgroundColor: WHITE_LINES, borderRadius: 8 },
  userCard: { 
    padding: 12, 
    borderRadius: 12, 
    marginBottom: 12, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 4 
  },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  userName: { flex: 1, marginLeft: 8, fontFamily: 'Inter-Medium', fontSize: 16 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  roleText: { color: WHITE_LINES, fontSize: 12, fontFamily: 'Inter-SemiBold' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 16 },
  button: { 
    padding: 12, 
    borderRadius: 8, 
    alignItems: 'center', 
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: { color: WHITE_LINES, fontFamily: 'Inter-Medium', fontSize: 16 },
  fab: { 
    position: 'absolute', 
    bottom: 32, 
    right: 32, 
    borderRadius: 28, 
    padding: 12, 
    shadowColor: '#000', 
    shadowOpacity: 0.2, 
    shadowRadius: 8 
  },
  modalOverlay: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.5)' 
  },
  modalContent: { 
    width: '95%', 
    maxHeight: Dimensions.get('window').height * 0.8, 
    padding: 12, 
    borderRadius: 20, 
    shadowOpacity: 0.2, 
    shadowRadius: 12 
  },
  modalScrollContent: { paddingBottom: 30 },
  modalTitle: { 
    fontSize: 20, 
    fontFamily: 'Inter-Bold', 
    marginBottom: 12, 
    textAlign: 'center' 
  },
  modalSubtitle: { 
    fontSize: 16, 
    fontFamily: 'Inter-Medium', 
    marginBottom: 8 
  },
  roleDesc: { 
    marginBottom: 12, 
    textAlign: 'center', 
    fontFamily: 'Inter-Regular' 
  },
  itemText: { 
    padding: 12, 
    fontFamily: 'Inter-Regular',
    fontSize: 16 
  },
  picker: { 
    backgroundColor: WHITE_LINES, 
    borderRadius: 8, 
    marginBottom: 12 
  },
  participantItem: { 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#ccc' 
  },
  checkIcon: { 
    marginLeft: 8 
  },
  courtItem: { 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#ccc' 
  },
  emptyContainer: { 
    alignItems: 'center', 
    padding: 12 
  },
  datePicker: { 
    marginBottom: 12 
  },
  switchRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
});

export default ClubAdminScreen;