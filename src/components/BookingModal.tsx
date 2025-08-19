import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Modal from 'react-native-modal';
import Animated, {
  SlideInDown,
  Layout,
  ZoomIn,
  withSpring,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  FadeIn,
} from 'react-native-reanimated';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/MaterialIcons';
import HapticFeedback from 'react-native-haptic-feedback';
import { addMinutes, isAfter, setHours, setMinutes as dateSetMinutes, startOfDay } from 'date-fns';
import { TFunction } from 'i18next';
import { COLORS, SPACING } from '../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Haptic feedback configurations
const HAPTICS = {
  light: { enableVibrateFallback: true, ignoreAndroidSystemSettings: false },
  medium: { enableVibrateFallback: true, ignoreAndroidSystemSettings: false },
  heavy: { enableVibrateFallback: true, ignoreAndroidSystemSettings: false },
};

export interface Member {
  id?: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  bookable: boolean;
  status: string;
  role: string;
}

interface TimeSlot {
  time: Date;
  available: boolean;
  label: string;
}

interface BookingModalProps {
  visible: boolean;
  onClose: () => void;
  courtName: string;
  courtId?: number;
  selectedStart: Date | null;
  duration: number;
  onChangeStart?: (date: Date) => void;
  formatToCEST: (date: Date) => string;
  currentUserName: string;
  userId: number | undefined;
  members: Member[];
  filteredMembers: Member[];
  memberSearch: string;
  onChangeMemberSearch: (text: string) => void;
  selectedParticipants: number[];
  onToggleParticipant: (member: Member) => void;
  onRemoveParticipant: (id: number) => void;
  onConfirm: () => void;
  selectedBooking?: any | null;
  bookings?: any[];
  t: TFunction;
}

