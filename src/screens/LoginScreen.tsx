import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
  Keyboard,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../../App';
import Toast from 'react-native-toast-message';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { COLORS, SPACING } from '../constants/colors';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

const { height, width } = Dimensions.get('window');

const LoginScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const { login, error: authError, setError: setAuthError, savedEmail, isAuthenticated, loadPassword } = useAuth();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  
  // Animation refs
  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const errorShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
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
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('MainTabs');
    }
  }, [isAuthenticated, navigation]);

  useEffect(() => {
    if (savedEmail) {
      setEmail(savedEmail);
      loadStoredPassword(savedEmail);
    }
  }, [savedEmail]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (error || authError || emailError) {
      // Shake animation for errors
      Animated.sequence([
        Animated.timing(errorShake, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(errorShake, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(errorShake, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(errorShake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      ReactNativeHapticFeedback.trigger('notificationWarning');
    }
  }, [error, authError, emailError]);

  const keyboardOffset = Platform.OS === 'ios' ? keyboardHeight + 20 : keyboardHeight;

  const loadStoredPassword = useCallback(async (emailToCheck: string) => {
    if (emailToCheck) {
      try {
        const storedPassword = await loadPassword(emailToCheck);
        if (storedPassword) {
          setPassword(storedPassword);
        } else {
          setPassword('');
        }
      } catch (err) {
        console.warn('Failed to load stored password:', err);
      }
    }
  }, [loadPassword]);

  const validateEmail = useCallback((text: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailError(emailRegex.test(text) ? '' : t('login.errorInvalidEmail'));
    setEmail(text);
    loadStoredPassword(text);
  }, [loadStoredPassword, t]);

  const handleSubmit = useCallback(async () => {
    ReactNativeHapticFeedback.trigger('impactLight');
    
    if (emailError || !email || !password) {
      setError(t('login.errorFillFields'));
      Alert.alert(t('error'), t('login.errorFillFields'));
      return;
    }
    
    setError('');
    setAuthError(null);
    setLoading(true);
    
    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    
    try {
      await login(email, password);
      ReactNativeHapticFeedback.trigger('notificationSuccess');
      Toast.show({
        type: 'success',
        text1: t('login.success'),
      });
    } catch (err: any) {
      ReactNativeHapticFeedback.trigger('notificationError');
      setError(t('login.error'));
      Alert.alert(t('error'), t('login.error'));
    } finally {
      setLoading(false);
    }
  }, [email, password, emailError, login, setAuthError, t]);

  const handleForgotPassword = () => {
    ReactNativeHapticFeedback.trigger('selection');
    navigation.navigate('ForgotPassword');
  };

  const handleRegister = () => {
    ReactNativeHapticFeedback.trigger('selection');
    navigation.navigate('Register');
  };

  const togglePasswordVisibility = () => {
    ReactNativeHapticFeedback.trigger('selection');
    setShowPassword(!showPassword);
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardOffset}
          style={styles.keyboardAvoidingView}
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
            <View style={styles.headerSection}>
              <Animatable.Image
                animation="bounceIn"
                duration={1200}
                source={require('../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              
              <Animatable.View animation="fadeIn" delay={300} style={styles.titleContainer}>
                <Text style={styles.headline}>{t('login.headline')}</Text>
                <Text style={styles.tagline}>{t('login.tagline')}</Text>
              </Animatable.View>
            </View>

            {(error || authError || emailError) && (
              <Animated.View 
                style={[
                  styles.errorContainer,
                  { transform: [{ translateX: errorShake }] }
                ]}
              >
                <Icon name="warning" size={18} color={COLORS.whiteLines} style={styles.errorIcon} />
                <Text style={styles.error}>
                  {error || authError || emailError}
                </Text>
              </Animated.View>
            )}

            <View style={styles.form}>
              <Animatable.View animation="fadeInUp" delay={400}>
                <View style={[
                  styles.inputContainer,
                  emailFocused && styles.inputFocused,
                  emailError && styles.inputError
                ]}>
                  <Icon 
                    name="email" 
                    size={22} 
                    color={emailFocused ? COLORS.courtBlue : COLORS.grayMedium} 
                    style={styles.icon} 
                  />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={validateEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder={t('login.emailPlaceholder')}
                    placeholderTextColor={COLORS.grayMedium}
                    autoCorrect={false}
                    accessibilityLabel={t('login.emailPlaceholder')}
                  />
                  {email.length > 0 && !emailError && (
                    <Animatable.View animation="bounceIn">
                      <Icon name="check-circle" size={20} color={COLORS.aceGreen} />
                    </Animatable.View>
                  )}
                </View>
              </Animatable.View>

              <Animatable.View animation="fadeInUp" delay={500}>
                <View style={[
                  styles.inputContainer,
                  passwordFocused && styles.inputFocused
                ]}>
                  <Icon 
                    name="lock" 
                    size={22} 
                    color={passwordFocused ? COLORS.courtBlue : COLORS.grayMedium} 
                    style={styles.icon} 
                  />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    secureTextEntry={!showPassword}
                    placeholder={t('login.passwordPlaceholder')}
                    placeholderTextColor={COLORS.grayMedium}
                    autoCorrect={false}
                    accessibilityLabel={t('login.passwordPlaceholder')}
                  />
                  <TouchableOpacity
                    onPress={togglePasswordVisibility}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel={t(showPassword ? 'login.hidePassword' : 'login.showPassword')}
                  >
                    <Icon
                      name={showPassword ? 'visibility-off' : 'visibility'}
                      size={22}
                      color={COLORS.grayMedium}
                    />
                  </TouchableOpacity>
                </View>
              </Animatable.View>

              <Animatable.View animation="fadeInUp" delay={600}>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    pressed && styles.buttonPressed,
                    loading && styles.buttonDisabled
                  ]}
                  onPress={handleSubmit}
                  disabled={loading}
                  accessibilityLabel={t('login.loginButton')}
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
                        <Text style={styles.buttonText}>{t('login.loginButton')}</Text>
                        <Icon name="arrow-forward" size={20} color={COLORS.whiteLines} style={styles.buttonIcon} />
                      </>
                    )}
                  </Animated.View>
                </Pressable>
              </Animatable.View>

              <Animatable.View animation="fadeInUp" delay={700} style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>{t('login.or')}</Text>
                <View style={styles.divider} />
              </Animatable.View>

              <Animatable.View animation="fadeInUp" delay={800} style={styles.googleButton}>
                <GoogleSignInButton
                  borderRadius={SPACING.md}
                  backgroundColor={COLORS.whiteLines}
                  borderColor={COLORS.grayBorder}
                  shadowOpacity={0.08}
                  shadowRadius={8}
                  paddingVertical={SPACING.lg}
                  paddingHorizontal={SPACING.xl}
                  textColor={COLORS.netDark}
                  disabledOpacity={0.7}
                />
              </Animatable.View>

              <Animatable.View animation="fadeIn" delay={900}>
                <TouchableOpacity 
                  onPress={handleForgotPassword}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.forgotPasswordContainer}
                >
                  <Text style={styles.forgotPasswordText}>
                    {t('login.forgotPassword')}
                  </Text>
                </TouchableOpacity>
              </Animatable.View>
            </View>

            <Animatable.View animation="fadeIn" delay={1000} style={styles.footer}>
              <Text style={styles.footerText}>
                {t('login.noAccount')}{' '}
                <Text style={styles.link} onPress={handleRegister}>
                  {t('login.register')}
                </Text>
              </Text>
            </Animatable.View>
          </Animated.View>
        </KeyboardAvoidingView>
      </ScrollView>
    </SafeAreaView>
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
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxxl,
  },
  logo: {
    width: width * 0.5,
    height: width * 0.5,
    marginBottom: SPACING.xl,
  },
  titleContainer: {
    alignItems: 'center',
  },
  headline: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
    marginBottom: SPACING.sm,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  errorIcon: {
    marginRight: SPACING.sm,
  },
  error: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.whiteLines,
    lineHeight: 20,
  },
  form: {
    marginBottom: SPACING.xxl,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.whiteLines,
    borderRadius: SPACING.md,
    paddingHorizontal: SPACING.lg,
    height: 56,
    marginBottom: SPACING.lg,
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
    shadowOpacity: 0.2,
    elevation: 4,
  },
  inputError: {
    borderColor: COLORS.warningYellow,
    backgroundColor: '#FFF9E6',
  },
  icon: {
    marginRight: SPACING.md,
  },
  iconButton: {
    padding: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: COLORS.netDark,
    lineHeight: 24,
  },
  button: {
    backgroundColor: COLORS.courtBlue,
    borderRadius: SPACING.md,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    shadowColor: COLORS.courtBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
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
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: COLORS.whiteLines,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  buttonIcon: {
    marginLeft: SPACING.sm,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.xl,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.grayBorder,
  },
  dividerText: {
    marginHorizontal: SPACING.lg,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    textTransform: 'uppercase',
  },
  googleButton: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.courtBlue,
    textDecorationLine: 'underline',
  },
  footer: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    lineHeight: 21,
  },
  link: {
    color: COLORS.courtBlue,
    fontFamily: 'Inter-SemiBold',
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;