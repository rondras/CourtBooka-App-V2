import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import logo from '../assets/logo.png';

type SplashScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

const SplashScreen: React.FC = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [show, setShow] = useState(true);
  const navigation = useNavigation<SplashScreenNavigationProp>();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      if (!isLoading) {
        navigation.replace(isAuthenticated ? 'MainTabs' : 'Login');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading, navigation]);

  if (!show || isLoading) return null;

  return (
    <View style={styles.container}>
      <Image source={logo} style={styles.logo} accessibilityLabel={t('navbar.logo')} />
      <Text style={styles.text}>{t('splash.welcome', { name: user?.firstName || t('splash.defaultName') })}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  logo: { width: 150, height: 150, resizeMode: 'contain' },
  text: { fontSize: 20, marginTop: 20 },
});

export default SplashScreen;