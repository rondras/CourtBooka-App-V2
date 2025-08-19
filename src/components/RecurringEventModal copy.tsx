// RecurringEventBottomSheet.tsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
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
  KeyboardAvoidingView
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Modal from 'react-native-modal';
import LinearGradient from 'react-native-linear-gradient';
import * as Animatable from 'react-native-animatable';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, differenceInMinutes } from 'date-fns';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../App'; // adjust path if needed
import { createRecurringEvent } from '../api/api'; // adjust path if needed

// Brand-aligned color palette
const COURT_BLUE = '#5C9EAD';
const ACE_GREEN = '#4CAF50';
const NET_DARK = '#2A3D45';
const WHITE_LINES = '#FFFFFF';
const ERROR_RED = '#FF5252';

type CourtItem = {
  id: number;
  name: string;
  surface_type: string | null;
  has_floodlights: boolean;
  season: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  courts: CourtItem[];
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

const RecurringEventBottomSheet: React.FC<Props> = ({ visible, onClose, courts }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const lastDurationRef = useRef<number>(60); // remembers last duration in minutes

  // Localized weekday strings
  const weekdayLabels = useMemo(
    () => [
      t('clubAdmin.monday'),
      t('clubAdmin.tuesday'),
      t('clubAdmin.wednesday'),
      t('clubAdmin.thursday'),
      t('clubAdmin.friday'),
      t('clubAdmin.saturday'),
      t('clubAdmin.sunday'),
    ],
    [t]
  );

  const weekdayNumberFromLabel = (label: string) => {
    const idx = weekdayLabels.indexOf(label);
    if (idx === -1) return 0;
    return idx === 6 ? 0 : idx + 1;
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

  const next = () => {
    if (stepIndex < steps.length - 1 && canGoNext) setStepIndex((i) => i + 1);
  };
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));

  // Weekday handlers
  const toggleWeekday = (label: string) => {
    setWeekdays((prev) => (prev.includes(label) ? prev.filter((d) => d !== label) : [...prev, label]));
  };
  const selectAllWeekdays = () => setWeekdays([...weekdayLabels]);
  const clearWeekdays = () => setWeekdays([]);

  // Submit handler
  const handleSubmit = async () => {
    if (!validations.court || !validations.dates || !validations.times || !validations.weekdays || !validations.description) {
      Toast.show({ type: 'error', text1: t('clubAdmin.validationError') });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        court_id: courtId,
        start_time_daily: format(startTime, 'HH:mm'),
        end_time_daily: format(endTime, 'HH:mm'),
        recurrence: { days: weekdays.map((label) => weekdayNumberFromLabel(label)) },
        description: description.trim(),
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
      };
      await createRecurringEvent(payload);
      Toast.show({ type: 'success', text1: t('clubAdmin.recurringCreated') });
      onClose();
    } catch (e) {
      Toast.show({ type: 'error', text1: t('clubAdmin.recurringError') });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Steps ----
  const CourtStep = () => (
    <Animatable.View animation="fadeInUp" duration={300} style={styles.section}>
      <Text style={[styles.title, { color: colors.text }]}>{t('clubAdmin.selectCourt')}</Text>
      {courts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.body, { color: colors.text }]}>{t('clubAdmin.noCourtsAvailable')}</Text>
          <TouchableOpacity style={[styles.ghostBtn, { borderColor: colors.muted }]} onPress={onClose}>
            <Text style={[styles.ghostText, { color: colors.text }]}>{t('clubAdmin.close')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.listCol}>
          {courts.map((c) => {
            const selected = c.id === courtId;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCourtId(c.id)}
                style={[styles.optionRow, selected && { backgroundColor: COURT_BLUE }]}
              >
                <Text style={[styles.optionText, { color: selected ? WHITE_LINES : colors.text }]}>
                  {c.name} ({c.surface_type || t('clubAdmin.unknownSurface')})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {!validations.court && <Text style={styles.errorText}>• {t('clubAdmin.selectCourtError')}</Text>}
    </Animatable.View>
  );

  const DatesStep = () => (
    <Animatable.View animation="fadeInUp" duration={300} style={styles.section}>
      <Text style={[styles.title, { color: colors.text }]}>{t('clubAdmin.selectDateRange')}</Text>
      <View style={styles.rowGap16}>
        <TouchableOpacity onPress={() => setShowStartDatePicker(true)} style={[styles.blockBtn, { backgroundColor: WHITE_LINES }]}>
          <Text style={[styles.blockBtnText, { color: NET_DARK }]}>
            {t('clubAdmin.start')}: {format(startDate, 'MMM dd, yyyy')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowEndDatePicker(true)} style={[styles.blockBtn, { backgroundColor: WHITE_LINES }]}>
          <Text style={[styles.blockBtnText, { color: NET_DARK }]}>
            {t('clubAdmin.end')}: {format(endDate, 'MMM dd, yyyy')}
          </Text>
        </TouchableOpacity>
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
    </Animatable.View>
  );

  // ---- Updated TimesStep with safe theme usage ----
  const TimesStep = () => {
    const durationMinutes = differenceInMinutes(endTime, startTime);

    return (
      <Animatable.View animation="fadeInUp" duration={300} style={styles.section}>
        <Text style={[styles.title, { color: colors.text }]}>{t('clubAdmin.selectTimeRange')}</Text>

        <View style={styles.timeRangeContainer}>
          <TouchableOpacity onPress={() => setShowStartTimePicker(true)} style={[styles.timeBtn, { backgroundColor: WHITE_LINES }]}>
            <Text style={styles.timeBtnLabel}>{t('clubAdmin.start')}</Text>
            <Text style={styles.timeValue}>{format(startTime, 'HH:mm')}</Text>
          </TouchableOpacity>
          <Text style={styles.timeSeparator}>—</Text>
          <TouchableOpacity onPress={() => setShowEndTimePicker(true)} style={[styles.timeBtn, { backgroundColor: WHITE_LINES }]}>
            <Text style={styles.timeBtnLabel}>{t('clubAdmin.end')}</Text>
            <Text style={styles.timeValue}>{format(endTime, 'HH:mm')}</Text>
          </TouchableOpacity>
        </View>

        {durationMinutes > 0 && (
          <Animatable.Text animation="fadeIn" style={[styles.durationText, { color: colors.muted }]}>
            {t('clubAdmin.duration')}: {Math.floor(durationMinutes / 60)}h {durationMinutes % 60 !== 0 ? `${durationMinutes % 60}m` : ''}
          </Animatable.Text>
        )}
        {!validations.times && <Text style={styles.errorText}>• {t('clubAdmin.startBeforeEndTimeError')}</Text>}

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

  // Minimal placeholders for remaining steps
  const WeekdaysStep = () => (
    <Animatable.View animation="fadeInUp" duration={300} style={styles.section}>
      <Text style={[styles.title, { color: colors.text }]}>{t('clubAdmin.selectWeekdays')}</Text>

      <View style={styles.weekdaysWrap}>
        {weekdayLabels.map(day => {
          const selected = weekdays.includes(day);
          return (
            <TouchableOpacity
              key={day}
              onPress={() => toggleWeekday(day)}
              onLongPress={selectAllWeekdays}
              style={[
                styles.weekdayChip,
                selected ? { backgroundColor: COURT_BLUE } : { backgroundColor: colors.muted }
              ]}
            >
              <Text style={[
                styles.weekdayText,
                { color: selected ? WHITE_LINES : NET_DARK }
              ]}>
                {day.substring(0, 3)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.weekdayActions}>
        <TouchableOpacity onPress={selectAllWeekdays}>
          <Text style={[styles.weekdayActionText, { color: COURT_BLUE }]}>{t('clubAdmin.selectAll')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={clearWeekdays}>
          <Text style={[styles.weekdayActionText, { color: ERROR_RED }]}>{t('clubAdmin.clearAll')}</Text>
        </TouchableOpacity>
      </View>

      {!validations.weekdays && (
        <Text style={styles.errorText}>• {t('clubAdmin.selectAtLeastOneDayError')}</Text>
      )}
    </Animatable.View>
  );
  const DescriptionStep = React.memo(function DescriptionStep({
    description = '',
    setDescription,
    validations,
    colors,
    t
  }) {
    const inputRef = useRef<TextInput>(null);
    const charCount = (description ?? '').length;
    const overLimit = charCount > 200;

    useEffect(() => {
      const timeoutId = setTimeout(() => {
        inputRef.current?.focus();
      }, 300); // give modal a moment to settle
      return () => clearTimeout(timeoutId);
    }, []);

    return (
      <KeyboardAwareScrollView
        enableOnAndroid
        keyboardOpeningTime={0}
        extraScrollHeight={80}  // push it up above keyboard
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <View style={styles.descHeaderRow}>
            <Text style={[styles.title, { color: colors.text }]}>{t('clubAdmin.eventDescription')}</Text>
            <Text style={[styles.charCount, { color: overLimit ? ERROR_RED : colors.muted }]}>
              {charCount}/200
            </Text>
          </View>

          <TextInput
            ref={inputRef}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder={t('clubAdmin.enterDescription')}
            placeholderTextColor="#999"
            style={[
              styles.textArea,
              {
                backgroundColor: WHITE_LINES,
                borderColor: overLimit ? ERROR_RED : NET_DARK + '20',
                color: colors.text
              }
            ]}
            maxLength={300}
            textAlignVertical="top"
            returnKeyType="done"
          />

          <View style={styles.quickChipsRow}>
            {[t('clubAdmin.training'), t('clubAdmin.matchPlay'), t('clubAdmin.tournament'), t('clubAdmin.teamPractice')].map(
              label => (
                <TouchableOpacity
                  key={label}
                  style={styles.quickChip}
                  onPress={() =>
                    setDescription(description.trim() ? `${description.trim()} ${label}` : label)
                  }
                >
                  <Text style={styles.quickChipText}>{label}</Text>
                </TouchableOpacity>
              )
            )}
          </View>

          {!validations.description && (
            <Text style={styles.errorText}>
              • {overLimit ? t('clubAdmin.maxChars', { count: 200 }) : t('clubAdmin.enterDescriptionError')}
            </Text>
          )}
        </View>
      </KeyboardAwareScrollView>
    );
  });

  const ReviewStep = () => {
    const court = courts.find(c => c.id === courtId);

    const durationMinutes = differenceInMinutes(endTime, startTime);
    const durationString = `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 ? ` ${durationMinutes % 60}m` : ''}`;

    return (
      <Animatable.View animation="fadeInUp" duration={300} style={styles.section}>
        <Text style={[styles.title, { color: colors.text }]}>{t('clubAdmin.reviewDetails')}</Text>

        {/* Court */}
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{t('clubAdmin.court')}</Text>
          <View style={styles.reviewContent}>
            <Text style={styles.reviewValue}>
              {court
                ? `${court.name} (${court.surface_type || t('clubAdmin.unknownSurface')})`
                : t('clubAdmin.noCourtSelected')}
            </Text>
            <TouchableOpacity onPress={() => setStepIndex(steps.indexOf('court'))}>
              <Text style={styles.reviewEdit}>{t('clubAdmin.edit')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{t('clubAdmin.dateRange')}</Text>
          <View style={styles.reviewContent}>
            <Text style={styles.reviewValue}>
              {format(startDate, 'MMM dd, yyyy')} → {format(endDate, 'MMM dd, yyyy')}
            </Text>
            <TouchableOpacity onPress={() => setStepIndex(steps.indexOf('dates'))}>
              <Text style={styles.reviewEdit}>{t('clubAdmin.edit')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Times */}
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{t('clubAdmin.timeRange')}</Text>
          <View style={styles.reviewContent}>
            <Text style={styles.reviewValue}>
              {format(startTime, 'HH:mm')} → {format(endTime, 'HH:mm')} ({durationString})
            </Text>
            <TouchableOpacity onPress={() => setStepIndex(steps.indexOf('times'))}>
              <Text style={styles.reviewEdit}>{t('clubAdmin.edit')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Weekdays */}
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{t('clubAdmin.weekdays')}</Text>
          <View style={styles.reviewContent}>
            <Text style={styles.reviewValue}>
              {weekdays.length > 0 ? weekdays.map(d => d.substring(0, 3)).join(', ') : t('clubAdmin.noneSelected')}
            </Text>
            <TouchableOpacity onPress={() => setStepIndex(steps.indexOf('weekdays'))}>
              <Text style={styles.reviewEdit}>{t('clubAdmin.edit')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Description */}
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{t('clubAdmin.description')}</Text>
          <View style={styles.reviewContentColumn}>
            <Text style={styles.reviewValue}>{description || t('clubAdmin.noDescription')}</Text>
            <TouchableOpacity onPress={() => setStepIndex(steps.indexOf('description'))}>
              <Text style={styles.reviewEdit}>{t('clubAdmin.edit')}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
        <KeyboardAwareScrollView
          enableOnAndroid
          keyboardOpeningTime={0}
          extraScrollHeight={80} // space above keyboard
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 150, flexGrow: 1 }}
        >
          <DescriptionStep
            description={description}
            setDescription={setDescription}
            validations={validations}
            colors={colors}
            t={t}
          />
        </KeyboardAwareScrollView>
      );
      case 'review':
        return <ReviewStep />;
    }
  };

  return (
    <Modal isVisible={visible} onBackdropPress={onClose} style={styles.modal} swipeDirection="down" onSwipeComplete={onClose}>
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View style={styles.handle} />
        <View style={styles.stepDots}>
          {steps.map((_, i) => {
            const isActive = i === stepIndex;
            const isCompleted = i < stepIndex;
            const canJumpForward =
              i > stepIndex && steps.slice(0, i).every((s) => stepIsValid(s));

            const isClickable = isCompleted || canJumpForward;

            const Dot = (
              <View
                style={[
                  styles.dot,
                  isActive && styles.dotActive,
                  isCompleted && { backgroundColor: COURT_BLUE },
                  !isActive && !isCompleted && { backgroundColor: '#DFE4EA' },
                ]}
              />
            );

            return (
              <TouchableOpacity
                key={i}
                disabled={!isClickable}
                onPress={() => {
                  if (isClickable) setStepIndex(i);
                }}
                activeOpacity={0.7}
              >
                {isActive ? (
                  <Animatable.View
                    animation="pulse"
                    easing="ease-out"
                    iterationCount="infinite"
                    duration={1200}
                    style={styles.dotActiveWrap}
                  >
                    {Dot}
                  </Animatable.View>
                ) : (
                  Dot
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {renderStep()}
        </ScrollView>
        <View style={styles.bottomBar}>
          {stepIndex > 0 ? (
            <TouchableOpacity style={styles.backBtn} onPress={back}>
              <Text style={[styles.backText, { color: NET_DARK }]}>{t('clubAdmin.back')}</Text>
            </TouchableOpacity>
          ) : (<View style={{ width: 96 }} />)}

          {stepIndex < steps.length - 1 ? (
            <LinearGradient colors={[ACE_GREEN, '#3B9E40']} style={[styles.ctaBtn, !canGoNext && { opacity: 0.5 }]}>
              <TouchableOpacity onPress={next} disabled={!canGoNext} style={styles.ctaInner}>
                <Text style={styles.ctaText}>{t('clubAdmin.next')}</Text>
              </TouchableOpacity>
            </LinearGradient>
          ) : (
            <LinearGradient colors={[ACE_GREEN, '#3B9E40']} style={[styles.ctaBtn, submitting && { opacity: 0.6 }]}>
              <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={styles.ctaInner}>
                {submitting ? <ActivityIndicator size="small" color={WHITE_LINES} /> : <Text style={styles.ctaText}>{t('clubAdmin.createRecurring')}</Text>}
              </TouchableOpacity>
            </LinearGradient>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: { justifyContent: 'flex-end', margin: 0 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 16, maxHeight: Dimensions.get('window').height * 0.92 },
  handle: { width: 56, height: 6, borderRadius: 3, backgroundColor: '#CBD3DC', alignSelf: 'center', marginVertical: 8 },
  stepDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3
  },
  dotActive: {
    backgroundColor: COURT_BLUE,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotActiveWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: { paddingVertical: 12 },
  title: { fontSize: 20, fontFamily: 'Inter-Bold', marginBottom: 12 },
  body: { fontSize: 16, fontFamily: 'Inter-Regular' },
  listCol: { gap: 10 },
  optionRow: { padding: 14, borderRadius: 12, backgroundColor: '#F3F5F7' },
  optionText: { fontSize: 16, fontFamily: 'Inter-Medium' },
  rowGap16: { gap: 16 },
  blockBtn: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12 },
  blockBtnText: { fontSize: 16, fontFamily: 'Inter-Medium' },
  ghostBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E3E7ED' },
  ghostText: { fontSize: 14, fontFamily: 'Inter-Medium' },
  errorText: { color: ERROR_RED, marginTop: 8, fontFamily: 'Inter-Regular', fontSize: 14 },

  // TimeStep
  timeRangeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8, marginTop: 4 },
  timeBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
  timeBtnLabel: { fontSize: 14, fontFamily: 'Inter-Medium', color: NET_DARK },
  timeValue: { fontSize: 20, fontFamily: 'Inter-Bold', color: NET_DARK, marginTop: 4 },
  timeSeparator: { fontSize: 22, fontFamily: 'Inter-Bold', color: NET_DARK, marginHorizontal: 8 },
  durationText: { fontSize: 14, fontFamily: 'Inter-Medium' },

  // WeekdaysStep
  weekdaysWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8
  },
  weekdayChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center'
  },
  weekdayText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium'
  },
  weekdayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12
  },
  weekdayActionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium'
  },
  // ---- DescriptionStep styles ----
  descHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  charCount: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  quickChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F0F2F5',
    borderRadius: 999,
  },
  quickChipText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: NET_DARK,
  },
  // ---- ReviewStep styles ----
  reviewRow: {
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E3E7ED',
    paddingBottom: 8,
  },
  reviewLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: NET_DARK,
    marginBottom: 4,
  },
  reviewContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewContentColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  reviewValue: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: NET_DARK,
  },
  reviewEdit: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COURT_BLUE,
  },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flexDirection: 'row', gap: 12 },
  backBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: WHITE_LINES },
  backText: { fontSize: 16, fontFamily: 'Inter-Medium' },
  ctaBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  ctaInner: { paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: WHITE_LINES, fontSize: 16, fontFamily: 'Inter-Medium' },
  emptyWrap: { gap: 12 },

  
  });

export default RecurringEventBottomSheet;