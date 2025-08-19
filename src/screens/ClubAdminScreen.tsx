// ClubAdminScreen.tsx
import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
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
  Pressable,
} from 'react-native';
import { Picker as RNPicker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../App';
import api, { getClubCourts, getClubSettings, getClubMembers, updateClubSettings, searchPotentialMembers, addUserToClub, inviteUserToClub, approveClubMember, rejectClubMember, removeUserFromClub, updateUserRole, saveCourt, deleteCourt, getClubRecurringEvents, deleteRecurringEvent } from '../api/api';
import { RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import * as Animatable from 'react-native-animatable';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import RecurringEventModal from '../components/RecurringEventModal';
import { COLORS, SPACING } from '../constants/colors';

const { width, height } = Dimensions.get('window');

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

interface RecurrenceJson {
  days: number[];
  start_date?: string;
  end_date?: string;
}

interface RecurringEventItem {
  id: number;
  court_id: number;
  court_name?: string;
  start_time_daily: string;
  end_time_daily: string;
  recurrence_json?: RecurrenceJson;
  recurrence?: RecurrenceJson;
  description: string;
  start_date?: string;
  end_date?: string;
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
  const [recurringEvents, setRecurringEvents] = useState<RecurringEventItem[]>([]);
  const [editingRecurring, setEditingRecurring] = useState<RecurringEventItem | null>(null);
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

  const possibleRoles = ['member', 'admin', 'coach', 'team_captain'];

  const roleColors = {
    member: COLORS.grayMedium,
    admin: COLORS.courtBlue,
    coach: COLORS.aceGreen,
    team_captain: COLORS.warningYellow,
    unknown: COLORS.disabled,
  };

  const weekdayLabels = [t('clubAdmin.sunday'), t('clubAdmin.monday'), t('clubAdmin.tuesday'), t('clubAdmin.wednesday'), t('clubAdmin.thursday'), t('clubAdmin.friday'), t('clubAdmin.saturday')];

  const styles = createStyles(colors);

  // Haptic feedback helper
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    const hapticOptions = {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    };
    
    switch(type) {
      case 'medium':
        ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
        break;
      case 'heavy':
        ReactNativeHapticFeedback.trigger('impactHeavy', hapticOptions);
        break;
      default:
        ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    }
  };

  // Fetch data function
  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [settings, members, clubCourts, recurring] = await Promise.all([
        getClubSettings(clubId),
        getClubMembers(clubId),
        getClubCourts(clubId),
        getClubRecurringEvents(clubId),
      ]);
      setMaxBookings(settings.max_bookings_allowed.toString());
      setUsers(members);
      setFilteredUsers(members);
      setCourts(clubCourts);
      setRecurringEvents(recurring);
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

  const fetchRecurringEvents = useCallback(async () => {
    try {
      setLoading(true);
      const events = await getClubRecurringEvents(clubId);
      setRecurringEvents(events.map((event: any) => {
        const recurrenceJson = event.recurrence_json || {};
        const recurrence = typeof recurrenceJson === 'string' 
          ? JSON.parse(recurrenceJson) 
          : recurrenceJson;
        
        recurrence.days = (recurrence.days || []).map(Number).filter(isFinite).filter(d => d >= 0 && d < 7).sort((a, b) => a - b);
        
        return {
          ...event,
          recurrence_json: recurrenceJson,
          recurrence,
          court_name: courts.find(c => c.id === event.court_id)?.name,
        };
      }));
    } catch (error) {
      console.error('Failed to fetch recurring events:', error);
      Toast.show({ type: 'error', text1: t('clubAdmin.fetchEventsError') });
    } finally {
      setLoading(false);
    }
  }, [clubId, courts, t]);

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

  // Toggle expandable sections with haptic
  const toggleSection = (sectionKey: string) => {
    triggerHaptic('light');
    setExpandedSection(expandedSection === sectionKey ? null : sectionKey);
  };

  // Single FlatList data for sections
  const sections = [
    { key: 'settings', title: t('clubAdmin.settings'), icon: 'settings' },
    { key: 'members', title: t('clubAdmin.members'), icon: 'people' },
    { key: 'courts', title: t('clubAdmin.courts'), icon: 'sports-tennis' },
    { key: 'recurring', title: t('clubAdmin.recurringEvents'), icon: 'event-repeat' },
  ];

  // Render section item
  const renderSection = ({ item }: { item: { key: string; title: string; icon: string } }) => {
    const isExpanded = expandedSection === item.key;
    let content = null;

    switch (item.key) {
      case 'settings':
        content = (
          <Animatable.View animation="fadeInUp" duration={400} style={styles.sectionContent}>
            <View style={styles.inputContainer}>
              <Icon name="confirmation-number" size={20} color={COLORS.grayMedium} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t('clubAdmin.maxBookingsPlaceholder')}
                placeholderTextColor={COLORS.grayMedium}
                value={maxBookings}
                onChangeText={setMaxBookings}
                keyboardType="numeric"
                accessibilityLabel={t('clubAdmin.maxBookingsPlaceholder')}
              />
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed
              ]}
              onPress={() => {
                triggerHaptic('medium');
                handleUpdateSettings();
              }}
              disabled={settingsLoading}
              accessibilityLabel={t('clubAdmin.saveSettings')}
            >
              {settingsLoading ? (
                <ActivityIndicator size="small" color={COLORS.whiteLines} />
              ) : (
                <>
                  <Icon name="save" size={20} color={COLORS.whiteLines} style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>{t('clubAdmin.saveSettings')}</Text>
                </>
              )}
            </Pressable>
          </Animatable.View>
        );
        break;
      case 'members':
        content = (
          <Animatable.View animation="fadeInUp" duration={400} style={styles.sectionContent}>
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Icon name="search" size={20} color={COLORS.grayMedium} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder={t('clubAdmin.searchUsersPlaceholder')}
                  placeholderTextColor={COLORS.grayMedium}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  accessibilityLabel={t('clubAdmin.searchUsersLabel')}
                />
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.filterButton,
                  pressed && styles.filterButtonPressed
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  setShowFilterModal(true);
                }}
                accessibilityLabel={t('clubAdmin.openFilterSettingsLabel')}
              >
                <Icon name="filter-list" size={24} color={COLORS.courtBlue} />
              </Pressable>
            </View>
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id?.toString() || ''}
              renderItem={({ item }) => <UserCard item={item} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Icon name="person-off" size={48} color={COLORS.grayMedium} />
                  <Text style={styles.emptyText}>{t('clubAdmin.noUsersFound')}</Text>
                </View>
              }
              scrollEnabled={false}
            />
            <Pressable
              style={({ pressed }) => [
                styles.successButton,
                pressed && styles.buttonPressed
              ]}
              onPress={() => {
                triggerHaptic('medium');
                setShowInviteModal(true);
              }}
              accessibilityLabel={t('clubAdmin.inviteNewUserLabel')}
            >
              <Icon name="person-add" size={20} color={COLORS.whiteLines} style={styles.buttonIcon} />
              <Text style={styles.buttonText}>{t('clubAdmin.inviteNewUser')}</Text>
            </Pressable>
          </Animatable.View>
        );
        break;
      case 'courts':
        content = (
          <Animatable.View animation="fadeInUp" duration={400} style={styles.sectionContent}>
            <FlatList
              data={courts}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => <CourtCard item={item} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Icon name="sports-tennis" size={48} color={COLORS.grayMedium} />
                  <Text style={styles.emptyText}>{t('clubAdmin.noCourtsFound')}</Text>
                </View>
              }
              scrollEnabled={false}
            />
            <Pressable
              style={({ pressed }) => [
                styles.successButton,
                pressed && styles.buttonPressed
              ]}
              onPress={() => {
                triggerHaptic('medium');
                setEditingCourt(null);
                setCourtName('');
                setSurfaceType('');
                setHasFloodlights(false);
                setCourtSeason('all_year');
                setShowCourtModal(true);
              }}
              accessibilityLabel={t('clubAdmin.addNewCourtLabel')}
            >
              <Icon name="add-circle" size={20} color={COLORS.whiteLines} style={styles.buttonIcon} />
              <Text style={styles.buttonText}>{t('clubAdmin.addCourt')}</Text>
            </Pressable>
          </Animatable.View>
        );
        break;
      case 'recurring':
        content = (
          <Animatable.View animation="fadeInUp" duration={400} style={styles.sectionContent}>
            <FlatList
              data={recurringEvents}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <RecurringCard 
                  item={item} 
                  onEdit={() => {
                    triggerHaptic('light');
                    setEditingRecurring(item);
                    setShowRecurringModal(true);
                  }} 
                  onDelete={() => {
                    triggerHaptic('medium');
                    handleDeleteRecurring(item.id);
                  }} 
                />
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Icon name="event-busy" size={48} color={COLORS.grayMedium} />
                  <Text style={styles.emptyText}>{t('clubAdmin.noRecurringEvents')}</Text>
                </View>
              }
              scrollEnabled={false}
            />
            <Pressable
              style={({ pressed }) => [
                styles.successButton,
                pressed && styles.buttonPressed
              ]}
              onPress={() => {
                triggerHaptic('medium');
                setEditingRecurring(null);
                setShowRecurringModal(true);
              }}
              accessibilityLabel={t('clubAdmin.createRecurringEventLabel')}
            >
              <Icon name="event-repeat" size={20} color={COLORS.whiteLines} style={styles.buttonIcon} />
              <Text style={styles.buttonText}>{t('clubAdmin.createRecurring')}</Text>
            </Pressable>
          </Animatable.View>
        );
        break;
    }

    return (
      <Animatable.View 
        animation="fadeInUp" 
        duration={300} 
        delay={item.key === 'settings' ? 0 : item.key === 'members' ? 100 : item.key === 'courts' ? 200 : 300}
        style={styles.section}
      >
        <Pressable 
          onPress={() => toggleSection(item.key)} 
          style={({ pressed }) => [
            styles.sectionHeader,
            isExpanded && styles.sectionHeaderExpanded,
            pressed && styles.sectionHeaderPressed
          ]}
        >
          <View style={styles.sectionHeaderLeft}>
            <View style={[styles.sectionIconContainer, isExpanded && styles.sectionIconExpanded]}>
              <Icon name={item.icon} size={24} color={isExpanded ? COLORS.whiteLines : COLORS.courtBlue} />
            </View>
            <Text style={[styles.sectionTitle, isExpanded && styles.sectionTitleExpanded]}>{item.title}</Text>
          </View>
          <Icon 
            name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
            size={24} 
            color={isExpanded ? COLORS.courtBlue : COLORS.grayMedium} 
          />
        </Pressable>
        {isExpanded && content}
      </Animatable.View>
    );
  };

  // Overview as ListHeaderComponent
  const renderHeader = () => (
    <Animatable.View animation="fadeIn" duration={800} style={styles.headerContainer}>
      <Text style={styles.screenTitle}>{t('clubAdmin.overview')}</Text>
      <View style={styles.metricsContainer}>
        <MetricCard 
          icon="people" 
          label={t('clubAdmin.members')} 
          value={overviewMetrics.members} 
          color={COLORS.courtBlue}
          onPress={() => toggleSection('members')} 
        />
        <MetricCard 
          icon="sports-tennis" 
          label={t('clubAdmin.courts')} 
          value={overviewMetrics.courts} 
          color={COLORS.aceGreen}
          onPress={() => toggleSection('courts')} 
        />
        <MetricCard 
          icon="calendar-today" 
          label={t('clubAdmin.bookings')} 
          value={overviewMetrics.bookings} 
          color={COLORS.warningYellow}
          onPress={() => {}} 
        />
      </View>
    </Animatable.View>
  );

  // Reusable Metric Card
  const MetricCard = ({ icon, label, value, color, onPress }: { icon: string; label: string; value: number; color: string; onPress: () => void }) => (
    <Pressable 
      style={({ pressed }) => [
        styles.metricCard,
        pressed && styles.metricCardPressed
      ]} 
      onPress={() => {
        triggerHaptic('light');
        onPress();
      }}
    >
      <View style={[styles.metricIconContainer, { backgroundColor: color + '20' }]}>
        <Icon name={icon} size={28} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={1} ellipsizeMode="tail">{label}</Text>
    </Pressable>
  );

  // User Card Component
  const UserCard = memo(({ item }: { item: UserItem }) => (
    <Animatable.View animation="fadeInRight" duration={400}>
      <Pressable 
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.userAvatar}>
            <Text style={styles.avatarText}>
              {item.firstName[0]}{item.lastName[0]}
            </Text>
          </View>
          <View style={styles.userInfoContainer}>
            <Text style={styles.userName}>{`${item.firstName} ${item.lastName}`}</Text>
            <View style={styles.userMeta}>
              <View style={[styles.roleBadge, { backgroundColor: (roleColors[item.role] || COLORS.disabled) + '20' }]}>
                <Text style={[styles.roleText, { color: roleColors[item.role] || COLORS.disabled }]}>
                  {item.role}
                </Text>
              </View>
              {item.status === 'pending' && (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{t('clubAdmin.pending')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={styles.cardActions}>
          {item.status === 'pending' && (
            <>
              <Pressable 
                onPress={() => {
                  triggerHaptic('medium');
                  handleApproveMember(item.id);
                }}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.approveButton,
                  pressed && styles.actionButtonPressed
                ]}
              >
                <Icon name="check" size={20} color={COLORS.aceGreen} />
              </Pressable>
              <Pressable 
                onPress={() => {
                  triggerHaptic('medium');
                  handleRejectMember(item.id);
                }}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.rejectButton,
                  pressed && styles.actionButtonPressed
                ]}
              >
                <Icon name="close" size={20} color={COLORS.error} />
              </Pressable>
            </>
          )}
          <Pressable 
            onPress={() => {
              triggerHaptic('light');
              setSelectedUserId(item.id); 
              setSelectedNewRole(item.role); 
              setShowRoleModal(true);
            }}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed
            ]}
          >
            <Icon name="edit" size={20} color={COLORS.courtBlue} />
          </Pressable>
          <Pressable 
            onPress={() => {
              triggerHaptic('heavy');
              handleRemoveUser(item.id);
            }}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed
            ]}
          >
            <Icon name="delete-outline" size={20} color={COLORS.error} />
          </Pressable>
        </View>
      </Pressable>
    </Animatable.View>
  ));

  // Court Card Component
  const CourtCard = memo(({ item }: { item: CourtItem }) => (
    <Animatable.View animation="fadeInRight" duration={400}>
      <Pressable 
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed
        ]}
      >
        <View style={styles.courtInfo}>
          <View style={styles.courtIconContainer}>
            <Icon name="sports-tennis" size={24} color={COLORS.aceGreen} />
          </View>
          <View style={styles.courtDetails}>
            <Text style={styles.courtName}>{item.name}</Text>
            <View style={styles.courtMeta}>
              <View style={styles.courtFeature}>
                <Icon name="landscape" size={14} color={COLORS.grayMedium} />
                <Text style={styles.courtFeatureText}>{item.surface_type || 'Unknown'}</Text>
              </View>
              {item.has_floodlights && (
                <View style={styles.courtFeature}>
                  <Icon name="lightbulb" size={14} color={COLORS.warningYellow} />
                  <Text style={styles.courtFeatureText}>Lights</Text>
                </View>
              )}
              <View style={styles.courtFeature}>
                <Icon name="calendar-today" size={14} color={COLORS.grayMedium} />
                <Text style={styles.courtFeatureText}>{item.season}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.cardActions}>
          <Pressable 
            onPress={() => {
              triggerHaptic('light');
              setEditingCourt(item);
              setCourtName(item.name);
              setSurfaceType(item.surface_type || '');
              setHasFloodlights(item.has_floodlights);
              setCourtSeason(item.season);
              setShowCourtModal(true);
            }}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed
            ]}
          >
            <Icon name="edit" size={20} color={COLORS.courtBlue} />
          </Pressable>
          <Pressable 
            onPress={() => {
              triggerHaptic('heavy');
              handleDeleteCourt(item.id);
            }}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed
            ]}
          >
            <Icon name="delete-outline" size={20} color={COLORS.error} />
          </Pressable>
        </View>
      </Pressable>
    </Animatable.View>
  ));

  // Recurring Card Component
  const RecurringCard = memo(({ item, onEdit, onDelete }: { item: RecurringEventItem, onEdit: () => void, onDelete: () => void }) => {
    let rec = item.recurrence || item.recurrence_json;
    if (typeof rec === 'string') {
      try {
        rec = JSON.parse(rec);
      } catch (e) {
        console.error('Failed to parse recurrence:', e);
        rec = { days: [] };
      }
    }
    const daysList = rec?.days || [];
    const days = daysList
      .sort((a: number | string, b: number | string) => {
        const numA = typeof a === 'string' ? weekdayLabels.findIndex(label => label.toLowerCase() === a.toLowerCase()) : a;
        const numB = typeof b === 'string' ? weekdayLabels.findIndex(label => label.toLowerCase() === b.toLowerCase()) : b;
        return numA - numB;
      })
      .map((d: number | string) => {
        if (typeof d === 'string') {
          const idx = weekdayLabels.findIndex(label => label.toLowerCase() === d.toLowerCase());
          return weekdayLabels[idx]?.substring(0, 3) || d.substring(0, 3);
        } else {
          return weekdayLabels[d]?.substring(0, 3) || '';
        }
      })
      .filter(Boolean)
      .join(', ') || t('clubAdmin.noDays');
    
    return (
      <Animatable.View animation="fadeInRight" duration={400}>
        <Pressable 
          style={({ pressed }) => [
            styles.card,
            pressed && styles.cardPressed
          ]}
        >
          <View style={styles.recurringInfo}>
            <View style={styles.recurringIconContainer}>
              <Icon name="event-repeat" size={24} color={COLORS.courtBlue} />
            </View>
            <View style={styles.recurringDetails}>
              <Text style={styles.recurringTitle}>{item.description}</Text>
              <View style={styles.recurringMeta}>
                <View style={styles.recurringMetaItem}>
                  <Icon name="sports-tennis" size={14} color={COLORS.grayMedium} />
                  <Text style={styles.recurringMetaText}>{item.court_name || `Court ${item.court_id}`}</Text>
                </View>
                <View style={styles.recurringMetaItem}>
                  <Icon name="schedule" size={14} color={COLORS.grayMedium} />
                  <Text style={styles.recurringMetaText}>{formatToCEST(item.start_time_daily)} - {formatToCEST(item.end_time_daily)}</Text>
                </View>
              </View>
              <View style={styles.recurringDays}>
                <Text style={styles.recurringDaysLabel}>Days: </Text>
                <Text style={styles.recurringDaysText}>{days}</Text>
              </View>
            </View>
          </View>
          <View style={styles.cardActions}>
            <Pressable 
              onPress={onEdit}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed
              ]}
            >
              <Icon name="edit" size={20} color={COLORS.courtBlue} />
            </Pressable>
            <Pressable 
              onPress={onDelete}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed
              ]}
            >
              <Icon name="delete-outline" size={20} color={COLORS.error} />
            </Pressable>
          </View>
        </Pressable>
      </Animatable.View>
    );
  });

  // Handlers
  const handleUpdateSettings = async () => {
    setSettingsLoading(true);
    try {
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
    triggerHaptic('medium');
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
    triggerHaptic('medium');
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
    triggerHaptic('medium');
    try {
      await updateUserRole(clubId, userId, newRole);
      Toast.show({ type: 'success', text1: t('clubAdmin.roleUpdated') });
      setShowRoleModal(false);
      fetchData();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('clubAdmin.roleUpdateError') });
    }
  };

  const handleSaveCourt = async () => {
    triggerHaptic('medium');
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

  const handleDeleteRecurring = async (id: number) => {
    Alert.alert(t('clubAdmin.confirmDeleteRecurring'), t('clubAdmin.deleteRecurringWarning'), [
      { text: t('clubAdmin.cancel'), style: 'cancel' },
      {
        text: t('clubAdmin.delete'),
        onPress: async () => {
          try {
            await deleteRecurringEvent(id);
            Toast.show({ type: 'success', text1: t('clubAdmin.recurringDeleted') });
            fetchData();
          } catch (error) {
            Toast.show({ type: 'error', text1: t('clubAdmin.deleteRecurringError') });
          }
        },
      },
    ]);
  };

  const handleApplyFilters = () => {
    triggerHaptic('light');
    setRoleFilter(tempRoleFilter);
    setSortBy(tempSortBy);
    setShowFilterModal(false);
  };

  const formatToCEST = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const utcDate = new Date(Date.UTC(2000, 0, 1, hours, minutes));
    return new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(utcDate);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.courtBlue} />
        <Text style={styles.loadingText}>{t('clubAdmin.loading')}</Text>
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
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={fetchData} 
              tintColor={COLORS.courtBlue} 
              title={t('clubAdmin.refreshing')} 
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </KeyboardAvoidingView>

      {/* Filter Modal */}
      <Modal visible={showFilterModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilterModal(false)}>
          <Animatable.View 
            animation="slideInUp" 
            duration={300}
            style={[styles.modalContent, { backgroundColor: colors.background }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('clubAdmin.filterModalTitle')}</Text>
            
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>{t('clubAdmin.roleFilter')}</Text>
              <View style={styles.pickerContainer}>
                <RNPicker
                  selectedValue={tempRoleFilter}
                  onValueChange={setTempRoleFilter}
                  style={styles.picker}
                  accessibilityLabel={t('clubAdmin.roleFilter')}
                >
                  <RNPicker.Item label={t('clubAdmin.allRoles')} value="All" />
                  <RNPicker.Item label={t('clubAdmin.adminRole')} value="admin" />
                  <RNPicker.Item label={t('clubAdmin.memberRole')} value="member" />
                  <RNPicker.Item label={t('clubAdmin.coachRole')} value="coach" />
                  <RNPicker.Item label={t('clubAdmin.teamCaptainRole')} value="team_captain" />
                </RNPicker>
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>{t('clubAdmin.sortBy')}</Text>
              <View style={styles.pickerContainer}>
                <RNPicker
                  selectedValue={tempSortBy}
                  onValueChange={setTempSortBy}
                  style={styles.picker}
                  accessibilityLabel={t('clubAdmin.sortBy')}
                >
                  <RNPicker.Item label={t('clubAdmin.sortByName')} value="name" />
                  <RNPicker.Item label={t('clubAdmin.sortByRole')} value="role" />
                </RNPicker>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalCancelButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  setShowFilterModal(false);
                }}
              >
                <Text style={styles.modalCancelText}>{t('clubAdmin.cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalConfirmButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={handleApplyFilters}
              >
                <Text style={styles.modalConfirmText}>{t('clubAdmin.applyButton')}</Text>
              </Pressable>
            </View>
          </Animatable.View>
        </Pressable>
      </Modal>

      {/* Add Existing User Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <Animatable.View 
            animation="slideInUp" 
            duration={300}
            style={[styles.modalContent, { backgroundColor: colors.background }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('clubAdmin.addExistingUser')}</Text>
            
            <View style={styles.inputContainer}>
              <Icon name="search" size={20} color={COLORS.grayMedium} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t('clubAdmin.searchUsersPlaceholder')}
                placeholderTextColor={COLORS.grayMedium}
                value={addSearch}
                onChangeText={handleSearchPotentialMembers}
                accessibilityLabel={t('clubAdmin.searchUsersToAddLabel')}
              />
            </View>
            
            <FlatList
              data={potentialMembers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.listItem,
                    pressed && styles.listItemPressed
                  ]}
                  onPress={() => handleAddUser(item.id)}
                  accessibilityLabel={t('clubAdmin.addUserLabel', { firstName: item.firstName, lastName: item.lastName })}
                >
                  <Text style={styles.listItemText}>{`${item.firstName} ${item.lastName}`}</Text>
                  <Icon name="add-circle-outline" size={20} color={COLORS.aceGreen} />
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>{t('clubAdmin.noUsersFound')}</Text>
                </View>
              }
              style={styles.modalList}
            />
            
            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalCancelButton,
                pressed && styles.buttonPressed
              ]}
              onPress={() => {
                triggerHaptic('light');
                setShowAddModal(false);
              }}
            >
              <Text style={styles.modalCancelText}>{t('clubAdmin.cancel')}</Text>
            </Pressable>
          </Animatable.View>
        </Pressable>
      </Modal>

      {/* Invite New User Modal */}
      <Modal visible={showInviteModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowInviteModal(false)}>
          <Animatable.View 
            animation="slideInUp" 
            duration={300}
            style={[styles.modalContent, { backgroundColor: colors.background }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('clubAdmin.inviteModalTitle')}</Text>
            
            <View style={styles.inputContainer}>
              <Icon name="email" size={20} color={COLORS.grayMedium} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t('clubAdmin.emailPlaceholder')}
                placeholderTextColor={COLORS.grayMedium}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                accessibilityLabel={t('clubAdmin.inviteEmailLabel')}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Icon name="person" size={20} color={COLORS.grayMedium} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t('clubAdmin.firstNamePlaceholder')}
                placeholderTextColor={COLORS.grayMedium}
                value={inviteFirstName}
                onChangeText={setInviteFirstName}
                accessibilityLabel={t('clubAdmin.inviteFirstNameLabel')}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Icon name="person" size={20} color={COLORS.grayMedium} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t('clubAdmin.lastNamePlaceholder')}
                placeholderTextColor={COLORS.grayMedium}
                value={inviteLastName}
                onChangeText={setInviteLastName}
                accessibilityLabel={t('clubAdmin.inviteLastNameLabel')}
              />
            </View>
            
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalCancelButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  setShowInviteModal(false);
                }}
              >
                <Text style={styles.modalCancelText}>{t('clubAdmin.cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalConfirmButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={handleInviteUser}
              >
                <Icon name="send" size={18} color={COLORS.whiteLines} style={styles.buttonIcon} />
                <Text style={styles.modalConfirmText}>{t('clubAdmin.sendInviteButton')}</Text>
              </Pressable>
            </View>
          </Animatable.View>
        </Pressable>
      </Modal>

      {/* Role Update Modal */}
      <Modal visible={showRoleModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowRoleModal(false)}>
          <Animatable.View 
            animation="slideInUp" 
            duration={300}
            style={[styles.modalContent, { backgroundColor: colors.background }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('clubAdmin.selectNewRole')}</Text>
            
            <View style={styles.pickerContainer}>
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
            </View>
            
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalCancelButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  setShowRoleModal(false);
                }}
              >
                <Text style={styles.modalCancelText}>{t('clubAdmin.cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalConfirmButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={() => handleUpdateRole(selectedUserId, selectedNewRole)}
              >
                <Text style={styles.modalConfirmText}>{t('clubAdmin.confirmButton')}</Text>
              </Pressable>
            </View>
          </Animatable.View>
        </Pressable>
      </Modal>

      {/* Court Modal */}
      <Modal visible={showCourtModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowCourtModal(false)}>
          <Animatable.View 
            animation="slideInUp" 
            duration={300}
            style={[styles.modalContent, { backgroundColor: colors.background }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editingCourt ? t('clubAdmin.editCourtTitle') : t('clubAdmin.addCourtTitle')}
            </Text>
            
            <View style={styles.inputContainer}>
              <Icon name="sports-tennis" size={20} color={COLORS.grayMedium} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t('clubAdmin.courtNamePlaceholder')}
                placeholderTextColor={COLORS.grayMedium}
                value={courtName}
                onChangeText={setCourtName}
                accessibilityLabel={t('clubAdmin.courtNameLabelAcc')}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Icon name="landscape" size={20} color={COLORS.grayMedium} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t('clubAdmin.surfaceTypePlaceholder')}
                placeholderTextColor={COLORS.grayMedium}
                value={surfaceType}
                onChangeText={setSurfaceType}
                accessibilityLabel={t('clubAdmin.surfaceTypeLabelAcc')}
              />
            </View>
            
            <View style={styles.switchContainer}>
              <View style={styles.switchLabel}>
                <Icon name="lightbulb" size={20} color={COLORS.warningYellow} />
                <Text style={styles.switchText}>{t('clubAdmin.floodlightsLabel')}</Text>
              </View>
              <Switch
                value={hasFloodlights}
                onValueChange={setHasFloodlights}
                trackColor={{ false: COLORS.grayBorder, true: COLORS.courtBlueLight }}
                thumbColor={hasFloodlights ? COLORS.courtBlue : COLORS.grayMedium}
                accessibilityLabel={t('clubAdmin.toggleFloodlightsLabel')}
              />
            </View>
            
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>{t('clubAdmin.seasonLabel')}</Text>
              <View style={styles.pickerContainer}>
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
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalCancelButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  setShowCourtModal(false);
                }}
              >
                <Text style={styles.modalCancelText}>{t('clubAdmin.cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalConfirmButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={handleSaveCourt}
              >
                <Icon name="save" size={18} color={COLORS.whiteLines} style={styles.buttonIcon} />
                <Text style={styles.modalConfirmText}>{t('clubAdmin.save')}</Text>
              </Pressable>
            </View>
          </Animatable.View>
        </Pressable>
      </Modal>

      {/* Recurring Event Modal */}
      <RecurringEventModal
        visible={showRecurringModal}
        onClose={() => {
          setShowRecurringModal(false);
          setEditingRecurring(null);
        }}
        courts={courts}
        editingEvent={editingRecurring}
      />

      <Animatable.View animation="bounceIn" delay={500}>
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            pressed && styles.fabPressed
          ]}
          onPress={() => {
            triggerHaptic('medium');
            setShowAddModal(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('clubAdmin.addExistingUserLabel')}
        >
          <Icon name="person-add" size={24} color={COLORS.whiteLines} />
        </Pressable>
      </Animatable.View>
    </SafeAreaView>
  );
};

