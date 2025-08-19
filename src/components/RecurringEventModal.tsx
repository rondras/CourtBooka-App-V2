import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Alert,
  Pressable
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Modal from 'react-native-modal';
import * as Animatable from 'react-native-animatable';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, differenceInMinutes, parse } from 'date-fns';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import HapticFeedback from 'react-native-haptic-feedback';
import { useTheme } from '../../App';
import { createRecurringEvent, updateRecurringEvent, deleteRecurringEvent } from '../api/api';
import { COLORS, SPACING } from '../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type CourtItem = {
  id: number;
  name: string;
  surface_type: string | null;
  has_floodlights: boolean;
  season: string;
};

type RecurringEventItem = {
  id: number;
  court_id: number;
  start_time_daily: string;
  end_time_daily: string;
  recurrence_json?: {
    days: number[];
    start_date?: string;
    end_date?: string;
  } | null;
  recurrence?: {
    days: number[];
    start_date?: string;
    end_date?: string;
  };
  description: string;
  start_date?: string;
  end_date?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  courts: CourtItem[];
  editingEvent?: RecurringEventItem | null;
};

const steps: Array<'court' | 'dates' | 'times' | 'weekdays' | 'description' | 'review'> = [
  'court',
  'dates',
  'times',
  'weekdays',
  'description',
  'review',
];

