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
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  Switch,
  RefreshControl,
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
import * as Animatable from 'react-native-animatable';
import LinearGradient from 'react-native-linear-gradient';
import { format } from 'date-fns'; // Import date-fns for formatting
const { width } = Dimensions.get('window');
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
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [showCourtModal, setShowCourtModal] = useState(false);
  const [editingCourt, setEditingCourt] = useState<CourtItem | null>(null);
  const [courtName, setCourtName] = useState('');
  const [surfaceType, setSurfaceType] = useState('');
  const [hasFloodlights, setHasFloodlights] = useState(false);
  const [courtSeason, setCourtSeason] = useState('all_year');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [overviewMetrics, setOverviewMetrics] = useState({ members: 0, courts: 0, bookings: 0 });
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

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

  // Weekday map for recurrence days (assuming ISO: Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6, Sunday=0)
  const weekdayMap = {
    [t('clubAdmin.monday')]: 1,
    [t('clubAdmin.tuesday')]: 2,
    [t('clubAdmin.wednesday')]: 3,
    [t('clubAdmin.thursday')]: 4,
    [t('clubAdmin.friday')]: 5,
    [t('clubAdmin.saturday')]: 6,
    [t('clubAdmin.sunday')]: 0,
  };

  const roleColors = {
    member: colors.muted,
    admin: COURT_BLUE,
    coach: colors.secondary,
    team_captain: colors.accent,
    unknown: '#ccc',
  };

  // Fetch data function
  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [settings, members, clubCourts] = await Promise.all([
        getClubSettings(clubId),
        getClubMembers(clubId),
        getClubCourts(clubId),
      ]);
      setMaxBookings(settings.max_bookings_allowed.toString());
      setUsers(members);
      setFilteredUsers(members);
      setCourts(clubCourts);
      setOverviewMetrics({
        members: members.length,
        courts: clubCourts.length,
        bookings: 0,
      });
      const club = userClubs.find((c) => c.club_id === clubId);
      setIsAdmin(club?.role === 'admin');
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.failedToLoadData') });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [clubId, t, userClubs]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter users
  const filterUsers = useCallback(() => {
    let filtered = users;
    if (roleFilter !== 'All') filtered = filtered.filter((u) => u.role === roleFilter);
    if (searchQuery)
      filtered = filtered.filter((u) =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
      );
    filtered.sort((a, b) =>
      sortBy === 'name' ? a.firstName.localeCompare(b.firstName) : a.role.localeCompare(b.role)
    );
    setFilteredUsers(filtered);
  }, [users, roleFilter, searchQuery, sortBy]);

  useEffect(() => filterUsers(), [filterUsers]);

  // Toggle expandable sections
  const toggleSection = (sectionKey: string) => {
    setExpandedSection(expandedSection === sectionKey ? null : sectionKey);
  };

  // Single FlatList data for sections
  const sections = [
    { key: 'settings', title: t('clubAdmin.settings') },
    { key: 'members', title: t('clubAdmin.members') },
    { key: 'courts', title: t('clubAdmin.courts') },
    { key: 'recurring', title: t('clubAdmin.recurringEvents') },
  ];

  // Render section item
  const renderSection = ({ item }: { item: { key: string; title: string } }) => {
    const isExpanded = expandedSection === item.key;
    let content = null;

    switch (item.key) {
      case 'settings':
        content = (
          <View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder={t('clubAdmin.maxBookingsPlaceholder')}
              value={maxBookings}
              onChangeText={setMaxBookings}
              keyboardType="numeric"
              accessibilityLabel={t('clubAdmin.maxBookingsPlaceholder')}
            />
            <LinearGradient colors={['#5C9EAD', '#4A8A9D']} style={styles.buttonGradient}>
              <TouchableOpacity
                style={styles.button}
                onPress={handleUpdateSettings}
                disabled={settingsLoading}
                accessibilityLabel={t('clubAdmin.saveSettings')}
              >
                {settingsLoading ? (
                  <ActivityIndicator size="small" color={WHITE_LINES} />
                ) : (
                  <Text style={styles.buttonText}>{t('clubAdmin.saveSettings')}</Text>
                )}
              </TouchableOpacity>
            </LinearGradient>
          </View>
        );
        break;
      case 'members':
        content = (
          <View>
            <View style={styles.headerRow}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, flex: 1 }]}
                placeholder={t('clubAdmin.searchUsersPlaceholder')}
                value={searchQuery}
                onChangeText={setSearchQuery}
                accessibilityLabel={t('clubAdmin.searchUsersLabel')}
              />
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowFilterModal(true)}
                accessibilityLabel={t('clubAdmin.openFilterSettingsLabel')}
              >
                <Icon name="filter-list" size={24} color={NET_DARK} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => <UserCard item={item} />}
              ListEmptyComponent={<Text style={{ color: colors.muted }}>{t('clubAdmin.noUsersFound')}</Text>}
            />
            <LinearGradient colors={['#4CAF50', '#3B9E40']} style={styles.buttonGradient}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => setShowInviteModal(true)}
                accessibilityLabel={t('clubAdmin.inviteNewUserLabel')}
              >
                <Text style={styles.buttonText}>{t('clubAdmin.inviteNewUser')}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        );
        break;
      case 'courts':
        content = (
          <View>
            <FlatList
              data={courts}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => <CourtCard item={item} />}
              ListEmptyComponent={<Text style={{ color: colors.muted }}>{t('clubAdmin.noCourtsFound')}</Text>}
            />
            <LinearGradient colors={['#4CAF50', '#3B9E40']} style={styles.buttonGradient}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  setEditingCourt(null);
                  setCourtName('');
                  setSurfaceType('');
                  setHasFloodlights(false);
                  setCourtSeason('all_year');
                  setShowCourtModal(true);
                }}
                accessibilityLabel={t('clubAdmin.addNewCourtLabel')}
              >
                <Text style={styles.buttonText}>{t('clubAdmin.addCourt')}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        );
        break;
      case 'recurring':
        content = (
          <LinearGradient colors={['#4CAF50', '#3B9E40']} style={styles.buttonGradient}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setShowRecurringModal(true)}
              accessibilityLabel={t('clubAdmin.createRecurringEventLabel')}
            >
              <Text style={styles.buttonText}>{t('clubAdmin.createRecurring')}</Text>
            </TouchableOpacity>
          </LinearGradient>
        );
        break;
    }

    return (
      <View style={styles.section}>
        <TouchableOpacity onPress={() => toggleSection(item.key)} style={styles.sectionToggle}>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>{item.title}</Text>
          <Icon name={isExpanded ? 'expand-less' : 'expand-more'} size={24} color={NET_DARK} />
        </TouchableOpacity>
        {isExpanded && (
          <Animatable.View animation="fadeInDown" duration={300}>
            {content}
          </Animatable.View>
        )}
      </View>
    );
  };

  // Overview as ListHeaderComponent
  const renderHeader = () => (
    <Animatable.View animation="fadeIn" duration={800} style={styles.overviewContainer}>
      <Text style={[styles.mainHeader, { color: colors.text }]}>{t('clubAdmin.overview')}</Text>
      <View style={styles.metricsRow}>
        <MetricCard icon="people" label={t('clubAdmin.members')} value={overviewMetrics.members} onPress={() => toggleSection('members')} />
        <MetricCard icon="sports-tennis" label={t('clubAdmin.courts')} value={overviewMetrics.courts} onPress={() => toggleSection('courts')} />
        <MetricCard icon="calendar-today" label={t('clubAdmin.bookings')} value={overviewMetrics.bookings} onPress={() => {/* Navigate */}} />
      </View>
    </Animatable.View>
  );

  // Reusable Metric Card
  const MetricCard = ({ icon, label, value, onPress }: { icon: string; label: string; value: number; onPress: () => void }) => (
    <TouchableOpacity style={[styles.metricCard, { backgroundColor: colors.surface }]} onPress={onPress}>
      <Icon name={icon} size={32} color={COURT_BLUE} />
      <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.muted }]} numberOfLines={1} ellipsizeMode="tail">{label}</Text>
    </TouchableOpacity>
  );

  // User Card Component
  const UserCard = memo(({ item }: { item: UserItem }) => (
    <View style={[styles.userCard, { backgroundColor: colors.surface }]}>
      <View style={styles.userInfo}>
        <Icon name="person" size={24} color={NET_DARK} />
        <Text style={[styles.userName, { color: colors.text }]}>{`${item.firstName} ${item.lastName}`}</Text>
        <View style={[styles.roleBadge, roleColors[item.role] ? { backgroundColor: roleColors[item.role] } : { backgroundColor: '#ccc' }]}>
          <Text style={styles.roleText}>{item.role}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {item.status === 'pending' && (
          <>
            <TouchableOpacity onPress={() => handleApproveMember(item.id)}>
              <Icon name="check" size={24} color={ACE_GREEN} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleRejectMember(item.id)}>
              <Icon name="close" size={24} color="red" />
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity onPress={() => { setSelectedUserId(item.id); setSelectedNewRole(item.role); setShowRoleModal(true); }}>
          <Icon name="edit" size={24} color={COURT_BLUE} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleRemoveUser(item.id)}>
          <Icon name="delete" size={24} color="red" />
        </TouchableOpacity>
      </View>
    </View>
  ));

  // Court Card Component
  const CourtCard = memo(({ item }: { item: CourtItem }) => (
    <View style={[styles.userCard, { backgroundColor: colors.surface }]}>
      <Text style={[styles.userName, { color: colors.text }]}>{item.name}</Text>
      <Text style={{ color: colors.muted }}>{item.surface_type} | Floodlights: {item.has_floodlights ? 'Yes' : 'No'} | Season: {item.season}</Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => {
          setEditingCourt(item);
          setCourtName(item.name);
          setSurfaceType(item.surface_type || '');
          setHasFloodlights(item.has_floodlights);
          setCourtSeason(item.season);
          setShowCourtModal(true);
        }}>
          <Icon name="edit" size={24} color={COURT_BLUE} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteCourt(item.id)}>
          <Icon name="delete" size={24} color="red" />
        </TouchableOpacity>
      </View>
    </View>
  ));

  // Handlers
  const handleUpdateSettings = async () => {
    setSettingsLoading(true);
    try {
      console.log('Updating club settings with max bookings:', maxBookings);
      await updateClubSettings(clubId, parseInt(maxBookings));
      Toast.show({ type: 'success', text1: t('clubAdmin.settingsUpdated') });
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.updateError') });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSearchPotentialMembers = async (query: string) => {
    setAddSearch(query);
    if (query.length > 2) {
      try {
        const results = await searchPotentialMembers(clubId, query);
        setPotentialMembers(results);
      } catch (error) {
        Toast.show({ type: 'error', text1: t('clubAdmin.searchError') });
      }
    } else {
      setPotentialMembers([]);
    }
  };

  const handleAddUser = async (userId: number) => {
    try {
      await addUserToClub(clubId, userId);
      Toast.show({ type: 'success', text1: t('clubAdmin.userAdded') });
      setShowAddModal(false);
      fetchData();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.addError') });
    }
  };

  const handleInviteUser = async () => {
    try {
      await inviteUserToClub(clubId, inviteEmail, inviteFirstName, inviteLastName);
      Toast.show({ type: 'success', text1: t('clubAdmin.inviteSent') });
      setShowInviteModal(false);
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.inviteError') });
    }
  };

  const handleApproveMember = async (userId: number) => {
    try {
      await approveClubMember(clubId, userId);
      Toast.show({ type: 'success', text1: t('clubAdmin.memberApproved') });
      fetchData();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.approveError') });
    }
  };

  const handleRejectMember = async (userId: number) => {
    try {
      await rejectClubMember(clubId, userId);
      Toast.show({ type: 'success', text1: t('clubAdmin.memberRejected') });
      fetchData();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.rejectError') });
    }
  };

  const handleRemoveUser = async (userId: number) => {
    Alert.alert(t('clubAdmin.confirmRemove'), t('clubAdmin.removeWarning'), [
      { text: t('clubAdmin.cancel'), style: 'cancel' },
      {
        text: t('clubAdmin.remove'),
        onPress: async () => {
          try {
            await removeUserFromClub(clubId, userId);
            Toast.show({ type: 'success', text1: t('clubAdmin.userRemoved') });
            fetchData();
          } catch (error) {
            Toast.show({ type: 'error', text1: t('clubAdmin.removeError') });
          }
        },
      },
    ]);
  };

  const handleUpdateRole = async (userId: number, newRole: string) => {
    try {
      await updateUserRole(clubId, userId, newRole);
      Toast.show({ type: 'success', text1: t('clubAdmin.roleUpdated') });
      setShowRoleModal(false);
      fetchData();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.roleUpdateError') });
    }
  };

  const handleCreateRecurring = async () => {
    setRecurringLoading(true);
    try {
      const payload = {
        court_id: selectedCourtId,
        start_time_daily: format(startTime, 'HH:mm'),
        end_time_daily: format(endTime, 'HH:mm'),
        recurrence: {
          days: selectedWeekdays.map(day => weekdayMap[day] || 0), // Use weekdayMap to get numbers
        },
        description,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
      };
      await createRecurringEvent(payload);
      Toast.show({ type: 'success', text1: t('clubAdmin.recurringCreated') });
      setShowRecurringModal(false);
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.recurringError') });
    } finally {
      setRecurringLoading(false);
    }
  };

  const handleSaveCourt = async () => {
    try {
      await saveCourt(clubId, {
        id: editingCourt ? editingCourt.id : undefined,
        name: courtName,
        surface_type: surfaceType,
        has_floodlights: hasFloodlights,
        season: courtSeason,
      });
      Toast.show({ type: 'success', text1: t('clubAdmin.courtSaved') });
      setShowCourtModal(false);
      fetchData();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.courtSaveError') });
    }
  };

  const handleDeleteCourt = async (courtId: number) => {
    Alert.alert(t('clubAdmin.confirmDeleteCourt'), t('clubAdmin.deleteCourtWarning'), [
      { text: t('clubAdmin.cancel'), style: 'cancel' },
      {
        text: t('clubAdmin.delete'),
        onPress: async () => {
          try {
            await deleteCourt(courtId);
            Toast.show({ type: 'success', text1: t('clubAdmin.courtDeleted') });
            fetchData();
          } catch (error) {
            Toast.show({ type: 'error', text1: t('clubAdmin.deleteCourtError') });
          }
        },
      },
    ]);
  };

  const handleApplyFilters = () => {
    setRoleFilter(tempRoleFilter);
    setSortBy(tempSortBy);
    setShowFilterModal(false);
  };

  const toggleWeekday = (day: string) => {
    setSelectedWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  // Validation for enabling Create button
  const isFormValid = () =>
    !!selectedCourtId &&
    description.trim().length > 0 &&
    selectedWeekdays.length > 0 &&
    startDate &&
    endDate &&
    startTime &&
    endTime;

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COURT_BLUE} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <FlatList
          data={sections}
          keyExtractor={(item) => item.key}
          renderItem={renderSection}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor={COURT_BLUE} title={t('clubAdmin.refreshing')} />
          }
          contentContainerStyle={styles.listContent}
        />
      </KeyboardAvoidingView>

      {/* Filter Modal */}
      <Modal visible={showFilterModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('clubAdmin.filterModalTitle')}</Text>
            <View style={styles.filterRow}>
              <RNPicker
                selectedValue={tempRoleFilter}
                onValueChange={setTempRoleFilter}
                style={styles.halfPicker}
                accessibilityLabel={t('clubAdmin.roleFilter')}
              >
                <RNPicker.Item label={t('clubAdmin.allRoles')} value="All" />
                <RNPicker.Item label={t('clubAdmin.adminRole')} value="admin" />
                <RNPicker.Item label={t('clubAdmin.memberRole')} value="member" />
                <RNPicker.Item label={t('clubAdmin.coachRole')} value="coach" />
                <RNPicker.Item label={t('clubAdmin.teamCaptainRole')} value="team_captain" />
              </RNPicker>
              <RNPicker
                selectedValue={tempSortBy}
                onValueChange={setTempSortBy}
                style={styles.halfPicker}
                accessibilityLabel={t('clubAdmin.sortBy')}
              >
                <RNPicker.Item label={t('clubAdmin.sortByName')} value="name" />
                <RNPicker.Item label={t('clubAdmin.sortByRole')} value="role" />
              </RNPicker>
            </View>
            <LinearGradient colors={['#5C9EAD', '#4A8A9D']} style={styles.buttonGradient}>
              <TouchableOpacity
                style={styles.button}
                onPress={handleApplyFilters}
                accessibilityLabel={t('clubAdmin.applyFiltersLabel')}
              >
                <Text style={styles.buttonText}>{t('clubAdmin.applyButton')}</Text>
              </TouchableOpacity>
            </LinearGradient>
            <TouchableOpacity
              style={[styles.mutedButton, { backgroundColor: colors.muted }]}
              onPress={() => setShowFilterModal(false)}
              accessibilityLabel={t('clubAdmin.cancelFilterChangesLabel')}
            >
              <Text style={styles.buttonText}>{t('clubAdmin.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Existing User Modal */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('clubAdmin.addExistingUser')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder={t('clubAdmin.searchUsersPlaceholder')}
              value={addSearch}
              onChangeText={handleSearchPotentialMembers}
              accessibilityLabel={t('clubAdmin.searchUsersToAddLabel')}
            />
            <FlatList
              data={potentialMembers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.participantItem}
                  onPress={() => handleAddUser(item.id)}
                  accessibilityLabel={t('clubAdmin.addUserLabel', { firstName: item.firstName, lastName: item.lastName })}
                >
                  <Text style={[styles.itemText, { color: colors.text }]}>{`${item.firstName} ${item.lastName}`}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ color: colors.muted }}>{t('clubAdmin.noUsersFound')}</Text>}
            />
            <TouchableOpacity
              style={[styles.mutedButton, { backgroundColor: colors.muted }]}
              onPress={() => setShowAddModal(false)}
              accessibilityLabel={t('clubAdmin.cancelAddUserLabel')}
            >
              <Text style={styles.buttonText}>{t('clubAdmin.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Invite New User Modal */}
      <Modal visible={showInviteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('clubAdmin.inviteModalTitle')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder={t('clubAdmin.emailPlaceholder')}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              accessibilityLabel={t('clubAdmin.inviteEmailLabel')}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder={t('clubAdmin.firstNamePlaceholder')}
              value={inviteFirstName}
              onChangeText={setInviteFirstName}
              accessibilityLabel={t('clubAdmin.inviteFirstNameLabel')}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder={t('clubAdmin.lastNamePlaceholder')}
              value={inviteLastName}
              onChangeText={setInviteLastName}
              accessibilityLabel={t('clubAdmin.inviteLastNameLabel')}
            />
            <LinearGradient colors={['#4CAF50', '#3B9E40']} style={styles.buttonGradient}>
              <TouchableOpacity
                style={styles.button}
                onPress={handleInviteUser}
                accessibilityLabel={t('clubAdmin.sendInviteButton')}
              >
                <Text style={styles.buttonText}>{t('clubAdmin.sendInviteButton')}</Text>
              </TouchableOpacity>
            </LinearGradient>
            <TouchableOpacity
              style={[styles.mutedButton, { backgroundColor: colors.muted }]}
              onPress={() => setShowInviteModal(false)}
              accessibilityLabel={t('clubAdmin.cancelInviteLabel')}
            >
              <Text style={styles.buttonText}>{t('clubAdmin.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Role Update Modal */}
      <Modal visible={showRoleModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('clubAdmin.selectNewRole')}</Text>
            <RNPicker
              selectedValue={selectedNewRole}
              onValueChange={setSelectedNewRole}
              style={styles.picker}
              accessibilityLabel={t('clubAdmin.selectNewRoleLabel')}
            >
              {possibleRoles.map((role) => (
                <RNPicker.Item key={role} label={t(`clubAdmin.${role}Role`)} value={role} />
              ))}
            </RNPicker>
            <LinearGradient colors={['#5C9EAD', '#4A8A9D']} style={styles.buttonGradient}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => handleUpdateRole(selectedUserId, selectedNewRole)}
                accessibilityLabel={t('clubAdmin.confirmRoleChangeLabel')}
              >
                <Text style={styles.buttonText}>{t('clubAdmin.confirmButton')}</Text>
              </TouchableOpacity>
            </LinearGradient>
            <TouchableOpacity
              style={[styles.mutedButton, { backgroundColor: colors.muted }]}
              onPress={() => setShowRoleModal(false)}
              accessibilityLabel={t('clubAdmin.cancelRoleChangeLabel')}
            >
              <Text style={styles.buttonText}>{t('clubAdmin.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Court Modal */}
      <Modal visible={showCourtModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingCourt ? t('clubAdmin.editCourtTitle') : t('clubAdmin.addCourtTitle')}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder={t('clubAdmin.courtNamePlaceholder')}
              value={courtName}
              onChangeText={setCourtName}
              accessibilityLabel={t('clubAdmin.courtNameLabelAcc')}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder={t('clubAdmin.surfaceTypePlaceholder')}
              value={surfaceType}
              onChangeText={setSurfaceType}
              accessibilityLabel={t('clubAdmin.surfaceTypeLabelAcc')}
            />
            <View style={styles.switchRow}>
              <Text style={{ color: colors.text }}>{t('clubAdmin.floodlightsLabel')}</Text>
              <Switch
                value={hasFloodlights}
                onValueChange={setHasFloodlights}
                accessibilityLabel={t('clubAdmin.toggleFloodlightsLabel')}
              />
            </View>
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
            <LinearGradient colors={['#5C9EAD', '#4A8A9D']} style={styles.buttonGradient}>
              <TouchableOpacity
                style={styles.button}
                onPress={handleSaveCourt}
                accessibilityLabel={editingCourt ? t('clubAdmin.saveCourtLabel') : t('clubAdmin.addCourtLabel')}
              >
                <Text style={styles.buttonText}>{t('clubAdmin.save')}</Text>
              </TouchableOpacity>
            </LinearGradient>
            <TouchableOpacity
              style={[styles.mutedButton, { backgroundColor: colors.muted }]}
              onPress={() => setShowCourtModal(false)}
              accessibilityLabel={t('clubAdmin.cancelCourtChangesLabel')}
            >
              <Text style={styles.buttonText}>{t('clubAdmin.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Recurring Event Modal */}
      <Modal visible={showRecurringModal} transparent animationType="fade">
        <SafeAreaView style={styles.container}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Animatable.View animation="fadeInUp" duration={300}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('clubAdmin.createRecurring')}</Text>
              <Text style={[styles.modalSubtitle, { color: colors.muted }]}>{t('clubAdmin.recurringEventSubtitle')}</Text>

              {recurringLoading ? (
                <ActivityIndicator size="large" color={COURT_BLUE} style={styles.loading} />
              ) : (
                <ScrollView contentContainerStyle={styles.modalScrollContent}>
                  {/* Description */}
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('clubAdmin.descriptionLabel')} *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                      placeholder={t('clubAdmin.descriptionPlaceholder')}
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      numberOfLines={3}
                      accessibilityLabel={t('clubAdmin.descriptionLabel')}
                    />
                  </View>

                  {/* Court Selection */}
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('clubAdmin.courtLabel')} *</Text>
                    <RNPicker
                      selectedValue={selectedCourtId}
                      onValueChange={(value) => {
                        const court = courts.find((c) => c.id === value);
                        setSelectedCourtId(value);
                        setSelectedCourtName(court ? court.name : '');
                      }}
                      style={[styles.picker, { backgroundColor: colors.surface }]}
                      accessibilityLabel={t('clubAdmin.selectCourtLabel')}
                    >
                      <RNPicker.Item label={t('clubAdmin.selectCourtPlaceholder')} value={null} />
                      {courts.map((court) => (
                        <RNPicker.Item
                          key={court.id}
                          label={court.name}
                          value={court.id}
                          accessibilityLabel={t('clubAdmin.selectCourtLabel', { name: court.name })}
                        />
                      ))}
                    </RNPicker>
                  </View>

                  {/* Weekdays Selection */}
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('clubAdmin.weekdaysLabel')} *</Text>
                    <View style={styles.weekdaysContainer}>
                      {weekdaysOptions.map((day) => (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.weekdayChip,
                            selectedWeekdays.includes(day)
                              ? { backgroundColor: ACE_GREEN }
                              : { backgroundColor: colors.muted },
                          ]}
                          onPress={() => toggleWeekday(day)}
                          accessibilityLabel={t('clubAdmin.toggleWeekdayLabel', { day })}
                          accessibilityHint={
                            selectedWeekdays.includes(day)
                              ? t('clubAdmin.deselectWeekdayHint')
                              : t('clubAdmin.selectWeekdayHint')
                          }
                        >
                          <Text
                            style={[
                              styles.weekdayText,
                              { color: selectedWeekdays.includes(day) ? WHITE_LINES : colors.text },
                            ]}
                          >
                            {day.substring(0, 3)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Date Range */}
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('clubAdmin.dateRange')} *</Text>
                    <View style={styles.dateRow}>
                      <TouchableOpacity
                        style={[styles.dateButton, { backgroundColor: colors.surface }]}
                        onPress={() => setShowStartDatePicker(true)}
                        accessibilityLabel={t('clubAdmin.selectStartDateLabel')}
                      >
                        <Text style={[styles.dateText, { color: colors.text }]}>
                          {startDate.toLocaleDateString()}
                        </Text>
                      </TouchableOpacity>
                      <Text style={[styles.dateSeparator, { color: colors.muted }]}>-</Text>
                      <TouchableOpacity
                        style={[styles.dateButton, { backgroundColor: colors.surface }]}
                        onPress={() => setShowEndDatePicker(true)}
                        accessibilityLabel={t('clubAdmin.selectEndDateLabel')}
                      >
                        <Text style={[styles.dateText, { color: colors.text }]}>
                          {endDate.toLocaleDateString()}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Time Range */}
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('clubAdmin.timeRange')} *</Text>
                    <View style={styles.dateRow}>
                      <TouchableOpacity
                        style={[styles.dateButton, { backgroundColor: colors.surface }]}
                        onPress={() => setShowStartTimePicker(true)}
                        accessibilityLabel={t('clubAdmin.selectStartTimeLabel')}
                      >
                        <Text style={[styles.dateText, { color: colors.text }]}>
                          {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                      <Text style={[styles.dateSeparator, { color: colors.muted }]}>-</Text>
                      <TouchableOpacity
                        style={[styles.dateButton, { backgroundColor: colors.surface }]}
                        onPress={() => setShowEndTimePicker(true)}
                        accessibilityLabel={t('clubAdmin.selectEndTimeLabel')}
                      >
                        <Text style={[styles.dateText, { color: colors.text }]}>
                          {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Date/Time Pickers */}
                  {showStartDatePicker && (
                    <DateTimePicker
                      value={startDate}
                      mode="date"
                      display="default"
                      onChange={(event, date) => {
                        if (date) setStartDate(date);
                        setShowStartDatePicker(false);
                      }}
                      style={styles.datePicker}
                    />
                  )}
                  {showEndDatePicker && (
                    <DateTimePicker
                      value={endDate}
                      mode="date"
                      display="default"
                      onChange={(event, date) => {
                        if (date) setEndDate(date);
                        setShowEndDatePicker(false);
                      }}
                      style={styles.datePicker}
                    />
                  )}
                  {showStartTimePicker && (
                    <DateTimePicker
                      value={startTime}
                      mode="time"
                      display="default"
                      onChange={(event, date) => {
                        if (date) setStartTime(date);
                        setShowStartTimePicker(false);
                      }}
                      style={styles.datePicker}
                    />
                  )}
                  {showEndTimePicker && (
                    <DateTimePicker
                      value={endTime}
                      mode="time"
                      display="default"
                      onChange={(event, date) => {
                        if (date) setEndTime(date);
                        setShowEndTimePicker(false);
                      }}
                      style={styles.datePicker}
                    />
                  )}

                  {/* Action Buttons */}
                  <LinearGradient colors={['#4CAF50', '#3B9E40']} style={styles.buttonGradient}>
                    <TouchableOpacity
                      style={[styles.button, !isFormValid() && { opacity: 0.5 }]}
                      onPress={handleCreateRecurring}
                      disabled={!isFormValid() || recurringLoading}
                      accessibilityLabel={t('clubAdmin.createRecurringEventLabel')}
                      accessibilityHint={isFormValid() ? t('clubAdmin.createHint') : t('clubAdmin.createDisabledHint')}
                    >
                      {recurringLoading ? (
                        <ActivityIndicator size="small" color={WHITE_LINES} />
                      ) : (
                        <Text style={styles.buttonText}>{t('clubAdmin.createRecurring')}</Text>
                      )}
                    </TouchableOpacity>
                  </LinearGradient>
                  <TouchableOpacity
                    style={[styles.mutedButton, { backgroundColor: colors.muted }]}
                    onPress={() => setShowRecurringModal(false)}
                    accessibilityLabel={t('clubAdmin.cancel')}
                  >
                    <Text style={styles.buttonText}>{t('clubAdmin.cancel')}</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </Animatable.View>
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

// Styles
const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 100 },
  overviewContainer: { marginBottom: 24 },
  mainHeader: { fontSize: 28, fontFamily: 'Inter-Bold', marginBottom: 16 },
  sectionHeader: { fontSize: 20, fontFamily: 'Inter-Bold', marginBottom: 8 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 12 },
  metricCard: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flex: 1,
    marginHorizontal: 8,
  },
  metricValue: { fontSize: 24, fontFamily: 'Inter-Bold', marginTop: 8, textAlign: 'center', numberOfLines: 1, ellipsizeMode: 'tail' },
  metricLabel: { fontSize: 14, fontFamily: 'Inter-Regular', textAlign: 'center', numberOfLines: 1, ellipsizeMode: 'tail' },
  section: { marginVertical: 12 },
  sectionToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
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
    shadowRadius: 4,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  userName: { flex: 1, marginLeft: 8, fontFamily: 'Inter-Medium', fontSize: 16 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  roleText: { color: WHITE_LINES, fontSize: 12, fontFamily: 'Inter-SemiBold' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 16 },
  buttonGradient: { borderRadius: 12, overflow: 'hidden', marginVertical: 12 },
  button: {
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  mutedButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 12,
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
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '95%',
    maxHeight: Dimensions.get('window').height * 0.8,
    padding: 16,
    borderRadius: 20,
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  modalScrollContent: { paddingBottom: 30 },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginBottom: 12,
    textAlign: 'center',
    color: NET_DARK,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    marginBottom: 8,
  },
  weekdaysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekdayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  dateSeparator: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
  picker: {
    backgroundColor: WHITE_LINES,
    borderRadius: 8,
    marginBottom: 12,
  },
  participantItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  checkIcon: {
    marginLeft: 8,
  },
  courtItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 12,
  },
  datePicker: {
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  loading: {
    marginVertical: 20,
  },
});

export default ClubAdminScreen;