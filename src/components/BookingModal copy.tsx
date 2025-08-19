import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList, TextInput,
  KeyboardAvoidingView, Platform, Keyboard, StyleSheet, Pressable
} from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeInLeft, FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from 'react-native-haptic-feedback';
import { addMinutes, isAfter } from 'date-fns';
import { TFunction } from 'i18next';

// Local color constants to match the app palette
const COURT_BLUE = '#5C9EAD';
const ACE_GREEN = '#4CAF50';
const NET_DARK = '#2A3D45';
const WHITE_LINES = '#FFFFFF';
const SOFT_BEIGE = '#F5F5DC';
const LIGHT_BORDER = '#E0E0E0';
const MUTED = '#6B7280';


export interface Member {
  id?: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  bookable: boolean;
  status: string;
  role: string;
}

interface BookingModalProps {
  visible: boolean;
  onClose: () => void;

  // Booking context
  courtName: string;
  selectedStart: Date | null;
  duration: number;
  formatToCEST: (date: Date) => string;

  // Time
  onPressChangeTime: () => void;

  // Participants
  currentUserName: string;
  userId: number | undefined;
  members: Member[];
  filteredMembers: Member[];
  memberSearch: string;
  onChangeMemberSearch: (text: string) => void;
  selectedParticipants: number[];
  onToggleParticipant: (member: Member) => void;
  onRemoveParticipant: (id: number) => void;

  // Confirm
  onConfirm: () => void;
  selectedBooking?: any | null;

  // i18n
  t: TFunction;
}

