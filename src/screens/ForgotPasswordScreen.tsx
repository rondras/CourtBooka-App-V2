import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableWithoutFeedback, 
  Keyboard,
  Pressable,
  Dimensions,
  ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../App';
import { forgotPassword } from '../api/api';
import { Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { COLORS, SPACING } from '../constants/colors';

const { width } = Dimensions.get('window');

const ForgotPasswordScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [currentStep, setCurrentStep] = useState<'input' | 'sent' | 'success'>('input');

  const emailInputRef = useRef<TextInput>(null);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const errorShake = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const iconRotation = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const checkmarkProgress = useRef(new Animated.Value(0)).current;
  const emailSentAnim = useRef(new Animated.Value(0)).current;

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Start pulse animation for the lock icon
    const createPulse = () => {
      if (currentStep === 'input') {
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]).start(() => createPulse());
      }
    };
    createPulse();

    // Focus email input after animation
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 800);
  }, [currentStep]);

  // Error animation
  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(errorShake, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(errorShake, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(errorShake, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(errorShake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      ReactNativeHapticFeedback.trigger('notificationWarning');
    }
  }, [error]);

  // Success animation
  useEffect(() => {
    if (success) {
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          tension: 20,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.timing(checkmarkProgress, {
          toValue: 1,
          duration: 600,
          delay: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Email sent animation
      Animated.sequence([
        Animated.timing(emailSentAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(iconRotation, {
              toValue: 0.1,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(iconRotation, {
              toValue: -0.1,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(iconRotation, {
              toValue: 0,
              duration: 100,
              useNativeDriver: true,
            }),
          ]),
          { iterations: 3 }
        ),
      ]).start();
    }
  }, [success]);

  const validateEmail = useCallback((text: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!text) {
      setEmailError('');
    } else if (!emailRegex.test(text)) {
      setEmailError(t('forgotPassword.errorInvalidEmail'));
    } else {
      setEmailError('');
    }
    setEmail(text);
  }, [t]);

  const handleSubmit = useCallback(async () => {
    if (!email) {
      setEmailError(t('forgotPassword.errorEmailRequired'));
      ReactNativeHapticFeedback.trigger('notificationWarning');
      return;
    }
    
    if (emailError) {
      ReactNativeHapticFeedback.trigger('notificationWarning');
      return;
    }

    setError('');
    setLoading(true);
    setAttemptCount(prev => prev + 1);
    
    // Button animation
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    
    ReactNativeHapticFeedback.trigger('impactLight');
    
    try {
      await forgotPassword(email);
      
      setSuccess(true);
      setCurrentStep('sent');
      ReactNativeHapticFeedback.trigger('notificationSuccess');
      
      Toast.show({
        type: 'success',
        text1: t('forgotPassword.success'),
        text2: t('forgotPassword.successMessage'),
        visibilityTime: 4000,
      });
      
      // Set cooldown for resend
      setResendCooldown(60);
      
    } catch (err: any) {
      ReactNativeHapticFeedback.trigger('notificationError');
      const msg = err.response?.data?.error || t('forgotPassword.error');
      setError(msg);
      
      if (attemptCount >= 2) {
        Alert.alert(
          t('forgotPassword.multipleAttemptsTitle'),
          t('forgotPassword.multipleAttemptsMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { 
              text: t('forgotPassword.contactSupport'), 
              onPress: () => {
                Alert.alert(
                  t('forgotPassword.supportTitle'),
                  t('forgotPassword.supportMessage')
                );
              }
            }
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  }, [email, emailError, attemptCount, t]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;
    
    ReactNativeHapticFeedback.trigger('impactLight');
    setLoading(true);
    setError('');
    
    try {
      await forgotPassword(email);
      
      ReactNativeHapticFeedback.trigger('notificationSuccess');
      Toast.show({
        type: 'success',
        text1: t('forgotPassword.resendSuccess'),
        text2: t('forgotPassword.resendSuccessMessage'),
      });
      
      setResendCooldown(60);
    } catch (err) {
      ReactNativeHapticFeedback.trigger('notificationError');
      Alert.alert(t('error'), t('forgotPassword.resendError'));
    } finally {
      setLoading(false);
    }
  }, [email, resendCooldown, t]);

  const handleBackToLogin = () => {
    ReactNativeHapticFeedback.trigger('selection');
    navigation.navigate('Login');
  };

  const handleOpenEmail = () => {
    ReactNativeHapticFeedback.trigger('impactLight');
    Alert.alert(
      t('forgotPassword.openEmailTitle'),
      t('forgotPassword.openEmailMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('forgotPassword.openEmailApp'), onPress: () => {
          // In a real app, you would open the default email app here
          Toast.show({
            type: 'info',
            text1: t('forgotPassword.checkEmail'),
          });
        }}
      ]
    );
  };

  const getStepIcon = () => {
    switch (currentStep) {
      case 'sent':
        return 'mail-outline';
      case 'success':
        return 'check-circle';
      default:
        return 'lock-outline';
    }
  };

  const getStepColor = () => {
    switch (currentStep) {
      case 'sent':
        return COLORS.courtBlue;
      case 'success':
        return COLORS.aceGreen;
      default:
        return COLORS.courtBlue;
    }
  };

  const dismissKeyboard = () => Keyboard.dismiss();

  const styles = createStyles(colors);

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        keyboardVerticalOffset={0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={[
              styles.contentContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Back Button */}
            <Animatable.View animation="fadeIn" delay={200} style={styles.backButtonContainer}>
              <TouchableOpacity
                onPress={handleBackToLogin}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="arrow-back" size={24} color={COLORS.netDark} />
                <Text style={styles.backButtonText}>{t('common.back')}</Text>
              </TouchableOpacity>
            </Animatable.View>

            {/* Header Section */}
            <View style={styles.headerSection}>
              <Animatable.View 
                animation="bounceIn" 
                duration={1200}
                style={styles.iconContainer}
              >
                <Animated.View
                  style={{
                    transform: [
                      { scale: currentStep === 'input' ? pulseAnim : 1 },
                      {
                        rotate: currentStep === 'sent' ? iconRotation.interpolate({
                          inputRange: [-0.1, 0.1],
                          outputRange: ['-10deg', '10deg'],
                        }) : '0deg'
                      }
                    ]
                  }}
                >
                  <View style={[
                    styles.iconCircle,
                    { backgroundColor: currentStep === 'sent' ? COLORS.courtBlueLight : COLORS.courtBlueLight }
                  ]}>
                    <Icon 
                      name={getStepIcon()} 
                      size={48} 
                      color={getStepColor()} 
                    />
                    {currentStep === 'sent' && (
                      <Animated.View 
                        style={[
                          styles.emailSentBadge,
                          { 
                            transform: [{ scale: emailSentAnim }],
                            opacity: emailSentAnim,
                          }
                        ]}
                      >
                        <Icon name="send" size={16} color={COLORS.whiteLines} />
                      </Animated.View>
                    )}
                  </View>
                </Animated.View>
              </Animatable.View>

              <Animatable.Image
                animation="fadeIn"
                delay={300}
                source={require('../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              
              <Animatable.View animation="fadeIn" delay={400} style={styles.titleContainer}>
                <Text style={styles.title}>
                  {currentStep === 'sent' 
                    ? t('forgotPassword.emailSentTitle')
                    : t('forgotPassword.title')
                  }
                </Text>
                <Text style={styles.subtitle}>
                  {currentStep === 'sent'
                    ? t('forgotPassword.emailSentSubtitle', { email })
                    : t('forgotPassword.subtitle')
                  }
                </Text>
              </Animatable.View>
            </View>

            {/* Progress Steps */}
            <Animatable.View animation="fadeIn" delay={500} style={styles.stepsContainer}>
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  styles.stepActive,
                ]}>
                  <Text style={styles.stepNumber}>1</Text>
                </View>
                <Text style={[styles.stepLabel, styles.stepLabelActive]}>
                  {t('forgotPassword.stepEnterEmail')}
                </Text>
              </View>
              
              <View style={[styles.stepLine, currentStep !== 'input' && styles.stepLineActive]} />
              
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  currentStep !== 'input' && styles.stepActive,
                ]}>
                  {currentStep === 'sent' ? (
                    <Icon name="check" size={16} color={COLORS.whiteLines} />
                  ) : (
                    <Text style={styles.stepNumber}>2</Text>
                  )}
                </View>
                <Text style={[
                  styles.stepLabel,
                  currentStep !== 'input' && styles.stepLabelActive
                ]}>
                  {t('forgotPassword.stepCheckEmail')}
                </Text>
              </View>
              
              <View style={[styles.stepLine, currentStep === 'success' && styles.stepLineActive]} />
              
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  currentStep === 'success' && styles.stepActive,
                ]}>
                  <Text style={styles.stepNumber}>3</Text>
                </View>
                <Text style={[
                  styles.stepLabel,
                  currentStep === 'success' && styles.stepLabelActive
                ]}>
                  {t('forgotPassword.stepResetPassword')}
                </Text>
              </View>
            </Animatable.View>

            {/* Error Message */}
            {error && (
              <Animated.View 
                style={[
                  styles.errorContainer,
                  { transform: [{ translateX: errorShake }] }
                ]}
              >
                <Icon name="warning" size={18} color={COLORS.whiteLines} />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            )}

            {/* Input Section */}
            {currentStep === 'input' && (
              <Animatable.View animation="fadeInUp" delay={600} style={styles.inputSection}>
                <View style={styles.inputLabelContainer}>
                  <Icon name="email" size={16} color={COLORS.grayMedium} />
                  <Text style={styles.inputLabel}>
                    {t('forgotPassword.emailLabel')}
                  </Text>
                </View>
                
                <View style={[
                  styles.inputContainer,
                  emailFocused && styles.inputFocused,
                  emailError && styles.inputError,
                  email && !emailError && styles.inputSuccess,
                ]}>
                  <Icon 
                    name="email" 
                    size={20} 
                    color={
                      emailError ? COLORS.error :
                      email && !emailError ? COLORS.aceGreen :
                      emailFocused ? COLORS.courtBlue : 
                      COLORS.grayMedium
                    } 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={emailInputRef}
                    style={styles.input}
                    value={email}
                    onChangeText={validateEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder={t('forgotPassword.emailPlaceholder')}
                    placeholderTextColor={COLORS.grayMedium}
                    accessibilityLabel={t('forgotPassword.emailPlaceholder')}
                    autoCorrect={false}
                    editable={!loading && !success}
                  />
                  {email && !emailError && (
                    <Animatable.View animation="bounceIn">
                      <Icon name="check-circle" size={20} color={COLORS.aceGreen} />
                    </Animatable.View>
                  )}
                  {emailError && (
                    <Animatable.View animation="shake">
                      <Icon name="error-outline" size={20} color={COLORS.error} />
                    </Animatable.View>
                  )}
                </View>
                
                {emailError && (
                  <Animatable.Text animation="fadeIn" style={styles.fieldError}>
                    {emailError}
                  </Animatable.Text>
                )}
                
                <Text style={styles.helpText}>
                  {t('forgotPassword.emailHelpText')}
                </Text>
              </Animatable.View>
            )}

            {/* Email Sent Section */}
            {currentStep === 'sent' && (
              <Animatable.View animation="fadeIn" style={styles.successContent}>
                <Animated.View 
                  style={[
                    styles.successCard,
                    { transform: [{ scale: successScale }] }
                  ]}
                >
                  <Icon name="mark-email-read" size={48} color={COLORS.courtBlue} />
                  <Text style={styles.successTitle}>
                    {t('forgotPassword.checkYourInbox')}
                  </Text>
                  <Text style={styles.successEmail}>{email}</Text>
                  <Text style={styles.successMessage}>
                    {t('forgotPassword.emailSentDescription')}
                  </Text>
                  
                  <View style={styles.successActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.button,
                        styles.primaryButton,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={handleOpenEmail}
                    >
                      <View style={styles.buttonContent}>
                        <Icon name="email" size={20} color={COLORS.whiteLines} />
                        <Text style={styles.buttonText}>
                          {t('forgotPassword.openEmail')}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </Animated.View>

                {/* Tips Section */}
                <View style={styles.tipsCard}>
                  <Text style={styles.tipsTitle}>
                    {t('forgotPassword.tipsTitle')}
                  </Text>
                  <View style={styles.tipItem}>
                    <Icon name="folder" size={16} color={COLORS.grayMedium} />
                    <Text style={styles.tipText}>
                      {t('forgotPassword.tip1')}
                    </Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Icon name="refresh" size={16} color={COLORS.grayMedium} />
                    <Text style={styles.tipText}>
                      {t('forgotPassword.tip2')}
                    </Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Icon name="schedule" size={16} color={COLORS.grayMedium} />
                    <Text style={styles.tipText}>
                      {t('forgotPassword.tip3')}
                    </Text>
                  </View>
                </View>
              </Animatable.View>
            )}

            {/* Action Buttons */}
            {currentStep === 'input' && (
              <Animatable.View animation="fadeInUp" delay={700} style={styles.buttonSection}>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                    (loading || !email || emailError) && styles.buttonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading || !email || !!emailError}
                  accessibilityLabel={t('forgotPassword.sendButton')}
                >
                  <Animated.View 
                    style={[
                      styles.buttonContent,
                      { transform: [{ scale: buttonScale }] }
                    ]}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={COLORS.whiteLines} />
                    ) : (
                      <>
                        <Icon name="send" size={20} color={COLORS.whiteLines} />
                        <Text style={styles.buttonText}>
                          {t('forgotPassword.sendButton')}
                        </Text>
                      </>
                    )}
                  </Animated.View>
                </Pressable>
              </Animatable.View>
            )}

            {/* Resend Section */}
            {currentStep === 'sent' && (
              <Animatable.View animation="fadeIn" style={styles.resendSection}>
                <Text style={styles.resendText}>
                  {t('forgotPassword.didntReceive')}
                </Text>
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={loading || resendCooldown > 0}
                  style={[
                    styles.resendButton,
                    (loading || resendCooldown > 0) && styles.resendButtonDisabled
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={COLORS.courtBlue} />
                  ) : (
                    <Text style={[
                      styles.resendButtonText,
                      resendCooldown > 0 && styles.resendButtonTextDisabled
                    ]}>
                      {resendCooldown > 0 
                        ? t('forgotPassword.resendIn', { seconds: resendCooldown })
                        : t('forgotPassword.resend')
                      }
                    </Text>
                  )}
                </TouchableOpacity>
              </Animatable.View>
            )}

            {/* Footer */}
            <Animatable.View animation="fadeIn" delay={800} style={styles.footer}>
              <TouchableOpacity
                onPress={handleBackToLogin}
                style={styles.footerLink}
              >
                <Icon name="arrow-back" size={16} color={COLORS.grayMedium} />
                <Text style={styles.footerLinkText}>
                  {t('forgotPassword.backToLogin')}
                </Text>
              </TouchableOpacity>
              
              <View style={styles.footerDivider} />
              
              <TouchableOpacity
                onPress={() => {
                  ReactNativeHapticFeedback.trigger('selection');
                  Alert.alert(
                    t('forgotPassword.helpTitle'),
                    t('forgotPassword.helpMessage'),
                    [{ text: t('common.ok') }]
                  );
                }}
                style={styles.footerLink}
              >
                <Icon name="help-outline" size={16} color={COLORS.grayMedium} />
                <Text style={styles.footerLinkText}>
                  {t('forgotPassword.needHelp')}
                </Text>
              </TouchableOpacity>
            </Animatable.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.grayLight,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: SPACING.xl,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  backButtonContainer: {
    marginBottom: SPACING.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    marginLeft: -SPACING.sm,
  },
  backButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: COLORS.netDark,
    marginLeft: SPACING.xs,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  iconContainer: {
    marginBottom: SPACING.lg,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.courtBlueLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.courtBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    position: 'relative',
  },
  emailSentBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.aceGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.aceGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  logo: {
    width: width * 0.25,
    height: width * 0.25,
    marginBottom: SPACING.lg,
    opacity: 0.2,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
    marginBottom: SPACING.sm,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.lg,
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xxl,
    paddingHorizontal: SPACING.md,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.grayBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  stepActive: {
    backgroundColor: COLORS.courtBlue,
  },
  stepNumber: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.whiteLines,
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: COLORS.netDark,
    fontFamily: 'Inter-Medium',
  },
  stepLine: {
    height: 2,
    backgroundColor: COLORS.grayBorder,
    flex: 0.3,
    marginBottom: SPACING.lg,
  },
  stepLineActive: {
    backgroundColor: COLORS.courtBlue,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    borderRadius: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.whiteLines,
    marginLeft: SPACING.sm,
    flex: 1,
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: SPACING.xl,
  },
  inputLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.netDark,
    marginLeft: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.whiteLines,
    borderRadius: SPACING.md,
    paddingHorizontal: SPACING.lg,
    height: 56,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  inputFocused: {
    borderColor: COLORS.courtBlue,
    shadowColor: COLORS.courtBlue,
    shadowOpacity: 0.15,
    elevation: 4,
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: '#FFF5F5',
  },
  inputSuccess: {
    borderColor: COLORS.aceGreen,
  },
  inputIcon: {
    marginRight: SPACING.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: COLORS.netDark,
    lineHeight: 24,
  },
  fieldError: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: COLORS.error,
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  helpText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  successContent: {
    marginBottom: SPACING.xl,
    alignItems: 'center',
  },
  successCard: {
    backgroundColor: COLORS.whiteLines,
    borderRadius: SPACING.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: SPACING.lg,
  },
  successTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  successEmail: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.courtBlue,
    marginBottom: SPACING.md,
  },
  successMessage: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  successActions: {
    width: '100%',
    gap: SPACING.md,
  },
  tipsCard: {
    backgroundColor: COLORS.courtBlueLight,
    borderRadius: SPACING.md,
    padding: SPACING.lg,
    width: '100%',
  },
  tipsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.netDark,
    marginBottom: SPACING.md,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  tipText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    marginLeft: SPACING.sm,
    flex: 1,
    lineHeight: 18,
  },
  buttonSection: {
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  button: {
    borderRadius: SPACING.md,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButton: {
    backgroundColor: COLORS.courtBlue,
    shadowColor: COLORS.courtBlue,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: COLORS.whiteLines,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  resendSection: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  resendText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    marginBottom: SPACING.sm,
  },
  resendButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.courtBlue,
    textDecorationLine: 'underline',
  },
  resendButtonTextDisabled: {
    color: COLORS.grayMedium,
    textDecorationLine: 'none',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACING.xl,
    marginTop: 'auto',
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  footerLinkText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: COLORS.grayMedium,
  },
  footerDivider: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.grayBorder,
    marginHorizontal: SPACING.md,
  },
});

export default ForgotPasswordScreen;