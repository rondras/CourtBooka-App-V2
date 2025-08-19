import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
  Keyboard,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Pressable,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../../App';
import Toast from 'react-native-toast-message';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { Animated } from 'react-native';
import { validateInviteToken } from '../api/api';
import debounce from 'lodash/debounce';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { COLORS, SPACING } from '../constants/colors';

type RegisterScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

const { height, width } = Dimensions.get('window');

// Enhanced FormInput Component
const FormInput: React.FC<{
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  error?: string;
  editable?: boolean;
  helpText?: string;
  strengthMeter?: boolean;
  showToggle?: boolean;
  required?: boolean;
  delay?: number;
}> = React.memo(({ 
  icon, 
  placeholder, 
  value, 
  onChangeText, 
  secureTextEntry, 
  keyboardType = 'default', 
  error, 
  editable = true, 
  helpText, 
  strengthMeter = false, 
  showToggle = false,
  required = false,
  delay = 0
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [localStrength, setLocalStrength] = useState(0);
  const [localStrengthColor, setLocalStrengthColor] = useState(COLORS.grayBorder);
  const [localStrengthText, setLocalStrengthText] = useState('');
  const isValid = !error && value.length > 0;
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const strengthWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (strengthMeter && value.length > 0) {
      const hasLowerCase = /[a-z]/.test(value);
      const hasUpperCase = /[A-Z]/.test(value);
      const hasNumbers = /\d/.test(value);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
      const lengthScore = value.length >= 12 ? 2 : value.length >= 8 ? 1 : 0;
      
      const strengthScore = 
        (hasLowerCase ? 1 : 0) + 
        (hasUpperCase ? 1 : 0) + 
        (hasNumbers ? 1 : 0) + 
        (hasSpecialChar ? 1 : 0) + 
        lengthScore;
      
      const strength = strengthScore >= 5 ? 3 : strengthScore >= 3 ? 2 : 1;
      
      setLocalStrength(strength);
      setLocalStrengthColor(
        strength === 3 ? COLORS.aceGreen : 
        strength === 2 ? COLORS.warningYellow : 
        COLORS.error
      );
      setLocalStrengthText(
        strength === 3 ? t('register.passwordStrengthStrong') :
        strength === 2 ? t('register.passwordStrengthMedium') :
        t('register.passwordStrengthWeak')
      );
      
      Animated.timing(strengthWidth, {
        toValue: (strength / 3) * 100,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      setLocalStrength(0);
      Animated.timing(strengthWidth, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [value, strengthMeter, t]);

  const handleFocus = () => {
    setIsFocused(true);
    Animated.spring(scaleAnim, {
      toValue: 1.02,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  };

  const togglePassword = () => {
    ReactNativeHapticFeedback.trigger('selection');
    setShowPassword(!showPassword);
  };

  const styles = createInputStyles(colors);

  return (
    <Animatable.View 
      animation="fadeInUp" 
      delay={delay}
      style={styles.inputWrapper}
    >
      {required && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{placeholder}</Text>
          <Text style={styles.required}>*</Text>
        </View>
      )}
      <Animated.View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputError,
          isValid && styles.inputSuccess,
          !editable && styles.inputDisabled,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <Icon 
          name={icon} 
          size={20} 
          color={
            error ? COLORS.error :
            isValid ? COLORS.aceGreen :
            isFocused ? COLORS.courtBlue : 
            COLORS.grayMedium
          } 
          style={styles.icon} 
        />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize="none"
          placeholder={!required ? placeholder : ''}
          placeholderTextColor={COLORS.grayMedium}
          editable={editable}
          accessibilityLabel={placeholder}
        />
        {isValid && !secureTextEntry && (
          <Animatable.View animation="bounceIn" duration={400}>
            <Icon name="check-circle" size={18} color={COLORS.aceGreen} />
          </Animatable.View>
        )}
        {error && (
          <Animatable.View animation="shake" duration={400}>
            <Icon name="error-outline" size={18} color={COLORS.error} />
          </Animatable.View>
        )}
        {showToggle && secureTextEntry && (
          <TouchableOpacity 
            onPress={togglePassword} 
            style={styles.toggleButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon 
              name={showPassword ? 'visibility-off' : 'visibility'} 
              size={20} 
              color={COLORS.grayMedium} 
            />
          </TouchableOpacity>
        )}
      </Animated.View>
      
      {strengthMeter && value.length > 0 && (
        <Animatable.View animation="fadeIn" style={styles.strengthContainer}>
          <View style={styles.strengthBarBackground}>
            <Animated.View 
              style={[
                styles.strengthBar,
                {
                  width: strengthWidth.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: localStrengthColor,
                }
              ]} 
            />
          </View>
          <Text style={[styles.strengthText, { color: localStrengthColor }]}>
            {localStrengthText}
          </Text>
        </Animatable.View>
      )}
      
      {helpText && !error && (
        <Animatable.Text animation="fadeIn" style={styles.helpText}>
          {helpText}
        </Animatable.Text>
      )}
      {error && (
        <Animatable.Text animation="shake" style={styles.fieldError}>
          {error}
        </Animatable.Text>
      )}
    </Animatable.View>
  );
});

const RegisterScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    street: '',
    houseNumber: '',
    city: '',
    postalCode: '',
    country: '',
  });
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isInvite, setIsInvite] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const { register, error: authError, setError: setAuthError } = useAuth();
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const route = useRoute();
  
  // Animation refs
  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressWidth = useRef(new Animated.Value(33.33)).current;
  const addressHeight = useRef(new Animated.Value(0)).current;
  const rotateIcon = useRef(new Animated.Value(0)).current;

  const inviteToken = route.params?.invite_token as string | undefined;
  const clubId = route.params?.club_id ? parseInt(route.params.club_id as string, 10) : undefined;

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
    // Update progress bar based on current step
    Animated.timing(progressWidth, {
      toValue: currentStep * 33.33,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  useEffect(() => {
    if (inviteToken) {
      setIsInvite(true);
      setLoading(true);
      validateInviteToken(inviteToken)
        .then((data) => {
          if (data.valid) {
            setFormData((prev) => ({ ...prev, email: data.email }));
            ReactNativeHapticFeedback.trigger('notificationSuccess');
            Toast.show({
              type: 'info',
              text1: t('register.inviteDetected'),
              text2: t('register.inviteDetectedMessage'),
            });
          } else {
            setError(t('register.invalidInviteToken'));
            setIsInvite(false);
            ReactNativeHapticFeedback.trigger('notificationWarning');
          }
        })
        .catch((err) => {
          console.error('Error validating token:', err);
          setError(t('register.tokenValidationError'));
          setIsInvite(false);
          ReactNativeHapticFeedback.trigger('notificationError');
        })
        .finally(() => setLoading(false));
    }
  }, [inviteToken, t]);

  const updateFormData = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const debouncedValidateEmail = useCallback(
    debounce((text: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      setEmailError(emailRegex.test(text) ? '' : t('register.errorInvalidEmail'));
    }, 300),
    [t]
  );

  const debouncedValidatePassword = useCallback(
    debounce((text: string) => {
      setPasswordError(text.length >= 8 ? '' : t('register.errorLength'));
      if (formData.confirmPassword) {
        setConfirmPasswordError(text === formData.confirmPassword ? '' : t('register.errorMismatch'));
      }
    }, 300),
    [formData.confirmPassword, t]
  );

  const debouncedValidateConfirmPassword = useCallback(
    debounce((text: string) => {
      setConfirmPasswordError(text === formData.password ? '' : t('register.errorMismatch'));
    }, 300),
    [formData.password, t]
  );

  const toggleAddressSection = () => {
    ReactNativeHapticFeedback.trigger('selection');
    setShowAddress(!showAddress);
    
    Animated.parallel([
      Animated.timing(addressHeight, {
        toValue: showAddress ? 0 : 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(rotateIcon, {
        toValue: showAddress ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSubmit = useCallback(async () => {
    ReactNativeHapticFeedback.trigger('impactLight');
    
    let hasError = false;
    if (!formData.email || emailError) {
      setEmailError(t('register.emailRequired'));
      hasError = true;
    }
    if (!formData.password || passwordError) {
      setPasswordError(t('register.passwordRequired'));
      hasError = true;
    }
    if (!formData.confirmPassword || confirmPasswordError) {
      setConfirmPasswordError(t('register.confirmPasswordRequired'));
      hasError = true;
    }
    if (hasError) {
      setError(t('login.errorFillFields'));
      ReactNativeHapticFeedback.trigger('notificationWarning');
      Alert.alert(t('login.error'), t('login.errorFillFields'));
      return;
    }
    
    setError('');
    setAuthError(null);
    setLoading(true);
    
    // Button animation
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    
    try {
      const payload = {
        ...formData,
        role: 'user',
        ...(isInvite && inviteToken && clubId && { invite_token: inviteToken, club_id: clubId }),
      };
      
      const response = await register(payload);
      ReactNativeHapticFeedback.trigger('notificationSuccess');
      
      if (isInvite && response.access_token) {
        Toast.show({
          type: 'success',
          text1: t('register.successInvite'),
          text2: t('register.successInvite'),
        });
        navigation.navigate('MainTabs');
      } else {
        Toast.show({
          type: 'success',
          text1: t('register.successNormal'),
          text2: t('register.successNormal'),
        });
        navigation.navigate('Login');
      }
    } catch (err: any) {
      ReactNativeHapticFeedback.trigger('notificationError');
      const errMsg = isInvite ? t('register.errorInvite', { message: err.message }) : err.message;
      setError(errMsg);
      Toast.show({
        type: 'error',
        text1: t('login.error'),
        text2: `${t('login.error')}: ${errMsg}`,
      });
    } finally {
      setLoading(false);
    }
  }, [formData, emailError, passwordError, confirmPasswordError, register, setAuthError, navigation, isInvite, inviteToken, clubId, t]);

  const handleLoginLink = () => {
    ReactNativeHapticFeedback.trigger('selection');
    navigation.navigate('Login');
  };

  const styles = createStyles(colors);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          extraHeight={100}
          extraScrollHeight={100}
          enableResetScrollToCoords={false}
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
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
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
              <View style={styles.stepsContainer}>
                <Text style={[styles.stepText, currentStep >= 1 && styles.stepTextActive]}>
                  {t('register.stepAccount')}
                </Text>
                <Text style={[styles.stepText, currentStep >= 2 && styles.stepTextActive]}>
                  {t('register.stepPersonal')}
                </Text>
                <Text style={[styles.stepText, currentStep >= 3 && styles.stepTextActive]}>
                  {t('register.stepAddress')}
                </Text>
              </View>
            </View>

            <View style={styles.headerSection}>
              <Animatable.Image
                animation="bounceIn"
                duration={1200}
                source={require('../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              
              <Animatable.View animation="fadeIn" delay={300} style={styles.titleContainer}>
                <Text style={styles.headline}>
                  {isInvite ? t('register.inviteHeadline') : t('register.headline')}
                </Text>
                <Text style={styles.tagline}>
                  {isInvite ? t('register.inviteTagline') : t('register.tagline')}
                </Text>
              </Animatable.View>
            </View>

            {isInvite && (
              <Animatable.View
                animation="fadeIn"
                delay={400}
                style={styles.inviteBanner}
              >
                <Icon name="card-giftcard" size={20} color={COLORS.whiteLines} />
                <Text style={styles.bannerText}>
                  {t('register.inviteBanner')}
                </Text>
              </Animatable.View>
            )}

            {error && (
              <Animatable.View 
                animation="shake"
                style={styles.errorContainer}
              >
                <Icon name="warning" size={18} color={COLORS.whiteLines} />
                <Text style={styles.error}>{error}</Text>
              </Animatable.View>
            )}

            <View style={styles.form}>
              {/* Account Section */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderContainer}>
                  <Icon name="account-circle" size={20} color={COLORS.courtBlue} />
                  <Text style={styles.sectionHeader}>
                    {t('register.accountSection')}
                  </Text>
                </View>
                
                <FormInput
                  icon="email"
                  placeholder={t('profile.email')}
                  value={formData.email}
                  onChangeText={(text) => {
                    updateFormData('email', text);
                    debouncedValidateEmail(text);
                    setCurrentStep(1);
                  }}
                  keyboardType="email-address"
                  error={emailError}
                  editable={!loading && !isInvite}
                  helpText={!isInvite ? t('register.emailHelpText') : undefined}
                  required
                  delay={500}
                />
                
                <FormInput
                  icon="lock"
                  placeholder={t('register.passwordPlaceholder')}
                  value={formData.password}
                  onChangeText={(text) => {
                    updateFormData('password', text);
                    debouncedValidatePassword(text);
                  }}
                  secureTextEntry={true}
                  error={passwordError}
                  helpText={t('register.passwordHelpText')}
                  strengthMeter={true}
                  showToggle={true}
                  required
                  delay={600}
                />
                
                <FormInput
                  icon="lock"
                  placeholder={t('register.confirmPasswordPlaceholder')}
                  value={formData.confirmPassword}
                  onChangeText={(text) => {
                    updateFormData('confirmPassword', text);
                    debouncedValidateConfirmPassword(text);
                  }}
                  secureTextEntry={true}
                  error={confirmPasswordError}
                  showToggle={true}
                  required
                  delay={700}
                />
              </View>

              {/* Personal Info Section */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderContainer}>
                  <Icon name="person" size={20} color={COLORS.courtBlue} />
                  <Text style={styles.sectionHeader}>
                    {t('profile.personalInfo')}
                  </Text>
                </View>
                
                <View style={styles.rowContainer}>
                  <View style={styles.halfWidth}>
                    <FormInput
                      icon="person"
                      placeholder={t('register.firstNamePlaceholder')}
                      value={formData.firstName}
                      onChangeText={(text) => {
                        updateFormData('firstName', text);
                        setCurrentStep(2);
                      }}
                      editable={!loading}
                      delay={800}
                    />
                  </View>
                  <View style={styles.halfWidth}>
                    <FormInput
                      icon="person"
                      placeholder={t('register.lastNamePlaceholder')}
                      value={formData.lastName}
                      onChangeText={(text) => updateFormData('lastName', text)}
                      editable={!loading}
                      delay={900}
                    />
                  </View>
                </View>
              </View>

              {/* Address Section - Collapsible */}
              <View style={styles.sectionContainer}>
                <TouchableOpacity
                  onPress={toggleAddressSection}
                  style={styles.sectionToggle}
                  activeOpacity={0.7}
                >
                  <View style={styles.sectionHeaderContainer}>
                    <Icon name="home" size={20} color={COLORS.courtBlue} />
                    <Text style={styles.sectionHeader}>
                      {t('register.addressSection')}
                    </Text>
                    <Text style={styles.optionalTag}>{t('register.optional')}</Text>
                  </View>
                  <Animated.View
                    style={{
                      transform: [{
                        rotate: rotateIcon.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '180deg'],
                        }),
                      }],
                    }}
                  >
                    <Icon
                      name="expand-more"
                      size={24}
                      color={COLORS.grayMedium}
                    />
                  </Animated.View>
                </TouchableOpacity>
                
                {showAddress && (
                  <Animatable.View animation="fadeIn" duration={300}>
                    <FormInput
                      icon="location-on"
                      placeholder={t('profile.street')}
                      value={formData.street}
                      onChangeText={(text) => {
                        updateFormData('street', text);
                        setCurrentStep(3);
                      }}
                      editable={!loading}
                      helpText={t('register.streetHelpText')}
                      delay={100}
                    />
                    
                    <View style={styles.rowContainer}>
                      <View style={styles.oneThirdWidth}>
                        <FormInput
                          icon="home"
                          placeholder={t('profile.houseNumber')}
                          value={formData.houseNumber}
                          onChangeText={(text) => updateFormData('houseNumber', text)}
                          editable={!loading}
                          delay={200}
                        />
                      </View>
                      <View style={styles.twoThirdsWidth}>
                        <FormInput
                          icon="location-city"
                          placeholder={t('profile.city')}
                          value={formData.city}
                          onChangeText={(text) => updateFormData('city', text)}
                          editable={!loading}
                          delay={300}
                        />
                      </View>
                    </View>
                    
                    <View style={styles.rowContainer}>
                      <View style={styles.halfWidth}>
                        <FormInput
                          icon="mail"
                          placeholder={t('profile.postalCode')}
                          value={formData.postalCode}
                          onChangeText={(text) => updateFormData('postalCode', text)}
                          keyboardType="numeric"
                          editable={!loading}
                          delay={400}
                        />
                      </View>
                      <View style={styles.halfWidth}>
                        <FormInput
                          icon="flag"
                          placeholder={t('profile.country')}
                          value={formData.country}
                          onChangeText={(text) => updateFormData('country', text)}
                          editable={!loading}
                          delay={500}
                        />
                      </View>
                    </View>
                  </Animatable.View>
                )}
              </View>

              {/* Submit Button */}
              <Animatable.View animation="fadeInUp" delay={1000}>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    pressed && styles.buttonPressed,
                    loading && styles.buttonDisabled
                  ]}
                  onPress={handleSubmit}
                  disabled={loading}
                  accessibilityLabel={t('register.registerButton')}
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
                        <Text style={styles.buttonText}>
                          {t('register.registerButton')}
                        </Text>
                        <Icon name="arrow-forward" size={20} color={COLORS.whiteLines} style={styles.buttonIcon} />
                      </>
                    )}
                  </Animated.View>
                </Pressable>
              </Animatable.View>

              {/* Divider */}
              <Animatable.View animation="fadeIn" delay={1100} style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>{t('login.or')}</Text>
                <View style={styles.divider} />
              </Animatable.View>

              {/* Google Sign Up */}
              <Animatable.View animation="fadeInUp" delay={1200} style={styles.googleButton}>
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
            </View>

            {/* Footer */}
            <Animatable.View animation="fadeIn" delay={1300} style={styles.footer}>
              <Text style={styles.footerText}>
                {t('register.hasAccount')}{' '}
                <Text
                  style={styles.link}
                  onPress={handleLoginLink}
                >
                  {t('register.login')}
                </Text>
              </Text>
            </Animatable.View>
          </Animated.View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
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
  progressContainer: {
    marginBottom: SPACING.xl,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: COLORS.grayBorder,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.courtBlue,
    borderRadius: 2,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  stepText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
  },
  stepTextActive: {
    color: COLORS.courtBlue,
    fontFamily: 'Inter-SemiBold',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logo: {
    width: width * 0.35,
    height: width * 0.35,
    marginBottom: SPACING.lg,
  },
  titleContainer: {
    alignItems: 'center',
  },
  headline: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
    marginBottom: SPACING.sm,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.lg,
  },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.aceGreen,
    borderRadius: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    shadowColor: COLORS.aceGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.whiteLines,
    marginLeft: SPACING.sm,
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
  error: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.whiteLines,
    marginLeft: SPACING.sm,
  },
  form: {
    marginBottom: SPACING.xl,
  },
  sectionContainer: {
    marginBottom: SPACING.xl,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.netDark,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  optionalTag: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    backgroundColor: COLORS.courtBlueLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: SPACING.xs,
  },
  sectionToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  rowContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  halfWidth: {
    flex: 1,
  },
  oneThirdWidth: {
    flex: 0.35,
  },
  twoThirdsWidth: {
    flex: 0.65,
  },
  button: {
    backgroundColor: COLORS.courtBlue,
    borderRadius: SPACING.md,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
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
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    textTransform: 'uppercase',
  },
  googleButton: {
    alignItems: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
  },
  link: {
    color: COLORS.courtBlue,
    fontFamily: 'Inter-SemiBold',
    textDecorationLine: 'underline',
  },
});

const createInputStyles = (colors: any) => StyleSheet.create({
  inputWrapper: {
    marginBottom: SPACING.lg,
  },
  labelContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.netDark,
  },
  required: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.error,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.whiteLines,
    borderRadius: SPACING.md,
    paddingHorizontal: SPACING.lg,
    height: 52,
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
  inputDisabled: {
    backgroundColor: COLORS.grayLight,
    opacity: 0.8,
  },
  icon: {
    marginRight: SPACING.md,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: COLORS.netDark,
    lineHeight: 22,
  },
  toggleButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  strengthContainer: {
    marginTop: SPACING.sm,
  },
  strengthBarBackground: {
    height: 4,
    backgroundColor: COLORS.grayBorder,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthBar: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginTop: SPACING.xs,
    textAlign: 'right',
  },
  helpText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
    lineHeight: 18,
  },
  fieldError: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: COLORS.error,
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
  },
});

export default RegisterScreen;