// Helper - round minutes to nearest 30
function roundToNearest30(date = new Date()) {
  const d = new Date(date);
  const minutes = d.getMinutes();
  const rounded = Math.round(minutes / 30) * 30;
  d.setMinutes(rounded);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return d;
}
const MemoDescriptionStep = React.memo(function MemoDescriptionStep({
  value,
  onChange,
  validations,
  colors,
  t,
  triggerHaptic,
}: {
  value: string;
  onChange: (v: string) => void;
  validations: any;
  colors: any;
  t: any;
  triggerHaptic: (type?: string) => void;
}) {
  const [local, setLocal] = useState<string>(value ?? '');
  const timerRef = useRef<number | null>(null);

  // sync when parent value changes (e.g. when loading editingEvent)
  useEffect(() => {
    setLocal(value ?? '');
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current as unknown as number);
      }
    };
  }, []);

  const pushToParent = useCallback((text: string) => {
    onChange(text);
  }, [onChange]);

  const handleChange = (text: string) => {
    setLocal(text);
    if (timerRef.current) {
      clearTimeout(timerRef.current as unknown as number);
    }
    // Debounce parent updates to reduce rerenders (200ms)
    timerRef.current = window.setTimeout(() => {
      pushToParent(text);
      timerRef.current = null;
    }, 200) as unknown as number;
  };

  const charCount = (local ?? '').length;
  const overLimit = charCount > 200;

  const quickSuggestions = [
    t('clubAdmin.training'),
    t('clubAdmin.matchPlay'),
    t('clubAdmin.tournament'),
    t('clubAdmin.teamPractice')
  ];

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.text }]}>{t('clubAdmin.eventDescription')}</Text>
      <Text style={[styles.subtitle, { color: COLORS.grayMedium }]}>{t('clubAdmin.eventDescriptionLong')}</Text>

      <View style={styles.descriptionHeader}>
        <Text style={[styles.charCounter, { color: overLimit ? COLORS.error : COLORS.grayMedium }]}>
          {charCount}/200
        </Text>
      </View>

      <TextInput
        value={local}
        onChangeText={handleChange}
        multiline
        placeholder={t('clubAdmin.enterDescription')}
        placeholderTextColor={COLORS.grayMedium}
        style={[styles.textArea, { color: colors.text, backgroundColor: COLORS.whiteLines }]}
        maxLength={250}
        textAlignVertical="top"
        returnKeyType="done"
        autoCorrect={false}
        autoCapitalize="sentences"
      />

      <View style={styles.quickSuggestions}>
        <Text style={styles.quickSuggestionsTitle}>{t('clubAdmin.quickAdd')}:</Text>
        <View style={styles.quickChipsContainer}>
          {quickSuggestions.map((label) => (
            <TouchableOpacity
              key={label}
              style={styles.quickChip}
              onPress={() => {
                triggerHaptic('light');
                const next = local?.trim() ? `${local.trim()} ${label}` : label;
                setLocal(next);
                // push immediately on chip press
                if (timerRef.current) clearTimeout(timerRef.current as unknown as number);
                pushToParent(next);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {!validations.description && (
        <Text style={styles.errorText}>
          • {overLimit ? t('clubAdmin.maxChars', { count: 200 }) : t('clubAdmin.enterDescriptionError')}
        </Text>
      )}
    </View>
  );
});

const RecurringEventModal: React.FC<Props> = ({ visible, onClose, courts, editingEvent }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const lastDurationRef = useRef<number>(60);
  const scrollViewRef = useRef<ScrollView>(null);

  // Localized weekday strings (Sunday first for index 0)
  const weekdayLabels = useMemo(
    () => [
      t('clubAdmin.sunday'),
      t('clubAdmin.monday'),
      t('clubAdmin.tuesday'),
      t('clubAdmin.wednesday'),
      t('clubAdmin.thursday'),
      t('clubAdmin.friday'),
      t('clubAdmin.saturday'),
    ],
    [t]
  );

  const weekdayNumberFromLabel = (label: string) => {
    const idx = weekdayLabels.indexOf(label);
    if (idx === -1) return 0;
    return idx;
  };

  // -------- Form State --------
  const [stepIndex, setStepIndex] = useState(0);
  const [courtId, setCourtId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<Date>(() => new Date());
  const [endDate, setEndDate] = useState<Date>(() => new Date(new Date().setDate(new Date().getDate() + 7)));
  const [startTime, setStartTime] = useState<Date>(() => roundToNearest30());
  const [endTime, setEndTime] = useState<Date>(() => {
    const d = roundToNearest30();
    d.setHours(d.getHours() + 1);
    return d;
  });
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [description, setDescription] = useState('');

  // pickers visibility
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Enhanced haptic feedback helper
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') => {
    const hapticMap = {
      light: 'impactLight',
      medium: 'impactMedium',
      heavy: 'impactHeavy',
      success: 'notificationSuccess',
      error: 'notificationError'
    };
    HapticFeedback.trigger(hapticMap[type] as any, {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false
    });
  }, []);

  // -------- Load initial data --------
  useEffect(() => {
    if (visible && editingEvent) {
      setCourtId(editingEvent.court_id);
      setDescription(editingEvent.description);
      const [utcStartHours, utcStartMinutes] = editingEvent.start_time_daily.split(':').map(Number);
      const localStart = new Date(Date.UTC(2000, 0, 1, utcStartHours, utcStartMinutes));
      setStartTime(localStart);
      const [utcEndHours, utcEndMinutes] = editingEvent.end_time_daily.split(':').map(Number);
      const localEnd = new Date(Date.UTC(2000, 0, 1, utcEndHours, utcEndMinutes));
      setEndTime(localEnd);
      
      let rec = editingEvent.recurrence_json || editingEvent.recurrence || { days: [] };
      
      if (typeof rec === 'string') {
        try {
          rec = JSON.parse(rec);
        } catch (e) {
          console.error('Failed to parse recurrence:', e);
          rec = { days: [] };
        }
      }
      
      const days = rec.days || [];
      
      // Convert from Python weekday numbers (0=Monday) to JS format (0=Sunday)
      const validDays = Array.isArray(days) 
        ? days.map(d => {
            if (typeof d === 'number') {
              // Convert from Python format (0=Monday, 6=Sunday) to JS format (0=Sunday, 1=Monday)
              if (d === 6) return 0; // Sunday
              return d + 1; // Monday(0)->1, Tuesday(1)->2, etc.
            }
            return -1;
          }).filter(d => d >= 0 && d < 7)
        : [];
      
      setWeekdays(validDays.map((d: number) => weekdayLabels[d]));
      
      if (rec.start_date && rec.end_date) {
        setStartDate(new Date(rec.start_date));
        setEndDate(new Date(rec.end_date));
      } else if (editingEvent.start_date && editingEvent.end_date) {
        setStartDate(new Date(editingEvent.start_date));
        setEndDate(new Date(editingEvent.end_date));
      }
    }
  }, [visible, editingEvent, weekdayLabels]);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setStepIndex(0);
      setCourtId(null);
      setStartDate(new Date());
      setEndDate(new Date(new Date().setDate(new Date().getDate() + 7)));
      const st = roundToNearest30();
      setStartTime(st);
      const et = new Date(st);
      et.setHours(et.getHours() + 1);
      setEndTime(et);
      setWeekdays([]);
      setDescription('');
      setShowStartDatePicker(false);
      setShowEndDatePicker(false);
      setShowStartTimePicker(false);
      setShowEndTimePicker(false);
      setSubmitting(false);
    }
  }, [visible]);

  // -------- Validation --------
  const validations = {
    court: !!courtId,
    dates: startDate < endDate,
    times: startTime < endTime,
    weekdays: weekdays.length > 0,
    description: description.trim().length > 0 && description.trim().length <= 200,
  };

  const stepIsValid = (s: (typeof steps)[number]) => validations[s] ?? true;
  const canGoNext = stepIsValid(steps[stepIndex]);

  const next = useCallback(() => {
    if (stepIndex < steps.length - 1 && canGoNext) {
      triggerHaptic('light');
      setStepIndex((i) => i + 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [stepIndex, canGoNext, triggerHaptic]);

  const back = useCallback(() => {
    triggerHaptic('light');
    setStepIndex((i) => Math.max(i - 1, 0));
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [triggerHaptic]);

  // Weekday handlers
  const toggleWeekday = useCallback((label: string) => {
    triggerHaptic('light');
    setWeekdays((prev) => (prev.includes(label) ? prev.filter((d) => d !== label) : [...prev, label]));
  }, [triggerHaptic]);

  const selectAllWeekdays = useCallback(() => {
    triggerHaptic('medium');
    setWeekdays([...weekdayLabels]);
  }, [weekdayLabels, triggerHaptic]);

  const clearWeekdays = useCallback(() => {
    triggerHaptic('light');
    setWeekdays([]);
  }, [triggerHaptic]);

  
  // Submit handler - FIXED to send day names instead of numbers
  const handleSubmit = async () => {
    if (!validations.court || !validations.dates || !validations.times || !validations.weekdays || !validations.description) {
      triggerHaptic('error');
      Toast.show({ type: 'error', text1: t('clubAdmin.validationError') });
      return;
    }

    setSubmitting(true);
    try {
      // Convert weekday labels to Python weekday numbers (0=Monday, 6=Sunday)
      const pythonWeekdayNumbers = weekdays.map(label => {
        const dayIndex = weekdayNumberFromLabel(label); // Returns 0=Sunday, 6=Saturday
        // Convert from Python format (0=Monday, 6=Sunday) to JS format (0=Sunday, 1=Monday)
        if (dayIndex === 0) return 6; // Sunday -> 6
        return dayIndex - 1; // Monday(1)->0, Tuesday(2)->1, etc.
      }).sort((a, b) => a - b); // Sort the days in ascending order

      const payload = {
        court_id: courtId,
        start_time_daily: `${startTime.getUTCHours().toString().padStart(2, '0')}:${startTime.getUTCMinutes().toString().padStart(2, '0')}`,
        end_time_daily: `${endTime.getUTCHours().toString().padStart(2, '0')}:${endTime.getUTCMinutes().toString().padStart(2, '0')}`,
        recurrence: { 
          days: pythonWeekdayNumbers // Send numbers 0-6 (0=Monday, 6=Sunday)
        },
        description: description.trim(),
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
      };
      
      console.log('Submitting payload:', JSON.stringify(payload, null, 2));
      
      if (editingEvent) {
        await updateRecurringEvent(editingEvent.id, payload);
        triggerHaptic('success');
        Toast.show({ type: 'success', text1: t('clubAdmin.recurringUpdated') });
      } else {
        await createRecurringEvent(payload);
        triggerHaptic('success');
        Toast.show({ type: 'success', text1: t('clubAdmin.recurringCreated') });
      }
      onClose();
    } catch (error) {
      console.error('API Error:', error);
      triggerHaptic('error');
      Toast.show({ type: 'error', text1: t('clubAdmin.recurringError') });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Enhanced Steps with improved UI/UX ----
  const CourtStep = () => (
    <Animatable.View animation="fadeInUp" duration={400} style={styles.section}>
      <Text style={[styles.title, { color: colors.text }]}>{t('clubAdmin.selectCourt')}</Text>
      <Text style={[styles.subtitle, { color: COLORS.grayMedium }]}>
        {t('clubAdmin.selectCourtDescription')}
      </Text>
      
      {courts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateText, { color: COLORS.grayMedium }]}>
            {t('clubAdmin.noCourtsAvailable')}
          </Text>
          <TouchableOpacity 
            style={styles.emptyStateButton} 
            onPress={() => { triggerHaptic('light'); onClose(); }}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyStateButtonText}>{t('clubAdmin.close')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.optionsContainer}>
          {courts.map((c, index) => {
            const selected = c.id === courtId;
            return (
              <Animatable.View
                key={c.id}
                animation="fadeInUp"
                delay={index * 50}
                duration={400}
              >
                <Pressable
                  onPress={() => {
                    triggerHaptic('light');
                    setCourtId(c.id);
                  }}
                  style={({ pressed }) => [
                    styles.courtCard,
                    selected && styles.courtCardSelected,
                    pressed && styles.courtCardPressed
                  ]}
                >
                  <View style={styles.courtCardContent}>
                    <View style={styles.courtCardMain}>
                      <Text style={[
                        styles.courtName,
                        selected && styles.courtNameSelected
                      ]}>
                        {c.name}
                      </Text>
                      <Text style={[
                        styles.courtSurface,
                        selected && styles.courtSurfaceSelected
                      ]}>
                        {c.surface_type || t('clubAdmin.unknownSurface')}
                      </Text>
                    </View>
                    {c.has_floodlights && (
                      <View style={[styles.floodlightBadge, selected && styles.floodlightBadgeSelected]}>
                        <Text style={[styles.floodlightText, selected && styles.floodlightTextSelected]}>
                          💡
                        </Text>
                      </View>
                    )}
                  </View>
                  {selected && (
                    <Animatable.View 
                      animation="fadeIn" 
                      duration={200}
                      style={styles.selectedIndicator}
                    />
                  )}
                </Pressable>
              </Animatable.View>
            );
          })}
        </View>
      )}
      
      {!validations.court && courtId === null && (
        <Animatable.View animation="shake" duration={500}>
          <Text style={styles.errorText}>• {t('clubAdmin.selectCourtError')}</Text>
        </Animatable.View>
      )}
    </Animatable.View>
  );

  const DatesStep = () => (
    <Animatable.View animation="fadeInUp" duration={400} style={styles.section}>
      <Text style={[styles.title, { color: colors.text }]}>{t('clubAdmin.selectDateRange')}</Text>
      <Text style={[styles.subtitle, { color: COLORS.grayMedium }]}>
        {t('clubAdmin.selectDateRangeDescription')}
      </Text>

      <View style={styles.dateCardsContainer}>
        <Pressable
          onPress={() => {
            triggerHaptic('light');
            setShowStartDatePicker(true);
          }}
          style={({ pressed }) => [
            styles.dateCard,
            pressed && styles.dateCardPressed
          ]}
        >
          <Text style={styles.dateLabel}>{t('clubAdmin.start')}</Text>
          <Text style={styles.dateValue}>{format(startDate, 'MMM dd')}</Text>
          <Text style={styles.dateYear}>{format(startDate, 'yyyy')}</Text>
        </Pressable>

        <View style={styles.dateArrow}>
          <Text style={styles.dateArrowText}>→</Text>
        </View>

        <Pressable
          onPress={() => {
            triggerHaptic('light');
            setShowEndDatePicker(true);
          }}
          style={({ pressed }) => [
            styles.dateCard,
            pressed && styles.dateCardPressed
          ]}
        >
          <Text style={styles.dateLabel}>{t('clubAdmin.end')}</Text>
          <Text style={styles.dateValue}>{format(endDate, 'MMM dd')}</Text>
          <Text style={styles.dateYear}>{format(endDate, 'yyyy')}</Text>
        </Pressable>
      </View>

      {showStartDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={new Date()}
          onChange={(_, date) => {
            setShowStartDatePicker(false);
            if (date) {
              setStartDate(date);
              if (date >= endDate) {
                let newEnd = new Date(date);
                newEnd.setDate(newEnd.getDate() + 7);
                setEndDate(newEnd);
              }
            }
          }}
        />
      )}
      
      {showEndDatePicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={startDate}
          onChange={(_, date) => {
            setShowEndDatePicker(false);
            if (date) setEndDate(date);
          }}
        />
      )}
      
      {!validations.dates && (
        <Animatable.View animation="shake" duration={500}>
          <Text style={styles.errorText}>• {t('clubAdmin.endDateAfterStart')}</Text>
        </Animatable.View>
      )}
    </Animatable.View>
  );

  const TimesStep = () => {
    const durationMinutes = differenceInMinutes(endTime, startTime);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    return (
      <Animatable.View animation="fadeInUp" duration={400} style={styles.section}>
        <Text style={[styles.title, { color: colors.text }]}>{t('clubAdmin.selectTimeRange')}</Text>
        <Text style={[styles.subtitle, { color: COLORS.grayMedium }]}>
          {t('clubAdmin.selectTimeRangeDescription')}
        </Text>

        <View style={styles.timeContainer}>
          <Pressable
            onPress={() => {
              triggerHaptic('light');
              setShowStartTimePicker(true);
            }}
            style={({ pressed }) => [
              styles.timeCard,
              pressed && styles.timeCardPressed
            ]}
          >
            <Text style={styles.timeLabel}>{t('clubAdmin.start')}</Text>
            <Text style={styles.timeValue}>{format(startTime, 'HH:mm')}</Text>
          </Pressable>

          <View style={styles.timeSeparator}>
            <View style={styles.timeLine} />
          </View>

          <Pressable
            onPress={() => {
              triggerHaptic('light');
              setShowEndTimePicker(true);
            }}
            style={({ pressed }) => [
              styles.timeCard,
              pressed && styles.timeCardPressed
            ]}
          >
            <Text style={styles.timeLabel}>{t('clubAdmin.end')}</Text>
            <Text style={styles.timeValue}>{format(endTime, 'HH:mm')}</Text>
          </Pressable>
        </View>

        {durationMinutes > 0 && (
          <Animatable.View animation="fadeIn" duration={300} style={styles.durationContainer}>
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>
                {t('clubAdmin.duration')}: {hours > 0 && `${hours}h`} {minutes > 0 && `${minutes}m`}
              </Text>
            </View>
          </Animatable.View>
        )}

        {!validations.times && (
          <Animatable.View animation="shake" duration={500}>
            <Text style={styles.errorText}>• {t('clubAdmin.startBeforeEndTimeError')}</Text>
          </Animatable.View>
        )}

        {showStartTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minuteInterval={30}
            onChange={(_, date) => {
              setShowStartTimePicker(false);
              if (date) {
                const rounded = roundToNearest30(date);
                setStartTime(rounded);
                const autoEnd = new Date(rounded.getTime() + lastDurationRef.current * 60000);
                if (autoEnd <= rounded) {
                  autoEnd.setHours(autoEnd.getHours() + 1);
                }
                setEndTime(autoEnd);
              }
            }}
          />
        )}

        {showEndTimePicker && (
          <DateTimePicker
            value={endTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minuteInterval={30}
            onChange={(_, date) => {
              setShowEndTimePicker(false);
              if (date) {
                const rounded = roundToNearest30(date);
                setEndTime(rounded);
                lastDurationRef.current = differenceInMinutes(rounded, startTime);
              }
            }}
          />
        )}
      </Animatable.View>
    );
  };

  const WeekdaysStep = () => (
    <Animatable.View animation="fadeInUp" duration={400} style={styles.section}>
      <Text style={[styles.title, { color: colors.text }]}>{t('clubAdmin.selectWeekdays')}</Text>
      <Text style={[styles.subtitle, { color: COLORS.grayMedium }]}>
        {t('clubAdmin.selectWeekdaysDescription')}
      </Text>

      <View style={styles.weekdaysGrid}>
        {weekdayLabels.map((day, index) => {
          const selected = weekdays.includes(day);
          return (
            <Animatable.View
              key={day}
              animation="fadeInUp"
              delay={index * 30}
              duration={300}
            >
              <Pressable
                onPress={() => toggleWeekday(day)}
                onLongPress={selectAllWeekdays}
                style={({ pressed }) => [
                  styles.weekdayChip,
                  selected && styles.weekdayChipSelected,
                  pressed && styles.weekdayChipPressed
                ]}
              >
                <Text style={[
                  styles.weekdayChipText,
                  selected && styles.weekdayChipTextSelected
                ]}>
                  {day.substring(0, 3)}
                </Text>
              </Pressable>
            </Animatable.View>
          );
        })}
      </View>

      <View style={styles.weekdayActions}>
        <TouchableOpacity
          onPress={selectAllWeekdays}
          activeOpacity={0.7}
          style={styles.weekdayAction}
        >
          <Text style={[styles.weekdayActionText, { color: COLORS.courtBlue }]}>
            {t('clubAdmin.selectAll')}
          </Text>
        </TouchableOpacity>
        <View style={styles.weekdayActionDivider} />
        <TouchableOpacity
          onPress={clearWeekdays}
          activeOpacity={0.7}
          style={styles.weekdayAction}
        >
          <Text style={[styles.weekdayActionText, { color: COLORS.error }]}>
            {t('clubAdmin.clearAll')}
          </Text>
        </TouchableOpacity>
      </View>

      {!validations.weekdays && (
        <Animatable.View animation="shake" duration={500}>
          <Text style={styles.errorText}>• {t('clubAdmin.selectAtLeastOneDayError')}</Text>
        </Animatable.View>
      )}
    </Animatable.View>
  );

