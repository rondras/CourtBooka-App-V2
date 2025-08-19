// components/GoogleSignInButton.tsx
import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { useAuth } from '../context/AuthContext';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';

type GoogleSignInButtonNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Login' | 'Register'
>;

interface GoogleSignInButtonProps {
  role?: string; // Optional role parameter for registration
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ role = 'student' }) => {
  const [loading, setLoading] = useState(false);
  const { handleGoogleAuth } = useAuth();
  const navigation = useNavigation<GoogleSignInButtonNavigationProp>();

  const handlePress = async () => {
    setLoading(true);
    try {
      await handleGoogleAuth(role);
      Toast.show({
        type: 'success',
        text1: 'Erfolg',
        text2: 'Erfolgreich angemeldet oder registriert',
      });
      // Navigation basierend auf der Rolle
      if (role === 'student') {
        navigation.navigate('MainTabs');
      } else {
        navigation.navigate('MainTabs');
      }
    } catch (err: any) {
      Alert.alert('Fehler', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <GoogleSigninButton
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Light}
        onPress={handlePress}
        disabled={loading}
      />
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color="#ffffff" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    padding: 0,
  },
  loader: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default GoogleSignInButton;
