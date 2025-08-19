import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  Switch, 
  SafeAreaView,
  StyleSheet,
  Animated,
  Platform,
  Dimensions,
  RefreshControl
} from 'react-native';
import { useTheme } from '../../App';
import { getUserBookings, getClubSettings, cancelBooking } from '../api/api';
import { format, isAfter } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING } from '../constants/colors';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Separate component for booking item to properly handle hooks
// Update the BookingItem component in BookingsScreen.tsx

const BookingItem = React.memo(({ 
  item, 
  index, 
  isEditable, 
  onEdit, 
  onCancel,
  formatToCEST,
  t,
  styles 
}: any) => {
  const isPastBooking = !isAfter(item.end_time, new Date());
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 400,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, [index]);

  const handleButtonPress = useCallback((callback: () => void) => {
    ReactNativeHapticFeedback.trigger('selection', hapticOptions);
    callback();
  }, []);

  // Combine booker and participants into a single list of players
  const allPlayers = useMemo(() => {
    const players = [];
    
    // Add the person who booked (they're playing too)
    if (item.booked_by) {
      players.push(item.booked_by);
    }
    
    // Add all participants
    if (item.participants && item.participants.length > 0) {
      players.push(...item.participants);
    }
    
    // Remove duplicates (in case booker is also in participants)
    return [...new Set(players)];
  }, [item.booked_by, item.participants]);

  return (
    <Animated.View 
      style={[
        styles.bookingCard,
        isPastBooking && styles.pastBookingCard,
        {
          opacity: animatedValue,
          transform: [
            {
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
            {
              scale: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.bookingHeader}>
        <View style={styles.courtBadge}>
          <Text style={styles.courtBadgeText}>
            {t('bookings.courtTitle', { courtId: item.court_id })}
          </Text>
        </View>
        {item.status === 'confirmed' && !isPastBooking && (
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{t('bookings.confirmed')}</Text>
          </View>
        )}
      </View>

      <View style={styles.bookingTimeContainer}>
        <Text style={styles.bookingTime}>
          {formatToCEST(item.start_time)}
        </Text>
      </View>

      {/* Show all players instead of just "Booked by" */}
      {item.type === 'regular' && allPlayers.length > 0 && (
        <View style={styles.playersContainer}>
          <View style={styles.playersHeader}>
            <Text style={styles.playersLabel}>
              {t('bookings.playersLabel')} ({allPlayers.length})
            </Text>
          </View>
          <View style={styles.playersList}>
            {allPlayers.map((player: string, idx: number) => (
              <View key={idx} style={styles.playerChip}>
                <View style={styles.playerAvatar}>
                  <Text style={styles.playerAvatarText}>
                    {player.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.playerText} numberOfLines={1}>
                  {player.trim()}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* For events, show the description */}
      {item.type === 'event' && item.description && (
        <View style={styles.eventContainer}>
          <Text style={styles.eventLabel}>{t('bookings.eventLabel')}</Text>
          <Text style={styles.eventDescription}>{item.description}</Text>
        </View>
      )}

      {!isPastBooking && item.status !== 'cancelled' && (
        <View style={styles.actionContainer}>
          {item.type === 'regular' && isEditable && (
            <TouchableOpacity 
              onPress={() => handleButtonPress(() => onEdit(item))} 
              style={styles.primaryButton}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('bookings.editBookingLabel')}
            >
              <Text style={styles.primaryButtonText}>{t('bookings.editButton')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            onPress={() => handleButtonPress(() => onCancel(item.id))} 
            style={styles.secondaryButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('bookings.cancelBookingLabel')}
          >
            <Text style={styles.secondaryButtonText}>{t('bookings.cancelButton')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
});

const BookingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user, isSuperAdmin, userClubs } = useAuth();
  const navigation = useNavigation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistoric, setShowHistoric] = useState(false);
  const [maxBookingsAllowed, setMaxBookingsAllowed] = useState(1);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const switchScaleAnim = useRef(new Animated.Value(1)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;

  const styles = useMemo(() => createStyles(colors), [colors]);

  // Check if user is admin at any club
  const isClubAdmin = useMemo(() => {
    return userClubs.some((club: any) => club.role === 'admin');
  }, [userClubs]);

  // Check if user has admin privileges (either superadmin or club admin)
  const hasAdminPrivileges = useMemo(() => {
    return isSuperAdmin || isClubAdmin;
  }, [isSuperAdmin, isClubAdmin]);

  const fetchMaxBookings = async () => {
    try {
      // Skip fetching max bookings for admins as they have no limit
      if (hasAdminPrivileges) {
        setMaxBookingsAllowed(Infinity);
        console.log('Admin user detected - setting unlimited bookings');
        return;
      }

      if (userClubs.length > 0) {
        const firstClubId = userClubs[0].id;
        const settings = await getClubSettings(firstClubId);
        console.log(settings)
        setMaxBookingsAllowed(settings.max_bookings_allowed || 1);
        console.log('Fetched max_bookings_allowed:', settings.max_bookings_allowed);
      } else {
        console.log('No clubs found for user');
      }
    } catch (error: any) {
      console.error('Fetch max bookings error:', error.response?.status, error.response?.data || error.message);
    }
  };

  const fetchBookings = async () => {
    try {
      const data = await getUserBookings();
      
      // First, let's log what types we're getting from the API
      console.log('Raw bookings from API:', data);
      console.log('Booking types received:', [...new Set(data.map((b: any) => b.type))]);
      
      let parsedBookings = data
        .filter((b: any) => b.status !== 'cancelled')
        .map((b: any) => ({
          ...b,
          start_time: new Date(b.start_time + (b.start_time.endsWith('Z') ? '' : 'Z')),
          end_time: new Date(b.end_time + (b.end_time.endsWith('Z') ? '' : 'Z')),
        }))
        .filter((b: any) => !isNaN(b.start_time.getTime()));

      // Filter out recurring bookings for admin users
      // Check for multiple possible type values that might indicate recurring bookings
      if (hasAdminPrivileges) {
        const beforeCount = parsedBookings.length;
        parsedBookings = parsedBookings.filter((b: any) => {
          // Filter out any booking type that might be recurring
          // This includes 'recurring', 'recurrent', 'repeated', etc.
          const isRecurring = b.type && (
            b.type.toLowerCase() === 'recurring' ||
            b.type.toLowerCase() === 'recurrent' ||
            b.type.toLowerCase() === 'repeated' ||
            b.type.toLowerCase() === 'event'
          );
          return !isRecurring;
        });
        const afterCount = parsedBookings.length;
        console.log(`Admin filter: Removed ${beforeCount - afterCount} recurring bookings`);
        console.log('Remaining booking types:', [...new Set(parsedBookings.map((b: any) => b.type))]);
      }

      setBookings(parsedBookings);
      console.log('Final parsed bookings:', parsedBookings);
      
      // Animate content in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 10,
          friction: 5,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error: any) {
      Alert.alert(t('bookings.errorTitle'), t('bookings.failedToLoadBookings'));
      console.error('Fetch bookings error:', error.response?.status, error.response?.data || error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    await Promise.all([fetchMaxBookings(), fetchBookings()]);
  }, [hasAdminPrivileges]);

  useFocusEffect(
    React.useCallback(() => {
      fetchMaxBookings();
      fetchBookings();
    }, [hasAdminPrivileges])
  );

  const handleCancel = useCallback(async (id: number) => {
    ReactNativeHapticFeedback.trigger('notificationWarning', hapticOptions);
    Alert.alert(t('bookings.confirmCancel'), t('bookings.cancelConfirmation'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('bookings.yesButton'),
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelBooking(id);
            ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
            Alert.alert(t('bookings.cancelSuccess'), t('bookings.bookingCancelled'));
            fetchBookings();
          } catch (error: any) {
            ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
            Alert.alert(t('bookings.errorTitle'), t('bookings.cancelFailed'));
            console.error('Cancel error:', error.response?.status, error.response?.data || error.message);
          }
        },
      },
    ]);
  }, [t]);

  const handleEdit = useCallback(async (item: any) => {
    const isEditable = item.user_id === user.id || isSuperAdmin || userClubs.some((c: any) => c.id === item.club_id && c.role === 'admin');
    if (!isEditable) {
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
      Alert.alert(t('bookings.permissionDenied'), t('bookings.editPermissionError'));
      return;
    }
    
    // Log the item to see its structure
    console.log('Editing booking item:', item);
    
    // Ensure the item has the necessary properties
    if (!item.start_time || !item.end_time) {
      console.error('Invalid booking item for editing:', item);
      Alert.alert(t('bookings.errorTitle'), t('bookings.invalidBookingData'));
      return;
    }
    
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    navigation.navigate('AdvancedBooking', { editBooking: item });
  }, [user, isSuperAdmin, userClubs, navigation, t]);

  const formatToCEST = useCallback((date: Date) => {
    if (isNaN(date.getTime())) {
      return t('bookings.invalidDate');
    }
    return new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }, [t]);

  const handleSwitchChange = useCallback(async (value: boolean) => {
    ReactNativeHapticFeedback.trigger('selection', hapticOptions);
    
    // Animate switch
    Animated.sequence([
      Animated.spring(switchScaleAnim, {
        toValue: 1.1,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(switchScaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
    
    setShowHistoric(value);
  }, [switchScaleAnim]);

  const handleBookCourtPress = useCallback(async () => {
    // Admins can always book, no need to check the limit
    if (!hasAdminPrivileges && hasReachedMax) return;
    
    ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
    
    // Animate button press
    Animated.sequence([
      Animated.spring(buttonScaleAnim, {
        toValue: 0.95,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
    
    navigation.navigate('AdvancedBooking');
  }, [hasAdminPrivileges, hasReachedMax, buttonScaleAnim, navigation]);

  const filteredBookings = useMemo(() => 
    bookings.filter((item: any) => {
      const endTime = item.end_time;
      return showHistoric || isAfter(endTime, new Date());
    }), [bookings, showHistoric]);

  const futureBookingsCount = useMemo(() => 
    bookings.filter((item: any) => isAfter(item.end_time, new Date())).length,
    [bookings]);
    
  console.log('Future bookings count:', futureBookingsCount);
  console.log('Max bookings allowed:', maxBookingsAllowed);
  console.log('Has admin privileges:', hasAdminPrivileges);
  
  // Admins never reach the max limit
  const hasReachedMax = !hasAdminPrivileges && futureBookingsCount >= maxBookingsAllowed;

  const renderBooking = useCallback(({ item, index }: { item: any; index: number }) => {
    const isEditable = item.user_id === user.id || isSuperAdmin || userClubs.some((c: any) => c.id === item.club_id && c.role === 'admin');
    
    return (
      <BookingItem
        item={item}
        index={index}
        isEditable={isEditable}
        onEdit={handleEdit}
        onCancel={handleCancel}
        formatToCEST={formatToCEST}
        t={t}
        styles={styles}
      />
    );
  }, [user, isSuperAdmin, userClubs, handleEdit, handleCancel, formatToCEST, t, styles]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.courtBlue} size="large" />
        <Text style={styles.loadingText}>{t('bookings.loading')}</Text>
      </View>
    );
  }

  const ListEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>{t('bookings.noBookings')}</Text>
      <Text style={styles.emptySubtitle}>{t('bookings.noBookingsDesc')}</Text>
    </View>
  );

  const ListHeaderComponent = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{t('bookings.title')}</Text>
        {futureBookingsCount > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{futureBookingsCount}</Text>
          </View>
        )}
      </View>
      
      <Animated.View style={[styles.filterCard, { transform: [{ scale: switchScaleAnim }] }]}>
        <View style={styles.filterContent}>
          <View>
            <Text style={styles.filterTitle}>{t('bookings.showHistoricLabel')}</Text>
            
          </View>
          <Switch
            value={showHistoric}
            onValueChange={handleSwitchChange}
            trackColor={{ false: COLORS.grayBorder, true: COLORS.courtBlue }}
            thumbColor={COLORS.whiteLines}
            ios_backgroundColor={COLORS.grayBorder}
            accessibilityLabel={t('bookings.showHistoricLabelAcc')}
          />
        </View>
      </Animated.View>

      {/* Only show warning for non-admin users */}
      {!hasAdminPrivileges && hasReachedMax && (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            {t('bookings.maxBookingsReached', { max: maxBookingsAllowed })}
          </Text>
        </View>
      )}
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <FlatList
          data={filteredBookings}
          renderItem={renderBooking}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={ListHeaderComponent}
          ListEmptyComponent={ListEmptyComponent}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.courtBlue}
              colors={[COLORS.courtBlue]}
            />
          }
        />
        
        <Animated.View style={[
          styles.floatingButtonContainer,
          { transform: [{ scale: buttonScaleAnim }] }
        ]}>
          <TouchableOpacity
            onPress={handleBookCourtPress}
            style={[
              styles.floatingButton,
              hasReachedMax && styles.floatingButtonDisabled
            ]}
            disabled={hasReachedMax}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={t('bookings.bookCourtLabel')}
          >
            <View style={styles.floatingButtonGradient}>
              <Text style={styles.floatingButtonText}>
                {hasReachedMax ? t('bookings.maxReached') : t('bookings.bookCourtButton')}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.grayLight,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.grayLight,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.grayMedium,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    color: COLORS.netDark,
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    letterSpacing: -0.5,
  },
  countBadge: {
    marginLeft: SPACING.md,
    backgroundColor: COLORS.courtBlue,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
  },
  countBadgeText: {
    color: COLORS.whiteLines,
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  filterCard: {
    backgroundColor: COLORS.whiteLines,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  filterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTitle: {
    color: COLORS.netDark,
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    marginBottom: SPACING.xs,
  },
  filterSubtitle: {
    color: COLORS.grayMedium,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  warningCard: {
    backgroundColor: COLORS.warningYellow,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  warningText: {
    color: COLORS.netDark,
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 120,
  },
  bookingCard: {
    backgroundColor: COLORS.whiteLines,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  pastBookingCard: {
    opacity: 0.7,
    backgroundColor: COLORS.grayLight,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  courtBadge: {
    backgroundColor: COLORS.courtBlueLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  courtBadgeText: {
    color: COLORS.courtBlue,
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.aceGreen + '15',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.aceGreen,
    marginRight: SPACING.xs,
  },
  statusText: {
    color: COLORS.aceGreen,
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  bookingTimeContainer: {
    marginBottom: SPACING.md,
  },
  bookingTime: {
    color: COLORS.netDark,
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
  },
  
  participantsContainer: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  participantsLabel: {
    color: COLORS.grayMedium,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    marginBottom: SPACING.sm,
  },
  participantsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  participantChip: {
    backgroundColor: COLORS.courtBlueLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
  },
  participantText: {
    color: COLORS.courtBlueDark,
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.courtBlue,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: COLORS.courtBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: COLORS.whiteLines,
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: SPACING.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.error,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.error,
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: SPACING.xxxl * 2,
  },
  emptyTitle: {
    color: COLORS.netDark,
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: COLORS.grayMedium,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.lg,
    right: SPACING.lg,
  },
  floatingButton: {
    overflow: 'hidden',
    borderRadius: 16,
    shadowColor: COLORS.courtBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  floatingButtonDisabled: {
    shadowColor: COLORS.grayMedium,
    shadowOpacity: 0.1,
  },
  floatingButtonGradient: {
    backgroundColor: COLORS.courtBlue,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  floatingButtonText: {
    color: COLORS.whiteLines,
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  playersContainer: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  playersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  playersLabel: {
    color: COLORS.grayMedium,
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.courtBlueLight,
    paddingLeft: SPACING.xs,
    paddingRight: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    minHeight: 32, // Add minimum height
    // Remove maxWidth: '48%' - this was cutting off the text
  },
  playerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.courtBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    flexShrink: 0, // Prevent avatar from shrinking
  },
  playerAvatarText: {
    color: COLORS.whiteLines,
    fontFamily: 'Inter-Bold',
    fontSize: 12,
  },
  playerText: {
    color: COLORS.courtBlueDark,
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    // Remove flex: 1 - not needed here
    flexShrink: 1, // Allow text to shrink if needed
    marginRight: SPACING.xs, // Add some margin to prevent text from touching the edge
  },
  eventContainer: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.softBeige,
    padding: SPACING.md,
    borderRadius: 8,
  },
  eventLabel: {
    color: COLORS.grayMedium,
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  eventDescription: {
    color: COLORS.netDark,
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
});

export default BookingsScreen;