// Enhanced Styles
const createStyles = (colors: any) => StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: COLORS.grayLight,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.grayLight,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.grayMedium,
    fontFamily: 'Inter-Regular',
  },
  listContent: { 
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 100,
  },
  
  // Header Section
  headerContainer: { 
    marginBottom: SPACING.xl,
  },
  screenTitle: { 
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
    marginBottom: SPACING.xl,
    letterSpacing: -0.5,
  },
  
  // Metrics
  metricsContainer: { 
    flexDirection: 'row',
    gap: SPACING.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.whiteLines,
    padding: SPACING.lg,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  metricCardPressed: {
    transform: [{ scale: 0.97 }],
    shadowOpacity: 0.05,
  },
  metricIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  metricValue: { 
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
    marginBottom: SPACING.xs,
  },
  metricLabel: { 
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: COLORS.grayMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Sections
  section: { 
    marginBottom: SPACING.lg,
  },
  sectionHeader: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.whiteLines,
    padding: SPACING.lg,
    borderRadius: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeaderExpanded: {
    backgroundColor: COLORS.courtBlueLight,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sectionHeaderPressed: {
    transform: [{ scale: 0.99 }],
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.courtBlueLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  sectionIconExpanded: {
    backgroundColor: COLORS.courtBlue,
  },
  sectionTitle: { 
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.netDark,
  },
  sectionTitleExpanded: {
    color: COLORS.courtBlue,
  },
  sectionContent: {
    backgroundColor: COLORS.whiteLines,
    padding: SPACING.lg,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  
  // Search and Filter
  searchContainer: { 
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grayLight,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
  },
  filterButton: { 
    backgroundColor: COLORS.courtBlueLight,
    padding: SPACING.md,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.courtBlue,
  },
  filterButtonPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: COLORS.courtBlue + '20',
  },
  
  // Input styles
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grayLight,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
  },
  
  // Cards
  card: {
    backgroundColor: COLORS.whiteLines,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    backgroundColor: COLORS.grayLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  
  // User Card
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.courtBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    color: COLORS.whiteLines,
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  userInfoContainer: {
    flex: 1,
  },
  userName: { 
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.netDark,
    marginBottom: SPACING.xs,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  roleBadge: { 
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
  },
  roleText: { 
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: {
    backgroundColor: COLORS.warningYellow + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.warningYellow,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Court Card
  courtInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  courtIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.aceGreen + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  courtDetails: {
    flex: 1,
  },
  courtName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.netDark,
    marginBottom: SPACING.xs,
  },
  courtMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  courtFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  courtFeatureText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
  },
  
  // Recurring Card
  recurringInfo: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  recurringIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.courtBlueLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  recurringDetails: {
    flex: 1,
  },
  recurringTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.netDark,
    marginBottom: SPACING.xs,
  },
  recurringMeta: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  recurringMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  recurringMetaText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
  },
  recurringDays: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recurringDaysLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: COLORS.grayMedium,
  },
  recurringDaysText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.courtBlue,
  },
  
  // Card Actions
  cardActions: { 
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
  },
  actionButton: {
    padding: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.grayLight,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.9 }],
    backgroundColor: COLORS.grayBorder,
  },
  approveButton: {
    backgroundColor: COLORS.aceGreen + '20',
  },
  rejectButton: {
    backgroundColor: COLORS.error + '20',
  },
  
  // Buttons
  primaryButton: {
    backgroundColor: COLORS.courtBlue,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 12,
    marginTop: SPACING.sm,
    shadowColor: COLORS.courtBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  successButton: {
    backgroundColor: COLORS.aceGreen,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 12,
    marginTop: SPACING.md,
    shadowColor: COLORS.aceGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
    shadowOpacity: 0.1,
  },
  buttonIcon: {
    marginRight: SPACING.sm,
  },
  buttonText: { 
    color: COLORS.whiteLines,
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.xl,
    maxHeight: height * 0.9,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.grayBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  modalCancelButton: {
    backgroundColor: COLORS.grayLight,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  modalConfirmButton: {
    backgroundColor: COLORS.courtBlue,
    shadowColor: COLORS.courtBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  modalCancelText: {
    color: COLORS.grayMedium,
    fontFamily: 'Inter-Medium',
    fontSize: 15,
  },
  modalConfirmText: {
    color: COLORS.whiteLines,
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
  },
  modalList: {
    maxHeight: 200,
    marginVertical: SPACING.md,
  },
  
  // List Items
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 8,
    backgroundColor: COLORS.grayLight,
    marginBottom: SPACING.sm,
  },
  listItemPressed: {
    backgroundColor: COLORS.courtBlueLight,
  },
  listItemText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: COLORS.netDark,
  },
  
  // Filter & Picker
  filterSection: {
    marginBottom: SPACING.lg,
  },
  filterLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.grayMedium,
    marginBottom: SPACING.sm,
  },
  pickerContainer: {
    backgroundColor: COLORS.grayLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    overflow: 'hidden',
  },
  picker: {
    backgroundColor: 'transparent',
  },
  
  // Switch
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.grayLight,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  switchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  switchText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: COLORS.netDark,
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    marginTop: SPACING.md,
  },
  
  // FAB
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.courtBlue,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.courtBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  fabPressed: {
    transform: [{ scale: 0.93 }],
    shadowOpacity: 0.2,
  },
});

export default ClubAdminScreen;