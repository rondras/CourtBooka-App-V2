import React, { useState, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';

type GoogleSignInButtonNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Login' | 'Register'
>;

interface GoogleSignInButtonProps {
  role?: string;
  textColor?: string;
  borderRadius?: number;
  borderColor?: string;
  backgroundColor?: string;
  shadowColor?: string;
  shadowOpacity?: number;
  shadowRadius?: number;
  paddingVertical?: number;
  paddingHorizontal?: number;
  disabledOpacity?: number;
}

// Custom toast config (move to App.tsx)
export const toastConfig = {
  success: ({ text1, text2 }: { text1: string; text2: string }) => (
    <View style={toastStyles.container}>
      <Text style={toastStyles.text1}>{text1}</Text>
      <Text style={toastStyles.text2}>{text2}</Text>
    </View>
  ),
};

const toastStyles = StyleSheet.create({
  container: {
    backgroundColor: '#2 ECC71', // Match LoginScreen primary color
    padding: 16,
    borderRadius: 8,
    width: '90%',
    alignItems: 'center',
  },
  text1: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  text2: {
    fontSize: 14,
    color: '#FFFFFF',
  },
});

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = memo(
  ({
    role = 'user',
    textColor = '#4285F4',
    borderRadius = 4,
    borderColor = '#DDDDDD',
    backgroundColor = '#FFFFFF',
    shadowColor = '#000',
    shadowOpacity = 0.2,
    shadowRadius = 2,
    paddingVertical = 12,
    paddingHorizontal = 24,
    disabledOpacity = 0.8,
  }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const { handleGoogleAuth } = useAuth();
    const navigation = useNavigation<GoogleSignInButtonNavigationProp>();

    const handlePress = async () => {
      setLoading(true);
      try {
        console.log('GoogleSignInButton pressed with props:', { role, textColor, borderRadius }); // Debug log
        await handleGoogleAuth(role);
        Toast.show({
          type: 'success',
          text1: t('toast.success'),
          text2: t('toast.googleAuthSuccess'),
        });
        if (role === 'student') {
          navigation.navigate('MainTabs');
        } else {
          navigation.navigate('MainTabs');
        }
      } catch (err: any) {
        console.warn('Google auth error:', err.message); // Debug log
        Alert.alert(t('toast.error'), err.message);
      } finally {
        setLoading(false);
      }
    };

    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={[
            styles.button,
            {
              borderRadius,
              borderColor,
              backgroundColor,
              shadowColor,
              shadowOpacity,
              shadowRadius,
              paddingVertical,
              paddingHorizontal,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            },
          ]}
          onPress={handlePress}
          disabled={loading}
          activeOpacity={disabledOpacity}
          accessibilityLabel={t('login.googleButton')}
          accessibilityHint={t('login.googleButtonHint')}
          testID="google-signin-button"
        >
          <Image
            source={require('../assets/GoogleLogo.png')}
            style={styles.icon}
          />
          <Text style={[styles.text, { color: textColor }]}>{t('login.googleButton')}</Text>
        </TouchableOpacity>
        {loading && (
          <View
            style={[
              styles.loader,
              { borderRadius, backgroundColor: 'rgba(255, 255, 255, 0.7)' },
            ]}
          >
            <ActivityIndicator size="small" color={textColor} />
          </View>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    width: '100%',
  },
  icon: {
    width: 22,
    height: 24,
    marginRight: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default GoogleSignInButton;