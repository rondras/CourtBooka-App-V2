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
  ScrollView, 
  Platform, 
  TouchableWithoutFeedback, 
  Keyboard,
  Pressable,
  Dimensions,
} from 'react-native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../App';
import { API_BASE_URL } from '@env';
import { Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { COLORS, SPACING } from '../constants/colors';

const { width } = Dimensions.get('window');

const VerifyEmailScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const initialToken = route.params?.token || '';

  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(!!initialToken);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [tokenFocused, setTokenFocused] = useState(false);
  const [verificationAttempts, setVerificationAttempts] = useState(0);

  const tokenInputRef = useRef<TextInput>(null);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const errorShake = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const iconRotation = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Cooldown timer for resend button
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

    // Start pulse animation for the email icon
    const createPulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => createPulse());
    };
    createPulse();
  }, []);

  // Auto-verify if token provided in route
  useEffect(() => {
    console.log('VerifyEmailScreen mounted with initialToken:', initialToken);
    if (initialToken) {
      handleVerify();
    } else {
      setTimeout(() => {
        tokenInputRef.current?.focus();
      }, 500);
    }
  }, [initialToken]);

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
        Animated.timing(progressWidth, {
          toValue: 100,
          duration: 2000,
          useNativeDriver: false,
        }),
      ]).start();
      
      // Start rotation animation for success icon
      Animated.loop(
        Animated.timing(iconRotation, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [success]);

  const handleVerify = useCallback(async () => {
    if (!token || token.length < 6) {
      setError(t('verifyEmail.errorTokenRequired'));
      ReactNativeHapticFeedback.trigger('notificationWarning');
      return;
    }
    
    setError('');
    setLoading(true);
    setVerificationAttempts(prev => prev + 1);
    
    // Button animation
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    
    ReactNativeHapticFeedback.trigger('impactLight');
    
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-email`, { token });
      console.log('Verification API response:', response.data);
      
      setSuccess(true);
      ReactNativeHapticFeedback.trigger('notificationSuccess');
      
      Toast.show({ 
        type: 'success', 
        text1: t('verifyEmail.success'), 
        text2: t('verifyEmail.successWithRedirect'),
        visibilityTime: 2000,
      });
      
      setTimeout(() => {
        navigation.navigate('Login');
      }, 2500);
    } catch (err: any) {
      console.error('Verification API error:', err.response?.data || err.message);
      const msg = err.response?.data?.error || t('verifyEmail.errorInvalidToken');
      setError(msg);
      ReactNativeHapticFeedback.trigger('notificationError');
      
      if (verificationAttempts >= 2) {
        Alert.alert(
          t('verifyEmail.multipleAttemptsTitle'),
          t('verifyEmail.multipleAttemptsMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('verifyEmail.resend'), onPress: handleResend }
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  }, [token, navigation, t, verificationAttempts]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;
    
    ReactNativeHapticFeedback.trigger('impactLight');
    setResendLoading(true);
    setError('');
    
    try {
      // Simulated resend API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      ReactNativeHapticFeedback.trigger('notificationSuccess');
      Toast.show({
        type: 'success',
        text1: t('verifyEmail.resendSuccess'),
        text2: t('verifyEmail.resendSuccessMessage'),
      });
      
      setResendCooldown(60); // 60 second cooldown
      setVerificationAttempts(0); // Reset attempts
    } catch (err) {
      ReactNativeHapticFeedback.trigger('notificationError');
      Alert.alert(t('error'), t('verifyEmail.resendError'));
    } finally {
      setResendLoading(false);
    }
  }, [t, resendCooldown]);

  const formatToken = (text: string) => {
    // Auto-format token as user types (e.g., XXX-XXX)
    const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`;
  };

  const handleTokenChange = (text: string) => {
    const formatted = formatToken(text);
    setToken(formatted);
    
    // Auto-submit if token reaches expected length
    if (formatted.replace('-', '').length === 6) {
      Keyboard.dismiss();
      setTimeout(() => handleVerify(), 300);
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
                      { scale: pulseAnim },
                      {
                        rotate: success ? iconRotation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }) : '0deg'
                      }
                    ]
                  }}
                >
                  <View style={[
                    styles.iconCircle,
                    success && styles.iconCircleSuccess
                  ]}>
                    <Icon 
                      name={success ? "check-circle" : "mail-outline"} 
                      size={48} 
                      color={success ? COLORS.aceGreen : COLORS.courtBlue} 
                    />
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
                  {success ? t('verifyEmail.successTitle') : t('verifyEmail.title')}
                </Text>
                <Text style={styles.tagline}>
                  {t('verifyEmail.tagline')}
                </Text>
                <Text style={styles.subtitle}>
                  {success ? t('verifyEmail.successMessage') : t('verifyEmail.subtitle')}
                </Text>
              </Animatable.View>
            </View>

            {/* Progress Bar for Success */}
            {success && (
              <Animatable.View animation="fadeIn" style={styles.progressContainer}>
                <View style={styles.progressBarBackground}>
                  <Animated.View 
                    style={[
                      styles.progressBar,
                      {
                        width: progressWidth.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.redirectText}>
                  {t('verifyEmail.redirecting')}
                </Text>
              </Animatable.View>
            )}

            {/* Error Message */}
            {error && !success && (
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

            {/* Token Input Section */}
            {!success && (
              <Animatable.View animation="fadeInUp" delay={500} style={styles.inputSection}>
                <View style={styles.inputLabelContainer}>
                  <Icon name="vpn-key" size={16} color={COLORS.grayMedium} />
                  <Text style={styles.inputLabel}>
                    {t('verifyEmail.enterCode')}
                  </Text>
                </View>
                
                <View style={[
                  styles.inputContainer,
                  tokenFocused && styles.inputFocused,
                  error && styles.inputError,
                  token.length >= 7 && styles.inputSuccess,
                ]}>
                  <TextInput
                    ref={tokenInputRef}
                    style={styles.input}
                    value={token}
                    onChangeText={handleTokenChange}
                    onFocus={() => setTokenFocused(true)}
                    onBlur={() => setTokenFocused(false)}
                    placeholder={t('verifyEmail.tokenPlaceholder')}
                    placeholderTextColor={COLORS.grayMedium}
                    accessibilityLabel={t('verifyEmail.tokenPlaceholder')}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={7} // XXX-XXX format
                    textAlign="center"
                    keyboardType="default"
                    editable={!loading && !success}
                  />
                  {token.length >= 7 && !error && (
                    <Animatable.View 
                      animation="bounceIn" 
                      style={styles.validIcon}
                    >
                      <Icon name="check-circle" size={20} color={COLORS.aceGreen} />
                    </Animatable.View>
                  )}
                </View>
                
                <Text style={styles.helpText}>
                  {t('verifyEmail.codeFormat')}
                </Text>
              </Animatable.View>
            )}

            {/* Action Buttons */}
            {!success && (
              <Animatable.View animation="fadeInUp" delay={600} style={styles.buttonSection}>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={handleVerify}
                  disabled={loading || success}
                  accessibilityLabel={t('verifyEmail.verifyButton')}
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
                        <Icon name="verified" size={20} color={COLORS.whiteLines} />
                        <Text style={styles.buttonText}>
                          {t('verifyEmail.verifyButton')}
                        </Text>
                      </>
                    )}
                  </Animated.View>
                </Pressable>

                {error && verificationAttempts > 0 && (
                  <Animatable.View animation="fadeIn">
                    <Pressable
                      style={({ pressed }) => [
                        styles.button,
                        styles.secondaryButton,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={handleVerify}
                      disabled={loading}
                    >
                      <View style={styles.buttonContent}>
                        <Icon name="refresh" size={20} color={COLORS.courtBlue} />
                        <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                          {t('verifyEmail.retryButton')}
                        </Text>
                      </View>
                    </Pressable>
                  </Animatable.View>
                )}
              </Animatable.View>
            )}

            {/* Success Content */}
            {success && (
              <Animatable.View 
                animation="fadeInUp" 
                style={styles.successContent}
              >
                <Animated.View 
                  style={[
                    styles.successCard,
                    { transform: [{ scale: successScale }] }
                  ]}
                >
                  <Icon name="celebration" size={32} color={COLORS.aceGreen} />
                  <Text style={styles.successTitle}>
                    {t('verifyEmail.congratulations')}
                  </Text>
                  <Text style={styles.successMessage}>
                    {t('verifyEmail.accountVerified')}
                  </Text>
                </Animated.View>
              </Animatable.View>
            )}

            {/* Resend Section */}
            {!success && (
              <Animatable.View animation="fadeIn" delay={700} style={styles.resendSection}>
                <Text style={styles.resendText}>
                  {t('verifyEmail.didntReceive')}
                </Text>
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={resendLoading || resendCooldown > 0}
                  style={[
                    styles.resendButton,
                    (resendLoading || resendCooldown > 0) && styles.resendButtonDisabled
                  ]}
                >
                  {resendLoading ? (
                    <ActivityIndicator size="small" color={COLORS.courtBlue} />
                  ) : (
                    <Text style={[
                      styles.resendButtonText,
                      resendCooldown > 0 && styles.resendButtonTextDisabled
                    ]}>
                      {resendCooldown > 0 
                        ? t('verifyEmail.resendIn', { seconds: resendCooldown })
                        : t('verifyEmail.resend')
                      }
                    </Text>
                  )}
                </TouchableOpacity>
              </Animatable.View>
            )}

            {/* Footer Links */}
            <Animatable.View animation="fadeIn" delay={800} style={styles.footer}>
              <TouchableOpacity
                onPress={() => {
                  ReactNativeHapticFeedback.trigger('selection');
                  navigation.navigate('Login');
                }}
                style={styles.footerLink}
              >
                <Icon name="arrow-back" size={16} color={COLORS.grayMedium} />
                <Text style={styles.footerLinkText}>
                  {t('verifyEmail.backToLogin')}
                </Text>
              </TouchableOpacity>
              
              <View style={styles.footerDivider} />
              
              <TouchableOpacity
                onPress={() => {
                  ReactNativeHapticFeedback.trigger('selection');
                  Alert.alert(
                    t('verifyEmail.helpTitle'),
                    t('verifyEmail.helpMessage'),
                    [{ text: t('common.ok') }]
                  );
                }}
                style={styles.footerLink}
              >
                <Icon name="help-outline" size={16} color={COLORS.grayMedium} />
                <Text style={styles.footerLinkText}>
                  {t('verifyEmail.needHelp')}
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
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
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
  },
  iconCircleSuccess: {
    backgroundColor: '#E8F5E9',
    shadowColor: COLORS.aceGreen,
  },
  logo: {
    width: width * 0.3,
    height: width * 0.3,
    marginBottom: SPACING.lg,
    opacity: 0.3,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
    marginBottom: SPACING.sm,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: COLORS.courtBlue,
    marginBottom: SPACING.sm,
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
  progressContainer: {
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.xl,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: COLORS.grayBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.aceGreen,
    borderRadius: 3,
  },
  redirectText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: COLORS.aceGreen,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    borderRadius: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
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
    backgroundColor: COLORS.whiteLines,
    borderRadius: SPACING.md,
    height: 56,
    paddingHorizontal: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
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
  input: {
    flex: 1,
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
    letterSpacing: 4,
  },
  validIcon: {
    position: 'absolute',
    right: SPACING.lg,
  },
  helpText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  buttonSection: {
    marginBottom: SPACING.xl,
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
  secondaryButton: {
    backgroundColor: COLORS.whiteLines,
    borderWidth: 2,
    borderColor: COLORS.courtBlue,
    shadowColor: COLORS.shadow,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.7,
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
  secondaryButtonText: {
    color: COLORS.courtBlue,
  },
  successContent: {
    marginBottom: SPACING.xxl,
    alignItems: 'center',
  },
  successCard: {
    backgroundColor: COLORS.whiteLines,
    borderRadius: SPACING.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
    shadowColor: COLORS.aceGreen,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 2,
    borderColor: COLORS.aceGreen,
  },
  successTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: COLORS.aceGreen,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  successMessage: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    textAlign: 'center',
    lineHeight: 20,
  },
  resendSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
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
    paddingTop: SPACING.lg,
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

export default VerifyEmailScreen;