// Animated components
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const BookingModal: React.FC<BookingModalProps> = ({
  visible,
  onClose,
  courtName,
  courtId,
  selectedStart,
  duration,
  onChangeStart,
  formatToCEST,
  currentUserName,
  userId,
  members,
  filteredMembers,
  memberSearch,
  onChangeMemberSearch,
  selectedParticipants,
  onToggleParticipant,
  onRemoveParticipant,
  onConfirm,
  selectedBooking,
  bookings = [],
  t,
}) => {
  // Animation values
  const scrollY = useSharedValue(0);
  const searchFocused = useSharedValue(0);
  const confirmButtonScale = useSharedValue(1);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);

  // Generate available time slots whenever we need to show the picker
  useEffect(() => {
    if (selectedStart && showTimePicker) {
      const slots: TimeSlot[] = [];
      const baseDate = startOfDay(selectedStart);
      
      // Generate slots from 8:00 to 21:00
      for (let hour = 8; hour <= 21; hour++) {
        for (let minutes of [0, 30]) {
          if (hour === 21 && minutes === 30) continue; // Skip 21:30
          
          const slotTime = dateSetMinutes(setHours(baseDate, hour), minutes);
          
          // Check if this time is in the past
          if (!isAfter(slotTime, new Date())) {
            continue;
          }
          
          // Check if this slot conflicts with existing bookings
          const slotEnd = addMinutes(slotTime, duration);
          const isAvailable = !bookings.some(booking => {
            // Skip the current booking being edited
            if (selectedBooking && booking.id === selectedBooking.id) {
              return false;
            }
            const bookingStart = new Date(booking.start_time);
            const bookingEnd = new Date(booking.end_time);
            return slotTime < bookingEnd && slotEnd > bookingStart;
          });
          
          slots.push({
            time: slotTime,
            available: isAvailable,
            label: formatToCEST(slotTime),
          });
        }
      }
      
      setAvailableSlots(slots);
    }
  }, [selectedStart, showTimePicker, bookings, duration, formatToCEST, selectedBooking]);

  // Computed values
  const end = useMemo(
    () => (selectedStart ? addMinutes(selectedStart, duration) : null),
    [selectedStart, duration]
  );

  const timeRange = useMemo(() => {
    if (!selectedStart) {
      return t('advancedBooking.selectTime') || 'Select time';
    }
    return `${formatToCEST(selectedStart)} – ${end ? formatToCEST(end) : ''}`;
  }, [selectedStart, end, formatToCEST, t]);

  const playersSelected = 1 + selectedParticipants.length;
  const playersShort = 
    (t('advancedBooking.playersCountShort', { count: playersSelected, max: 4 }) as string) ||
    `${playersSelected}/4 players`;

  const confirmDisabled = !selectedStart || selectedParticipants.length === 0;

  const dateLabel = useMemo(() => {
    if (!selectedStart) return t('advancedBooking.selectDate') || 'Select date';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(selectedStart);
  }, [selectedStart, t]);

  // Enhanced close handler with haptic feedback
  const handleClose = useCallback(() => {
    HapticFeedback.trigger('impactLight', HAPTICS.light);
    Keyboard.dismiss();
    setShowTimePicker(false);
    onClose();
  }, [onClose]);

  // Enhanced confirm handler with loading state
  const handleConfirm = useCallback(async () => {
    if (confirmDisabled || isConfirming) return;
    
    HapticFeedback.trigger('impactMedium', HAPTICS.medium);
    setIsConfirming(true);
    
    // Animate button press
    confirmButtonScale.value = withSpring(0.95, {}, () => {
      confirmButtonScale.value = withSpring(1);
    });
    
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  }, [confirmDisabled, isConfirming, onConfirm, confirmButtonScale]);

  // Enhanced participant toggle with haptic feedback
  const handleToggleParticipant = useCallback((member: Member) => {
    HapticFeedback.trigger('selection', HAPTICS.light);
    onToggleParticipant(member);
  }, [onToggleParticipant]);

  // Enhanced remove participant with haptic feedback
  const handleRemoveParticipant = useCallback((id: number) => {
    HapticFeedback.trigger('impactLight', HAPTICS.light);
    onRemoveParticipant(id);
  }, [onRemoveParticipant]);

  // Handle time change - directly toggle the picker
  const handleChangeTime = useCallback(() => {
    HapticFeedback.trigger('impactLight', HAPTICS.light);
    setShowTimePicker(!showTimePicker);
  }, [showTimePicker]);

  // Handle time slot selection - directly update the time
  const handleSelectTimeSlot = useCallback((slot: TimeSlot) => {
    if (!slot.available) {
      HapticFeedback.trigger('notificationError', HAPTICS.light);
      return;
    }
    
    HapticFeedback.trigger('impactMedium', HAPTICS.medium);
    if (onChangeStart) {
      onChangeStart(slot.time);
    }
    setShowTimePicker(false);
  }, [onChangeStart]);

  // Search focus animation
  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
    searchFocused.value = withSpring(1);
  }, [searchFocused]);

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
    searchFocused.value = withSpring(0);
  }, [searchFocused]);

  // Animated styles
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 50], [1, 0.8]),
    transform: [
      {
        translateY: interpolate(scrollY.value, [0, 100], [0, -20], 'clamp'),
      },
    ],
  }));

  const searchContainerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(searchFocused.value, [0, 1], [1, 1.02]),
      },
    ],
  }));

  const confirmButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: confirmButtonScale.value }],
  }));

  // Render time slot item
  const renderTimeSlot = useCallback(({ item, index }: { item: TimeSlot; index: number }) => {
    const isCurrentTime = selectedStart && item.time.getTime() === selectedStart.getTime();
    
    return (
      <Animated.View entering={FadeIn.delay(index * 20)}>
        <Pressable
          onPress={() => handleSelectTimeSlot(item)}
          disabled={!item.available}
          style={({ pressed }) => [
            styles.timeSlot,
            !item.available && styles.timeSlotDisabled,
            isCurrentTime && styles.timeSlotCurrent,
            pressed && item.available && styles.timeSlotPressed,
          ]}
        >
          <Text style={[
            styles.timeSlotText,
            !item.available && styles.timeSlotTextDisabled,
            isCurrentTime && styles.timeSlotTextCurrent,
          ]}>
            {item.label}
          </Text>
          {!item.available && (
            <Icon name="block" size={14} color={COLORS.grayMedium} />
          )}
          {isCurrentTime && (
            <Icon name="check-circle" size={14} color={COLORS.aceGreen} />
          )}
        </Pressable>
      </Animated.View>
    );
  }, [selectedStart, handleSelectTimeSlot]);

  // Render member item with enhanced animations
  const renderMemberItem = useCallback(({ item, index }: { item: Member; index: number }) => {
    if (item.id === Number(userId)) return null;
    
    const isUnregistered = !item.bookable || item.status !== 'approved';
    const isSelected = !!item.id && selectedParticipants.includes(item.id);
    const now = new Date();
    const isPast = !selectedStart ? false : !isAfter(selectedStart, now);
    const disabled = isUnregistered || isPast;
    
    const displayName = item.firstName && item.lastName 
      ? `${item.firstName} ${item.lastName}` 
      : item.email;

    return (
      <Animated.View
        entering={SlideInDown.delay(index * 30).springify()}
        layout={Layout.springify()}
      >
        <Pressable
          onPress={() => !disabled && handleToggleParticipant(item)}
          disabled={disabled}
          style={({ pressed }) => [
            styles.participantItem,
            isSelected && styles.participantItemSelected,
            pressed && !disabled && styles.participantItemPressed,
            disabled && styles.participantItemDisabled,
          ]}
        >
          <View style={[
            styles.avatar,
            isSelected && styles.avatarSelected,
            disabled && styles.avatarDisabled,
          ]}>
            <Text style={[
              styles.avatarText,
              isSelected && styles.avatarTextSelected
            ]}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.participantInfo}>
            <Text 
              style={[
                styles.participantName,
                disabled && styles.participantNameDisabled,
              ]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {isUnregistered && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {t('advancedBooking.pendingMember')}
                </Text>
              </View>
            )}
            {item.id && !item.bookable && item.status === 'approved' && (
              <View style={[styles.badge, styles.badgeWarning]}>
                <Text style={[styles.badgeText, styles.badgeTextWarning]}>
                  {t('advancedBooking.limitReached')}
                </Text>
              </View>
            )}
          </View>

          {isSelected && (
            <Animated.View entering={ZoomIn.springify()}>
              <Icon name="check-circle" size={24} color={COLORS.aceGreen} />
            </Animated.View>
          )}
          {!isSelected && !disabled && (
            <View style={styles.radioButton}>
              <View style={styles.radioButtonInner} />
            </View>
          )}
          {disabled && (
            <Icon name="lock-outline" size={20} color={COLORS.disabled} />
          )}
        </Pressable>
      </Animated.View>
    );
  }, [userId, selectedParticipants, selectedStart, handleToggleParticipant, t]);

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={handleClose}
      onSwipeComplete={handleClose}
      swipeDirection={['down']}
      style={styles.modal}
      backdropOpacity={0.5}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={400}
      animationOutTiming={300}
      useNativeDriverForBackdrop
      propagateSwipe
      avoidKeyboard
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <Animated.View 
          style={styles.modalContent}
          entering={SlideInDown.springify().damping(20)}
        >
          {/* Drag indicator */}
          <View style={styles.dragIndicator} />

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Icon name="close" size={24} color={COLORS.netDark} />
          </TouchableOpacity>

          {/* Header with court info */}
          <Animated.View style={[styles.header, headerAnimatedStyle]}>
            <View style={styles.headerGradient}>
              <View style={styles.headerContent}>
                <View style={styles.courtBadge}>
                  <Icon name="sports-tennis" size={20} color={COLORS.whiteLines} />
                  <Text style={styles.courtBadgeText}>Court {courtName}</Text>
                </View>
                
                {selectedStart && (
                  <Animatable.View 
                    animation="fadeInUp" 
                    delay={200}
                    style={styles.dateTimeInfo}
                  >
                    <View style={styles.dateTimeRow}>
                      <Icon name="event" size={16} color={COLORS.whiteLines} />
                      <Text style={styles.dateTimeText}>{dateLabel}</Text>
                    </View>
                    <View style={styles.dateTimeRow}>
                      <Icon name="schedule" size={16} color={COLORS.whiteLines} />
                      <Text style={styles.dateTimeText}>{timeRange}</Text>
                    </View>
                  </Animatable.View>
                )}
              </View>
            </View>

            {/* Change time button */}
            <TouchableOpacity
              onPress={handleChangeTime}
              style={[
                styles.changeTimeButton,
                showTimePicker && styles.changeTimeButtonActive
              ]}
              activeOpacity={0.8}
            >
              <Icon 
                name={showTimePicker ? "close" : "edit"} 
                size={16} 
                color={showTimePicker ? COLORS.whiteLines : COLORS.courtBlue} 
              />
              <Text style={[
                styles.changeTimeText,
                showTimePicker && styles.changeTimeTextActive
              ]}>
                {showTimePicker 
                  ? t('advancedBooking.closeTimePicker') 
                  : t('advancedBooking.changeTime')}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Time picker - shown when button is clicked */}
          {showTimePicker && (
            <Animated.View 
              entering={FadeIn.duration(200)}
              style={styles.timePickerContainer}
            >
              <Text style={styles.timePickerTitle}>
                {t('advancedBooking.selectNewTime')}
              </Text>
              <FlatList
                data={availableSlots}
                renderItem={renderTimeSlot}
                keyExtractor={(item) => item.time.toISOString()}
                numColumns={3}
                contentContainerStyle={styles.timeSlotGrid}
                showsVerticalScrollIndicator={false}
                style={styles.timeSlotList}
              />
            </Animated.View>
          )}

          {/* Players section - hidden when time picker is shown */}
          {!showTimePicker && (
            <>
              <View style={styles.playersSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {t('advancedBooking.playersLabel')} ({playersShort})
                  </Text>
                </View>

                {/* Selected players chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipsScrollView}
                  contentContainerStyle={styles.chipsContainer}
                >
                  <View style={[styles.chip, styles.chipFixed]}>
                    <View style={styles.chipAvatar}>
                      <Icon name="person" size={14} color={COLORS.whiteLines} />
                    </View>
                    <Text style={styles.chipText}>{currentUserName}</Text>
                  </View>

                  {selectedParticipants.map((id, index) => {
                    const member = members.find((m) => m.id === id);
                    if (!member) return null;
                    
                    return (
                      <Animated.View
                        key={id}
                        entering={ZoomIn.delay(index * 50).springify()}
                        layout={Layout.springify()}
                        style={styles.chip}
                      >
                        <Text style={styles.chipText}>
                          {member.firstName} {member.lastName}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveParticipant(id)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={styles.chipRemove}
                        >
                          <Icon name="close" size={16} color={COLORS.grayMedium} />
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Search input */}
              <Animated.View style={[styles.searchContainer, searchContainerAnimatedStyle]}>
                <Icon 
                  name="search" 
                  size={20} 
                  color={isSearchFocused ? COLORS.courtBlue : COLORS.grayMedium}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={[
                    styles.searchInput,
                    isSearchFocused && styles.searchInputFocused,
                  ]}
                  placeholder={t('advancedBooking.searchMembersPlaceholder')}
                  placeholderTextColor={COLORS.grayMedium}
                  value={memberSearch}
                  onChangeText={onChangeMemberSearch}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  autoCorrect={false}
                  autoCapitalize="words"
                  returnKeyType="search"
                />
                {memberSearch.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      HapticFeedback.trigger('impactLight', HAPTICS.light);
                      onChangeMemberSearch('');
                    }}
                    style={styles.searchClear}
                  >
                    <Icon name="close" size={18} color={COLORS.grayMedium} />
                  </TouchableOpacity>
                )}
              </Animated.View>

              {/* Members list */}
              <FlatList
                data={filteredMembers}
                renderItem={renderMemberItem}
                keyExtractor={(item) => item.id?.toString() || item.email || ''}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScroll={(e) => {
                  scrollY.value = e.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Icon name="search-off" size={48} color={COLORS.grayMedium} />
                    <Text style={styles.emptyStateText}>
                      {t('advancedBooking.noPlayersFound')}
                    </Text>
                  </View>
                }
              />
            </>
          )}

          {/* Bottom action section */}
          {!showTimePicker && (
            <View style={styles.bottomSection}>
              <AnimatedPressable
                onPress={handleConfirm}
                disabled={confirmDisabled || isConfirming}
                style={[
                  styles.confirmButton,
                  confirmDisabled && styles.confirmButtonDisabled,
                  confirmButtonAnimatedStyle,
                ]}
              >
                <View style={styles.confirmButtonGradient}>
                  {isConfirming ? (
                    <ActivityIndicator size="small" color={COLORS.whiteLines} />
                  ) : (
                    <>
                      <Icon 
                        name={selectedBooking ? 'update' : 'check-circle'} 
                        size={20} 
                        color={COLORS.whiteLines}
                        style={styles.confirmButtonIcon}
                      />
                      <Text style={styles.confirmButtonText}>
                        {selectedBooking 
                          ? t('advancedBooking.updateNow') 
                          : t('advancedBooking.bookNow')}
                      </Text>
                    </>
                  )}
                </View>
              </AnimatedPressable>

              {confirmDisabled && (
                <Animatable.Text 
                  animation="fadeIn"
                  style={styles.helperText}
                >
                  {!selectedStart
                    ? '⏰ ' + (t('advancedBooking.ctaNeedsTime') || 'Select a time slot first')
                    : '👥 ' + (t('advancedBooking.ctaNeedsPlayers') || 'Add at least one player')}
                </Animatable.Text>
              )}
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.whiteLines,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: Platform.select({ ios: 34, android: 24 }),
    shadowColor: COLORS.netDark,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 24,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: COLORS.grayBorder,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  headerGradient: {
    backgroundColor: COLORS.courtBlue,
    borderRadius: 16,
    marginHorizontal: SPACING.lg,
    padding: SPACING.lg,
    marginTop: SPACING.md,
    shadowColor: COLORS.courtBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  headerContent: {
    gap: SPACING.md,
  },
  courtBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  courtBadgeText: {
    color: COLORS.whiteLines,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  dateTimeInfo: {
    gap: SPACING.xs,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dateTimeText: {
    color: COLORS.whiteLines,
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.95,
  },
  changeTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.courtBlueLight,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.courtBlue,
  },
  changeTimeButtonActive: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  changeTimeText: {
    color: COLORS.courtBlue,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: SPACING.sm,
    letterSpacing: 0.3,
  },
  changeTimeTextActive: {
    color: COLORS.whiteLines,
  },
  // Time picker styles
  timePickerContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  timePickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.netDark,
    marginBottom: SPACING.md,
  },
  timeSlotList: {
    maxHeight: 200,
  },
  timeSlotGrid: {
    paddingBottom: SPACING.sm,
  },
  timeSlot: {
    flex: 1,
    margin: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    backgroundColor: COLORS.grayLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    alignItems: 'center',
    minWidth: (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.xs * 6) / 3,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  timeSlotCurrent: {
    backgroundColor: COLORS.courtBlueLight,
    borderColor: COLORS.aceGreen,
  },
  timeSlotDisabled: {
    opacity: 0.4,
    backgroundColor: COLORS.grayLight,
  },
  timeSlotPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: COLORS.courtBlue,
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.netDark,
  },
  timeSlotTextCurrent: {
    color: COLORS.netDark,
    fontWeight: '600',
  },
  timeSlotTextDisabled: {
    color: COLORS.grayMedium,
  },
  // Rest of the styles remain the same...
  playersSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.netDark,
    letterSpacing: 0.2,
  },
  chipsScrollView: {
    maxHeight: 44,
    marginBottom: SPACING.sm,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingRight: SPACING.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grayLight,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  chipFixed: {
    backgroundColor: COLORS.courtBlueLight,
    borderColor: COLORS.courtBlue,
  },
  chipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.courtBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.netDark,
  },
  chipRemove: {
    marginLeft: SPACING.xs,
    padding: SPACING.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.grayLight,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.grayBorder,
  },
  searchIcon: {
    position: 'absolute',
    left: SPACING.lg,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    paddingLeft: SPACING.xxxl,
    paddingRight: SPACING.xl,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    fontSize: 16,
    color: COLORS.netDark,
  },
  searchInputFocused: {
    borderColor: COLORS.courtBlue,
  },
  searchClear: {
    position: 'absolute',
    right: SPACING.md,
    padding: SPACING.sm,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.whiteLines,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.grayBorder,
  },
  participantItemSelected: {
    backgroundColor: COLORS.courtBlueLight,
    borderColor: COLORS.courtBlue,
  },
  participantItemPressed: {
    backgroundColor: COLORS.grayLight,
    transform: [{ scale: 0.98 }],
  },
  participantItemDisabled: {
    opacity: 0.5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.softBeige,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarSelected: {
    backgroundColor: COLORS.courtBlue,
  },
  avatarDisabled: {
    backgroundColor: COLORS.grayLight,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.netDark,
  },
  avatarTextSelected: {
    color: COLORS.whiteLines,
  },
  participantInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.netDark,
  },
  participantNameDisabled: {
    color: COLORS.grayMedium,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: COLORS.softBeige,
  },
  badgeWarning: {
    backgroundColor: '#FFF8E1',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.grayMedium,
    letterSpacing: 0.2,
  },
  badgeTextWarning: {
    color: '#F57C00',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'transparent',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyStateText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.grayMedium,
  },
  bottomSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
    backgroundColor: COLORS.whiteLines,
  },
  confirmButton: {
    backgroundColor: COLORS.courtBlue,
    borderRadius: 12,
    elevation: 3,
    shadowColor: COLORS.courtBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: COLORS.disabled,
    elevation: 0,
    shadowOpacity: 0,
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    height: 56,
  },
  confirmButtonIcon: {
    marginRight: SPACING.sm,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.whiteLines,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  helperText: {
    textAlign: 'center',
    fontSize: 13,
    color: COLORS.grayMedium,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
});

export default BookingModal;