// Entferne den React.memo Wrapper und die Animation vom DescriptionStep
const DescriptionStep = ({ description, setDescription, validations, colors, t, triggerHaptic }: any) => {
  const charCount = description?.length || 0;
  const overLimit = charCount > 200;

  const quickSuggestions = [
    t('clubAdmin.training'),
    t('clubAdmin.matchPlay'),
    t('clubAdmin.tournament'),
    t('clubAdmin.teamPractice')
  ];

  // Direkter Input-Handler ohne Verzögerung
  const handleTextChange = useCallback((text: string) => {
    setDescription(text);
  }, [setDescription]);

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.text }]}>
        {t('clubAdmin.eventDescription')}
      </Text>
      
      <Text style={[styles.subtitle, { color: COLORS.grayMedium }]}>
        {t('clubAdmin.eventDescriptionLong')}
      </Text>

      <View style={styles.descriptionHeader}>
        <Text style={[
          styles.charCounter,
          { color: overLimit ? COLORS.error : COLORS.grayMedium }
        ]}>
          {charCount}/200
        </Text>
      </View>

      <TextInput
        value={description}
        onChangeText={handleTextChange}
        multiline
        placeholder={t('clubAdmin.enterDescription')}
        placeholderTextColor={COLORS.grayMedium}
        style={[
          styles.textArea, 
          { 
            color: colors.text, 
            backgroundColor: COLORS.whiteLines,
            height: 120 // Fixe Höhe
          }
        ]}
        maxLength={250}
        textAlignVertical="top"
        returnKeyType="done"
        autoCorrect={false}
        autoCapitalize="sentences"
      />

      <View style={styles.quickSuggestions}>
        <Text style={styles.quickSuggestionsTitle}>
          {t('clubAdmin.quickAdd')}:
        </Text>
        <View style={styles.quickChipsContainer}>
          {quickSuggestions.map((label) => (
            <TouchableOpacity
              key={label}
              style={styles.quickChip}
              onPress={() => {
                triggerHaptic('light');
                setDescription(description?.trim() 
                  ? `${description.trim()} ${label}` 
                  : label
                );
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {!validations.description && (
        <Text style={styles.errorText}>
          • {overLimit 
              ? t('clubAdmin.maxChars', { count: 200 }) 
              : t('clubAdmin.enterDescriptionError')
            }
        </Text>
      )}
    </View>
  );
};

  const ReviewStep = () => {
    const court = courts.find(c => c.id === courtId);
    const durationMinutes = differenceInMinutes(endTime, startTime);
    const durationString = `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 ? ` ${durationMinutes % 60}m` : ''}`;

    return (
      <Animatable.View animation="fadeInUp" duration={400} style={styles.section}>
        <Text style={[styles.title, { color: colors.text }]}>{t('clubAdmin.reviewDetails')}</Text>
        <Text style={[styles.subtitle, { color: COLORS.grayMedium }]}>
          {t('clubAdmin.reviewDetailsDescription')}
        </Text>

        <View style={styles.reviewContainer}>
          {/* Court */}
          <Animatable.View animation="fadeInUp" delay={50} style={styles.reviewCard}>
            <View style={styles.reviewCardHeader}>
              <Text style={styles.reviewCardLabel}>{t('clubAdmin.court')}</Text>
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  setStepIndex(steps.indexOf('court'));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.reviewEditButton}>{t('clubAdmin.edit')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.reviewCardValue}>
              {court ? `${court.name}` : t('clubAdmin.noCourtSelected')}
            </Text>
            {court?.surface_type && (
              <Text style={styles.reviewCardSubvalue}>{court.surface_type}</Text>
            )}
          </Animatable.View>

          {/* Dates */}
          <Animatable.View animation="fadeInUp" delay={100} style={styles.reviewCard}>
            <View style={styles.reviewCardHeader}>
              <Text style={styles.reviewCardLabel}>{t('clubAdmin.dateRange')}</Text>
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  setStepIndex(steps.indexOf('dates'));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.reviewEditButton}>{t('clubAdmin.edit')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.reviewCardValue}>
              {format(startDate, 'MMM dd, yyyy')} → {format(endDate, 'MMM dd, yyyy')}
            </Text>
          </Animatable.View>

          {/* Times */}
          <Animatable.View animation="fadeInUp" delay={150} style={styles.reviewCard}>
            <View style={styles.reviewCardHeader}>
              <Text style={styles.reviewCardLabel}>{t('clubAdmin.timeRange')}</Text>
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  setStepIndex(steps.indexOf('times'));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.reviewEditButton}>{t('clubAdmin.edit')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.reviewCardValue}>
              {format(startTime, 'HH:mm')} → {format(endTime, 'HH:mm')}
            </Text>
            <Text style={styles.reviewCardSubvalue}>{t('clubAdmin.duration')}: {durationString}</Text>
          </Animatable.View>

          {/* Weekdays */}
          <Animatable.View animation="fadeInUp" delay={200} style={styles.reviewCard}>
            <View style={styles.reviewCardHeader}>
              <Text style={styles.reviewCardLabel}>{t('clubAdmin.weekdays')}</Text>
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  setStepIndex(steps.indexOf('weekdays'));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.reviewEditButton}>{t('clubAdmin.edit')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.reviewWeekdayChips}>
              {weekdays.length > 0 ? weekdays.map(day => (
                <View key={day} style={styles.reviewWeekdayChip}>
                  <Text style={styles.reviewWeekdayText}>{day.substring(0, 3)}</Text>
                </View>
              )) : (
                <Text style={styles.reviewCardValue}>{t('clubAdmin.noneSelected')}</Text>
              )}
            </View>
          </Animatable.View>

          {/* Description */}
          <Animatable.View animation="fadeInUp" delay={250} style={styles.reviewCard}>
            <View style={styles.reviewCardHeader}>
              <Text style={styles.reviewCardLabel}>{t('clubAdmin.description')}</Text>
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  setStepIndex(steps.indexOf('description'));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.reviewEditButton}>{t('clubAdmin.edit')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.reviewCardValue} numberOfLines={3}>
              {description || t('clubAdmin.noDescription')}
            </Text>
          </Animatable.View>
        </View>

        {/* Delete button for editing mode */}
        {editingEvent && (
          <Animatable.View animation="fadeInUp" delay={300}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                triggerHaptic('medium');
                Alert.alert(
                  t('clubAdmin.confirmDeleteRecurring'),
                  t('clubAdmin.deleteRecurringWarning'),
                  [
                    { text: t('clubAdmin.cancel'), style: 'cancel' },
                    {
                      text: t('clubAdmin.delete'),
                      style: 'destructive',
                      onPress: async () => {
                        setSubmitting(true);
                        try {
                          await deleteRecurringEvent(editingEvent.id);
                          triggerHaptic('success');
                          Toast.show({ type: 'success', text1: t('clubAdmin.recurringDeleted') });
                          onClose();
                        } catch (error) {
                          triggerHaptic('error');
                          Toast.show({ type: 'error', text1: t('clubAdmin.deleteRecurringError') });
                        } finally {
                          setSubmitting(false);
                        }
                      },
                    },
                  ]
                );
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteButtonText}>{t('clubAdmin.deleteEvent')}</Text>
            </TouchableOpacity>
          </Animatable.View>
        )}
      </Animatable.View>
    );
  };

  const renderStep = () => {
    switch (steps[stepIndex]) {
      case 'court':
        return <CourtStep />;
      case 'dates':
        return <DatesStep />;
      case 'times':
        return <TimesStep />;
      case 'weekdays':
        return <WeekdaysStep />;
      case 'description':
        return (
          <Animatable.View animation="fadeInUp" duration={400} useNativeDriver>
            <MemoDescriptionStep
              value={description}
              onChange={setDescription}
              validations={validations}
              colors={colors}
              t={t}
              triggerHaptic={triggerHaptic}
            />
          </Animatable.View>
        );
      case 'review':
        return <ReviewStep />;
    }
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      style={styles.modal}
      swipeDirection="down"
      onSwipeComplete={onClose}
      backdropOpacity={0.5}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={400}
      animationOutTiming={300}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
        {/* Handle bar */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animatable.View
              animation="fadeIn"
              style={[
                styles.progressFill,
                { width: `${((stepIndex + 1) / steps.length) * 100}%` }
              ]}
            />
          </View>
          <View style={styles.stepIndicators}>
            {steps.map((step, i) => {
              const isActive = i === stepIndex;
              const isCompleted = i < stepIndex;
              const canJump = i < stepIndex || (i > stepIndex && steps.slice(0, i).every(s => stepIsValid(s)));

              return (
                <TouchableOpacity
                  key={i}
                  disabled={!canJump}
                  onPress={() => {
                    if (canJump) {
                      triggerHaptic('light');
                      setStepIndex(i);
                    }
                  }}
                  activeOpacity={0.7}
                  style={styles.stepIndicatorTouch}
                >
                  <View
                    style={[
                      styles.stepDot,
                      isActive && styles.stepDotActive,
                      isCompleted && styles.stepDotCompleted
                    ]}
                  >
                    {isCompleted && (
                      <Animatable.Text
                        animation="zoomIn"
                        duration={200}
                        style={styles.stepDotCheck}
                      >
                        ✓
                      </Animatable.Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Content */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}
        </ScrollView>

        {/* Bottom action bar */}
        <View style={[styles.bottomBar, { backgroundColor: colors.background }]}>
          {stepIndex > 0 ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={back}
              activeOpacity={0.8}
            >
              <Text style={styles.backButtonText}>{t('clubAdmin.back')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backButtonPlaceholder} />
          )}

          {stepIndex < steps.length - 1 ? (
            <TouchableOpacity
              style={[
                styles.nextButton,
                !canGoNext && styles.nextButtonDisabled
              ]}
              onPress={next}
              disabled={!canGoNext}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.nextButtonText,
                !canGoNext && styles.nextButtonTextDisabled
              ]}>
                {t('clubAdmin.next')}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.submitButton,
                submitting && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.whiteLines} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingEvent ? t('clubAdmin.updateRecurring') : t('clubAdmin.createRecurring')}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

// Styles remain the same as in your provided code
const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    borderTopLeftRadius: SPACING.xl,
    borderTopRightRadius: SPACING.xl,
    maxHeight: SCREEN_HEIGHT * 0.92,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.grayBorder,
  },
  progressContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.grayLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.courtBlue,
    borderRadius: 2,
  },
  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
  stepIndicatorTouch: {
    padding: SPACING.xs,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
  },
  stepDotActive: {
    backgroundColor: COLORS.courtBlue,
    borderColor: COLORS.courtBlue,
    transform: [{ scale: 1.2 }],
  },
  stepDotCompleted: {
    backgroundColor: COLORS.aceGreen,
    borderColor: COLORS.aceGreen,
  },
  stepDotCheck: {
    color: COLORS.whiteLines,
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 120,
  },
  section: {
    paddingVertical: SPACING.md,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    marginBottom: SPACING.lg,
  },
  
  // Court Step
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  emptyStateButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.courtBlueLight,
    borderRadius: SPACING.md,
  },
  emptyStateButtonText: {
    color: COLORS.courtBlue,
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
  optionsContainer: {
    gap: SPACING.md,
  },
  courtCard: {
    backgroundColor: COLORS.whiteLines,
    borderRadius: SPACING.md,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
  courtCardSelected: {
    borderColor: COLORS.courtBlue,
    backgroundColor: COLORS.courtBlueLight,
  },
  courtCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  courtCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courtCardMain: {
    flex: 1,
  },
  courtName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.netDark,
    marginBottom: SPACING.xs,
  },
  courtNameSelected: {
    color: COLORS.courtBlueDark,
  },
  courtSurface: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
  },
  courtSurfaceSelected: {
    color: COLORS.courtBlue,
  },
  floodlightBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.warningYellow + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floodlightBadgeSelected: {
    backgroundColor: COLORS.warningYellow + '40',
  },
  floodlightText: {
    fontSize: 16,
  },
  floodlightTextSelected: {
    fontSize: 18,
  },
  selectedIndicator: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.aceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Date Step
  dateCardsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  dateCard: {
    flex: 1,
    backgroundColor: COLORS.whiteLines,
    borderRadius: SPACING.md,
    padding: SPACING.lg,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  dateCardPressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: COLORS.grayLight,
  },
  dateLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: COLORS.grayMedium,
    marginBottom: SPACING.xs,
  },
  dateValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
  },
  dateYear: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    marginTop: SPACING.xs,
  },
  dateArrow: {
    paddingHorizontal: SPACING.sm,
  },
  dateArrowText: {
    fontSize: 24,
    color: COLORS.courtBlue,
  },

  // Time Step
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  timeCard: {
    flex: 1,
    backgroundColor: COLORS.whiteLines,
    borderRadius: SPACING.md,
    padding: SPACING.lg,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  timeCardPressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: COLORS.grayLight,
  },
  timeLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: COLORS.grayMedium,
    marginBottom: SPACING.xs,
  },
  timeValue: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
  },
  timeSeparator: {
    width: 40,
    alignItems: 'center',
  },
  timeLine: {
    width: 20,
    height: 2,
    backgroundColor: COLORS.grayBorder,
  },
  durationContainer: {
    alignItems: 'center',
  },
  durationBadge: {
    backgroundColor: COLORS.courtBlueLight,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: SPACING.xl,
  },
  durationText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.courtBlueDark,
  },

  // Weekdays Step
  weekdaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  weekdayChip: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.grayLight,
    borderRadius: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    minWidth: 80,
    alignItems: 'center',
  },
  weekdayChipSelected: {
    backgroundColor: COLORS.courtBlue,
    borderColor: COLORS.courtBlue,
  },
  weekdayChipPressed: {
    transform: [{ scale: 0.95 }],
  },
  weekdayChipText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.grayMedium,
  },
  weekdayChipTextSelected: {
    color: COLORS.whiteLines,
  },
  weekdayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  weekdayAction: {
    padding: SPACING.sm,
  },
  weekdayActionText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
  },
  weekdayActionDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.grayBorder,
  },

  // Description Step
  descriptionHeader: {
    alignItems: 'flex-end',
    marginBottom: SPACING.sm,
  },
  charCounter: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  textAreaContainer: {
    backgroundColor: COLORS.whiteLines,
    borderRadius: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: SPACING.lg,
  },
  textAreaContainerError: {
    borderColor: COLORS.error,
  },
  textArea: {
    minHeight: 120,
    padding: SPACING.lg,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlignVertical: 'top',
  },
  quickSuggestions: {
    marginTop: SPACING.sm,
  },
  quickSuggestionsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.grayMedium,
    marginBottom: SPACING.sm,
  },
  quickChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  quickChip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.courtBlueLight,
    borderRadius: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.courtBlue + '40',
  },
  quickChipText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.courtBlueDark,
  },

  // Review Step
  reviewContainer: {
    gap: SPACING.md,
  },
  reviewCard: {
    backgroundColor: COLORS.whiteLines,
    borderRadius: SPACING.md,
    padding: SPACING.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  reviewCardLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: COLORS.grayMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewEditButton: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.courtBlue,
  },
  reviewCardValue: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: COLORS.netDark,
  },
  reviewCardSubvalue: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    marginTop: SPACING.xs,
  },
  reviewWeekdayChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  reviewWeekdayChip: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.courtBlue,
    borderRadius: SPACING.xs,
  },
  reviewWeekdayText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: COLORS.whiteLines,
  },
  deleteButton: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.error,
    borderRadius: SPACING.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: COLORS.whiteLines,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },

  // Error text
  errorText: {
    color: COLORS.error,
    marginTop: SPACING.sm,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
    flexDirection: 'row',
    gap: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: SPACING.md,
    backgroundColor: COLORS.grayLight,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: COLORS.netDark,
  },
  backButtonPlaceholder: {
    width: 96,
  },
  nextButton: {
    flex: 1,
    backgroundColor: COLORS.courtBlue,
    borderRadius: SPACING.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    shadowColor: COLORS.courtBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonDisabled: {
    backgroundColor: COLORS.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonText: {
    color: COLORS.whiteLines,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  nextButtonTextDisabled: {
    opacity: 0.6,
  },
  submitButton: {
    flex: 1,
    backgroundColor: COLORS.aceGreen,
    borderRadius: SPACING.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    shadowColor: COLORS.aceGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: COLORS.whiteLines,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});

export default RecurringEventModal;