const BookingModal: React.FC<BookingModalProps> = ({
  visible,
  onClose,
  courtName,
  selectedStart,
  duration,
  formatToCEST,
  onPressChangeTime,
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
  t,
}) => {
    // Header labels (inside the component)
const end = React.useMemo(
    () => (selectedStart ? addMinutes(selectedStart, duration) : null),
    [selectedStart, duration]
);

const timeRange = React.useMemo(() => {
    if (!selectedStart) {
        return t('advancedBooking.selectTime') || 'Select time';
    }
    return `${formatToCEST(selectedStart)} – ${end ? formatToCEST(end) : ''}`;
}, [selectedStart, end, formatToCEST, t]);

const playersSelected = 1 + selectedParticipants.length; // include current user
const playersShort = 
    (t('advancedBooking.playersCountShort', { count: playersSelected, max: 3 }) as string) ||
    `${playersSelected}/3`;

const confirmDisabled = !selectedStart || selectedParticipants.length === 0;

const dateLabel = React.useMemo(() => {
  if (!selectedStart) return t('advancedBooking.selectDate') || 'Select date';
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(selectedStart);
}, [selectedStart, t]);

const dateTimeSummary = selectedStart
  ? `${dateLabel} · ${timeRange} · ${playersShort}`
  : (t('advancedBooking.selectDateTime') || 'Select date & time');

  return (
    <Modal visible={visible} transparent animationType="none">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
      >
        <Animated.View
            entering={FadeInUp}
            style={[styles.modalContent, { paddingBottom: Platform.OS === 'ios' ? 34 : 16 }]}
            >
            <View style={styles.grabber} />
            <TouchableOpacity
                style={styles.closeIcon}
                onPress={() => { Haptics.trigger('impactLight'); onClose(); }}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                accessibilityRole="button"
                accessibilityLabel={t('advancedBooking.closeParticipantModal')}
            >
                <Icon name="close" size={24} color={NET_DARK} />
            </TouchableOpacity>

            <View
                style={styles.headerSection}
                accessible
                accessibilityRole="header"
                accessibilityLabel={`${courtName}, ${dateTimeSummary}`}
            >
                <View style={styles.headerRow}>
                    <Icon name="sports-tennis" size={20} color={COURT_BLUE} />
                    <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                    Court {courtName}
                    </Text>
                    
                </View>

                <View style={styles.headerSubtitleRow}>
                    <Icon name="event" size={16} color={COURT_BLUE} />
                    <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
                        {dateTimeSummary}
                    </Text>
                </View>
                </View>



          <TouchableOpacity onPress={onPressChangeTime} style={styles.timeButton}>
            <Text style={styles.timeButtonText}>{t('advancedBooking.changeTime')}</Text>
          </TouchableOpacity>

          <View style={styles.selectedChipsContainer}>
            <Text style={styles.selectedLabel}>{t('advancedBooking.playersLabel')}</Text>
            <View style={[styles.chip, styles.fixedChip]}>
              <Icon name="person" size={16} color={NET_DARK} style={{ marginRight: 4 }} />
              <Text style={styles.chipText}>{currentUserName}</Text>
            </View>
            {selectedParticipants.map((id) => {
              const member = members.find((m) => m.id === id);
              return (
                <Animated.View entering={FadeIn} key={id} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {member?.firstName} {member?.lastName}
                  </Text>
                  <TouchableOpacity onPress={() => onRemoveParticipant(id)} accessibilityRole="button">
                    <Icon name="close" size={16} color={NET_DARK} />
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          <TouchableOpacity onPress={Keyboard.dismiss} activeOpacity={1} style={styles.searchInputContainer}>
            <Animated.View entering={FadeInDown} style={styles.inputWrapper}>
                <Icon name="search" size={18} color={MUTED} style={styles.inputLeftIcon} />
                <TextInput
                style={styles.searchInput}
                placeholder={t('advancedBooking.searchMembersPlaceholder')}
                placeholderTextColor={MUTED}
                value={memberSearch}
                onChangeText={onChangeMemberSearch}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="search"
                clearButtonMode="while-editing"
                accessibilityLabel={t('advancedBooking.searchMembersLabel')}
                />
                {memberSearch?.length > 0 && (
                <Pressable
                    onPress={() => onChangeMemberSearch('')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('advancedBooking.clearSearch') || 'Clear search'}
                    style={styles.inputRightClear}
                >
                    <Icon name="close" size={18} color={MUTED} />
                </Pressable>
                )}
            </Animated.View>
            </TouchableOpacity>

          <FlatList
            style={styles.participantsList}
            contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 72 }}
            data={filteredMembers}
            keyExtractor={(item) => item.id?.toString() || item.email!}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews
            windowSize={8}
            getItemLayout={(data, index) => ({ length: 56, offset: 56 * index, index })}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            renderItem={({ item }) => {
                if (item.id === Number(userId)) return null;
                const isUnregistered = !item.bookable || item.status !== 'approved';
                const isSelected = !!item.id && selectedParticipants.includes(item.id);
                const now = new Date();
                const isPast = !selectedStart ? false : !isAfter(selectedStart, now);
                const disabled = isUnregistered || isPast;

                return (
                <Animated.View entering={FadeInLeft}>
                    <Pressable
                    onPress={() => onToggleParticipant(item)}
                    disabled={disabled}
                    android_ripple={{ color: '#E5E7EB' }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected, disabled }}
                    accessibilityLabel={
                        item.id && item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : item.email
                    }
                    style={({ pressed }) => [
                        styles.participantItem,
                        isSelected && styles.selectedParticipantItem,
                        pressed && !disabled && styles.participantPressed,
                        disabled && styles.participantDisabled,
                    ]}
                    >
                    <View style={styles.participantInfo}>
                        {disabled && <Icon name="lock" size={16} color={MUTED} style={{ marginRight: 8 }} />}
                        <Text style={[styles.participantName, disabled ? styles.disabledText : null]} numberOfLines={1}>
                        {item.id && item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : item.email}
                        </Text>
                        {item.id && !item.bookable && item.status === 'approved' && (
                        <Text style={styles.bookableBadge}>{t('advancedBooking.limitReached')}</Text>
                        )}
                        {isUnregistered && (
                        <Text style={styles.pendingBadge}>{t('advancedBooking.pendingMember')}</Text>
                        )}
                    </View>
                    {isSelected ? <Icon name="check-circle" size={20} color={ACE_GREEN} /> : null}
                    </Pressable>
                </Animated.View>
                );
            }}
            ListEmptyComponent={<Text style={styles.noResults}>{t('advancedBooking.noPlayersFound')}</Text>}
            />

          <View style={[styles.modalBottomContainer, { paddingBottom: Platform.OS === 'ios' ? 12 : 8 }]}>
            <TouchableOpacity
                onPress={onConfirm}
                style={[styles.button, styles.confirmButton, confirmDisabled && styles.disabledButton]}
                disabled={confirmDisabled}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityHint={t('advancedBooking.bookNowHint') || 'Books the court with selected players'}
            >
                <Text style={[styles.buttonText, styles.buttonTextContrast]} numberOfLines={1}>
                {(selectedBooking ? t('advancedBooking.updateNow') : t('advancedBooking.bookNow')) || (selectedBooking ? 'Update' : 'Book')}
                </Text>
            </TouchableOpacity>
            {confirmDisabled && (
                <Text style={styles.ctaHelper} accessibilityLiveRegion="polite">
                {!selectedStart
                    ? t('advancedBooking.ctaNeedsTime') || 'Choose a time first'
                    : t('advancedBooking.ctaNeedsPlayers') || 'Select at least 1 player'}
                </Text>
            )}
            </View>

        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  closeIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 12,
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: NET_DARK,
    marginBottom: 12,
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
  selectedChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  selectedLabel: {
    fontSize: 14,
    color: MUTED,
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
  searchInputContainer: {
    width: '100%',
  },
searchInput: {
  backgroundColor: SOFT_BEIGE,
  color: NET_DARK,
  paddingVertical: 12,
  paddingLeft: 40,      // make room for left icon
  paddingRight: 40,     // make room for clear button
  borderRadius: 12,
  marginBottom: 16,
  fontFamily: 'Inter-Regular',
  borderWidth: 1,
  borderColor: LIGHT_BORDER,
},
  participantsList: {
    maxHeight: '50%',
    marginBottom: 24,
  },
participantItem: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 16,
  height: 56,                 // consistent height -> smoother scroll
  borderBottomWidth: 1,
  borderBottomColor: LIGHT_BORDER,
  backgroundColor: WHITE_LINES,
},
  selectedParticipantItem: {
    backgroundColor: '#E6F7FF',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
participantPressed: {
  backgroundColor: '#F3F4F6',
},
participantDisabled: {
  opacity: 0.6,
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
    color: MUTED,
  },
  modalBottomContainer: {
    marginTop: 'auto',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: LIGHT_BORDER,
    backgroundColor: WHITE_LINES, // add this
    },
button: {
  flex: 1,
  padding: 16,
  borderRadius: 12,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 48,
  shadowColor: NET_DARK,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 4,
  elevation: 2,
},
confirmButton: {
    backgroundColor: COURT_BLUE,
  },
disabledButton: {
    backgroundColor: '#B0BEC5',
  },
buttonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    },
buttonTextContrast: {
    color: WHITE_LINES,
    },
noResults: {
    textAlign: 'center',
    color: MUTED,
    marginTop: 16,
    fontFamily: 'Inter-Regular',
  },
grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 12,
},
inputWrapper: {
  position: 'relative',
  justifyContent: 'center',
},
inputLeftIcon: {
  position: 'absolute',
  left: 12,
  zIndex: 1,
},
inputRightClear: {
  position: 'absolute',
  right: 12,
  padding: 6,
  borderRadius: 12,
},
pendingBadge: {
  marginLeft: 8,
  fontSize: 12,
  color: '#8A6D3B',
  backgroundColor: '#FFF4E5',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 8,
},
ctaHelper: {
  marginTop: 8,
  textAlign: 'center',
  color: MUTED,
  fontSize: 12,
  fontFamily: 'Inter-Regular',
},
headerSection: {
  marginBottom: 12,
},
headerRow: {
  flexDirection: 'row',
  alignItems: 'center',
},
headerTitle: {
  flex: 1,
  marginLeft: 8,
  fontSize: 20,
  color: NET_DARK,
  fontFamily: 'Inter-Bold',
},
headerAction: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: COURT_BLUE,
  paddingHorizontal: 10,
  height: 32,
  borderRadius: 8,
  marginLeft: 8,
},
headerActionText: {
  color: WHITE_LINES,
  marginLeft: 6,
  fontSize: 13,
  fontFamily: 'Inter-Medium',
},
headerSubtitleRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  marginTop: 6,
},
headerSubtitle: {
  flex: 1,           // allow truncation to a single line
  color: MUTED,
  fontSize: 14,
  fontFamily: 'Inter-Regular',
},
});

export default BookingModal;