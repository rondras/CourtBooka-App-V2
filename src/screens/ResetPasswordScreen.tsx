import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../App';
import { resetPassword } from '../api/api';
import { Animated } from 'react-native';

const FormInput: React.FC<{
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  error?: string;
  editable?: boolean;
  showToggle?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
}> = ({ 
  icon, 
  placeholder, 
  value, 
  onChangeText, 
  secureTextEntry, 
  keyboardType = 'default', 
  error, 
  editable = true, 
  showToggle = false, 
  multiline = false, 
  numberOfLines = 1 
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation(); // Added for toggle icon localization
  const [showPassword, setShowPassword] = useState(false);
  const isValid = !error && value.length > 0;

  return (
    <View style={styles.inputWrapper}>
      <View
        style={[
          styles.inputContainer,
          { backgroundColor: colors.surface },
          error ? styles.inputError : (isValid ? styles.inputSuccess : null),
          multiline ? styles.multilineInputContainer : null,
        ]}
      >
        <Icon name={icon} size={24} color={colors.muted} style={styles.icon} />
        <TextInput
          style={[
            styles.input, 
            { color: colors.text },
            multiline ? styles.multilineInput : null,
          ]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize="none"
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          editable={editable}
          accessibilityLabel={placeholder}
          multiline={multiline}
          numberOfLines={numberOfLines}
          scrollEnabled={multiline}
        />
        {isValid && <Icon name="check-circle" size={20} color={colors.secondary} />}
        {error && <Icon name="error" size={20} color={colors.accent} />}
        {showToggle && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.toggleButton}>
            <Icon
              name={showPassword ? t('login.hidePassword') : t('login.showPassword')}
              size={20}
              color={colors.muted}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={[styles.fieldError, { color: colors.accent }]}>{error}</Text>}
    </View>
  );
};

const ResetPasswordScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const initialToken = route.params?.token || '';

  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordInputRef = useRef<TextInput>(null);
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!initialToken) {
      Toast.show({
        type: 'info',
        text1: t('resetPassword.missingTokenTitle'),
        text2: t('resetPassword.missingTokenMessage'),
      });
      navigation.navigate('ForgotPassword');
    }
  }, [initialToken, navigation, t]);

  useEffect(() => {
    if (token) {
      passwordInputRef.current?.focus();
    }
  }, [token]);

  const handleSubmit = useCallback(async () => {
    let hasError = false;
    if (!token) {
      setTokenError(t('resetPassword.errorTokenRequired'));
      hasError = true;
    } else {
      setTokenError('');
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError(t('resetPassword.errorMismatch'));
      hasError = true;
    } else {
      setConfirmPasswordError('');
    }
    if (password.length < 8) {
      setPasswordError(t('resetPassword.errorLength'));
      hasError = true;
    } else {
      setPasswordError('');
    }
    if (hasError) {
      setError(t('login.errorFillFields'));
      Alert.alert(t('login.error'), t('login.errorFillFields'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(token, password);
      Toast.show({
        type: 'success',
        text1: t('resetPassword.success'),
        text2: t('resetPassword.success'),
      });
      navigation.navigate('Login');
    } catch (err: any) {
      const msg = err.response?.data?.error || t('resetPassword.errorInvalidToken');
      setError(msg);
      Alert.alert(t('login.error'), msg);
    } finally {
      setLoading(false);
    }
  }, [token, password, confirmPassword, navigation, t]);

  const animateButtonPress = (toValue: number) => {
    Animated.timing(buttonScale, {
      toValue,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraHeight={50}
        extraScrollHeight={50}
        enableResetScrollToCoords={false}
      >
        <View style={styles.inputArea}>
          <Animatable.Image
            animation="fadeInDown"
            duration={800}
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Animatable.Text
            animation="fadeInDown"
            duration={800}
            delay={200}
            style={[styles.title, { color: colors.text }]}
          >
            {t('resetPassword.title')}
          </Animatable.Text>
          <Animatable.Text
            animation="fadeInDown"
            duration={800}
            delay={400}
            style={[styles.subtitle, { color: colors.muted }]}
          >
            {t('resetPassword.subtitle')}
          </Animatable.Text>
          {error && (
            <Animatable.View
              animation="shake"
              duration={500}
              style={[styles.errorContainer, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
            </Animatable.View>
          )}
          <FormInput
            icon="key"
            placeholder={t('resetPassword.tokenPlaceholder')}
            value={token}
            onChangeText={setToken}
            error={tokenError}
            editable={!loading}
            keyboardType="default"
            multiline={true}
            numberOfLines={2}
            accessibilityLabel={t('resetPassword.tokenAccessibilityLabel')}
          />
          <FormInput
            icon="lock"
            placeholder={t('resetPassword.newPasswordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
            error={passwordError}
            editable={!loading}
            showToggle={true}
            accessibilityLabel={t('resetPassword.newPasswordAccessibilityLabel')}
          />
          <FormInput
            icon="lock"
            placeholder={t('resetPassword.confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={true}
            error={confirmPasswordError}
            editable={!loading}
            showToggle={true}
            accessibilityLabel={t('resetPassword.confirmPasswordPlaceholder')}
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPressIn={() => animateButtonPress(0.95)}
            onPressOut={() => animateButtonPress(1)}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityLabel={t('resetPassword.resetButton')}
          >
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.surface }]}>
                  {t('resetPassword.resetButton')}
                </Text>
              )}
            </Animated.View>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  inputArea: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  logo: {
    width: 250,
    height: 250,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    lineHeight: 42,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  errorContainer: {
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 21,
    textAlign: 'center',
  },
  inputWrapper: {
    gap: 4,
    width: '100%',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    height: 56,
  },
  multilineInputContainer: {
    height: 'auto',
    minHeight: 56,
    paddingVertical: 8,
  },
  inputError: {
    borderColor: '#FFC107',
    borderWidth: 1,
  },
  inputSuccess: {
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 24,
  },
  multilineInput: {
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  fieldError: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    lineHeight: 16,
    marginLeft: 16,
  },
  toggleButton: {
    paddingLeft: 8,
  },
  button: {
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    width: '100%',
    marginBottom: 16,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
  },
});

export default ResetPasswordScreen;