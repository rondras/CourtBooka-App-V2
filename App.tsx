import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { 
  Dimensions, 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  useColorScheme,
  Platform,
  Animated,
  Easing,
  Pressable
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'react-native-haptic-feedback';

// SCREENS
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
import AdvancedBookingScreen from './src/screens/AdvancedBookingScreen';
import BookingsScreen from './src/screens/BookingsScreen';
import ClubCourtsScreen from './src/screens/ClubCourtsScreen';
import CreateBookingScreen from './src/screens/CreateBookingScreen';
import MoreScreen from './src/screens/MoreScreen';
import Navbar from './src/components/Navbar';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import SuperAdminScreen from './src/screens/SuperAdminScreen';
import ClubAdminScreen from './src/screens/ClubAdminScreen';

import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AuthStackParamList, MainTabsParamList } from './src/navigation/types';
import RNFS from 'react-native-fs';
import messaging from '@react-native-firebase/messaging';
import axios from 'axios';
import notifee from '@notifee/react-native';
import Toast from 'react-native-toast-message';

import './src/i18n/i18n';
import { COLORS, SPACING } from './src/constants/colors';

type RootStackParamList = AuthStackParamList & {
  MainTabs: undefined;
  Profile: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
  Bookings: undefined;
  ClubCourts: { clubId: number };
  CreateBooking: { courtId: number };
  AdvancedBooking: undefined;
  AdminDashboard: undefined;
  SuperAdmin: undefined;
  ClubAdmin: { clubId: number };
};

interface ViewportContextType {
  width: number;
  height: number;
}

interface ThemeContextType {
  colors: {
    background: string;
    surface: string;
    primary: string;
    primaryDark: string;
    secondary: string;
    secondaryDark: string;
    accent: string;
    text: string;
    muted: string;
    border: string;
    cardBackground: string;
    error: string;
  };
}

const viewportContext = React.createContext<ViewportContextType>({} as ViewportContextType);
const themeContext = React.createContext<ThemeContextType>({} as ThemeContextType);

const ViewportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [width, setWidth] = useState(Dimensions.get('window').width);
  const [height, setHeight] = useState(Dimensions.get('window').height);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWidth(window.width);
      setHeight(window.height);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    async function setupNotificationChannel() {
      await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        lights: true,
        vibration: true,
      });
    }
    setupNotificationChannel();
  }, []);

  return (
    <viewportContext.Provider value={{ width, height }}>
      {children}
    </viewportContext.Provider>
  );
};

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = useMemo(
    () => ({
      colors: {
        background: isDark ? COLORS.netDark : COLORS.grayLight,
        surface: isDark ? '#36454F' : COLORS.whiteLines,
        primary: COLORS.courtBlue,
        primaryDark: COLORS.courtBlueDark,
        secondary: COLORS.aceGreen,
        secondaryDark: '#2E7D32',
        accent: COLORS.warningYellow,
        text: isDark ? COLORS.whiteLines : COLORS.netDark,
        muted: isDark ? COLORS.grayMedium : COLORS.grayMedium,
        border: isDark ? COLORS.grayBorder : COLORS.grayBorder,
        cardBackground: isDark ? '#3A4D55' : COLORS.whiteLines,
        error: COLORS.error,
      },
    }),
    [isDark]
  );

  return <themeContext.Provider value={theme}>{children}</themeContext.Provider>;
};

export const useViewport = () => useContext(viewportContext);
export const useTheme = () => {
  const context = useContext(themeContext);
  if (!context) {
    console.error('useTheme must be used within a ThemeProvider');
    return { 
      colors: {
        background: COLORS.grayLight,
        surface: COLORS.whiteLines,
        primary: COLORS.courtBlue,
        primaryDark: COLORS.courtBlueDark,
        text: COLORS.netDark,
        muted: COLORS.grayMedium,
        border: COLORS.grayBorder,
        cardBackground: COLORS.whiteLines,
        error: COLORS.error,
        secondary: COLORS.aceGreen,
        secondaryDark: '#2E7D32',
        accent: COLORS.warningYellow,
      }
    };
  }
  return context;
};

// Enhanced Tab Bar Icon with animations
const AnimatedTabIcon: React.FC<{
  focused: boolean;
  color: string;
  size: number;
  icon: string;
}> = React.memo(({ focused, color, size, icon }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (focused) {
      Haptics.trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1.15,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.elastic(1),
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [focused, scaleAnim, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '10deg'],
  });

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }, { rotate: spin }],
      }}
    >
      <Icon name={icon} size={size} color={color} />
    </Animated.View>
  );
});

// Enhanced Profile Tab Icon
const ProfileTabIcon: React.FC<{
  focused: boolean;
  color: string;
  size: number;
  profileImage: string | null;
  user: any;
}> = React.memo(({ focused, color, size, profileImage, user }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const { colors } = useTheme();

  React.useEffect(() => {
    if (focused) {
      Haptics.trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [focused, scaleAnim]);

  if (profileImage) {
    return (
      <Animated.View
        style={[
          {
            transform: [{ scale: scaleAnim }],
            shadowColor: focused ? colors.primary : 'transparent',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: focused ? 5 : 0,
          },
        ]}
      >
        <Image
          source={{ uri: profileImage }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: focused ? 2 : 1,
            borderColor: focused ? colors.primary : colors.border,
          }}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale: scaleAnim }],
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: focused ? colors.primary : colors.muted,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? colors.accent : colors.border,
          shadowColor: focused ? colors.primary : 'transparent',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: focused ? 5 : 0,
        },
      ]}
    >
      <Text style={{ 
        color: COLORS.whiteLines, 
        fontSize: size / 1.5, 
        fontWeight: 'bold', 
        fontFamily: 'Inter-Bold' 
      }}>
        {user?.firstName?.[0] || 'U'}
      </Text>
    </Animated.View>
  );
});

const MainTabs = React.memo(() => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !user?.profile_picture_id) return;

    const fetchProfilePicture = async () => {
      try {
        const filename = `profile_picture_${user.id}.png`;
        const tempPath = `${RNFS.TemporaryDirectoryPath}/${filename}`;
        const url = `https://api.jurite.de/auth/users/${user.id}/profile-picture`;

        const res = await RNFS.downloadFile({
          fromUrl: url,
          toFile: tempPath,
          headers: { Authorization: `Bearer ${user.token}` },
        }).promise;

        if (res.statusCode === 200) {
          setProfileImage(`file://${tempPath}`);
        } else {
          setProfileImage(null);
        }
      } catch (err) {
        console.error('Error loading profile picture:', err);
        setProfileImage(null);
      }
    };

    fetchProfilePicture();

    return () => {
      if (profileImage) {
        const path = profileImage.replace('file://', '');
        RNFS.unlink(path).catch((err) => console.warn('Error deleting temporary file:', err));
      }
    };
  }, [user?.id, user?.profile_picture_id, user?.token]);

  return (
    <Tabs.Navigator
      screenOptions={{
        header: ({ navigation }) => <Navbar navigation={navigation} />,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? SPACING.xl : SPACING.sm,
          paddingTop: SPACING.sm,
          shadowColor: COLORS.shadowDark,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 10,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { 
          fontSize: 11, 
          fontWeight: '600', 
          fontFamily: 'Inter-SemiBold',
          marginTop: SPACING.xs,
        },
        tabBarItemStyle: {
          paddingVertical: SPACING.xs,
        },
      }}
    >
            {user?.firstName !== '' && user?.lastName !== '' && (
        <>
          <Tabs.Screen
            name="Bookings"
            component={BookingsScreen}
            options={{
              title: t('app.bookings'),
              tabBarIcon: ({ focused, color, size }) => (
                <AnimatedTabIcon focused={focused} color={color} size={size} icon="calendar-today" />
              ),
              tabBarAccessibilityLabel: t('app.bookingsHint'),
            }}
          />
          <Tabs.Screen
            name="More"
            component={MoreScreen}
            options={{
              title: t('more.title'),
              tabBarIcon: ({ focused, color, size }) => (
                <AnimatedTabIcon focused={focused} color={color} size={size} icon="more-horiz" />
              ),
              tabBarAccessibilityLabel: t('app.moreHint'),
            }}
          />
        </>
      )}
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: t('app.profile'),
          tabBarIcon: ({ focused, color, size }) => (
            <ProfileTabIcon
              focused={focused}
              color={color}
              size={size + 4}
              profileImage={profileImage}
              user={user}
            />
          ),
          tabBarAccessibilityLabel: t('app.profileHint'),
        }}
      />
      

    </Tabs.Navigator>
  );
});

// Enhanced Splash Screen
const SplashScreen: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const logoScale = React.useRef(new Animated.Value(0.8)).current;
  const logoOpacity = React.useRef(new Animated.Value(0)).current;
  const textOpacity = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    // Initial logo animation
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Text fade in
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();

      // Continuous pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [logoScale, logoOpacity, textOpacity, pulseAnim]);

  return (
    <View style={styles.splashContainer}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: Animated.multiply(logoScale, pulseAnim) }],
            opacity: logoOpacity,
          },
        ]}
      >
        <Image 
          source={require('./src/assets/logo.png')} 
          style={styles.logo} 
          accessibilityLabel={t('navbar.logo')} 
        />
      </Animated.View>
      
      <Animated.View style={{ opacity: textOpacity }}>
        <Text style={styles.splashTitle}>
          {t('app.loadingCourtBooka')}
        </Text>
        <View style={styles.loadingDotsContainer}>
          {[0, 1, 2].map((index) => (
            <Animatable.View
              key={index}
              animation="pulse"
              easing="ease-out"
              iterationCount="infinite"
              delay={index * 200}
              style={[
                styles.loadingDot,
                { backgroundColor: COLORS.courtBlue },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
});

const DashboardRedirect: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Animatable.View animation="fadeIn" style={styles.loadingContent}>
          <Icon name="sports-tennis" size={48} color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            {t('app.loading')}
          </Text>
        </Animatable.View>
      </View>
    );
  }
  
  if (!isAuthenticated || !user) {
    return <LoginScreen />;
  }
  
  if (!user.firstName || !user.lastName || !user.street || !user.houseNumber || !user.city || !user.postalCode || !user.country) {
    console.warn('User profile is incomplete, redirecting to Profile screen');
    return <ProfileScreen />;
  }
  
  return <BookingsScreen navigation={navigation} />;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabsParamList>();

const linking = {
  prefixes: ['https://courtbooka.rondras.com', 'courtbooka://'],
  config: {
    screens: {
      Login: 'login',
      Register: 'register',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset',
      VerifyEmail: 'verify',
      MainTabs: {
        path: '',
        screens: {},
      },
    },
  },
};

const App = () => {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, token, user } = useAuth();
  const [initialRoute, setInitialRoute] = useState<'Splash' | 'Login' | 'Profile' | 'MainTabs'>('Splash');

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        setInitialRoute(isAuthenticated ? 'MainTabs' : 'Login');
      }, 1500); // Give splash screen time to animate
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading, user]);

  if (isLoading || initialRoute === 'Splash') {
    return <SplashScreen />;
  }

  return (
    <ViewportProvider>
      <ThemeProvider>
        <AuthProvider>
          <NavigationContainer linking={linking}>
            <RootStack.Navigator
              initialRouteName={initialRoute}
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                animationDuration: 250,
              }}
            >
              <RootStack.Screen 
                name="Login" 
                component={LoginScreen}
                options={{
                  animation: 'fade',
                }}
              />
              <RootStack.Screen 
                name="Register" 
                component={RegisterScreen}
                options={{
                  animation: 'slide_from_bottom',
                }}
              />
              <RootStack.Screen name="Profile" component={ProfileScreen} />
              <RootStack.Screen 
                name="ForgotPassword" 
                component={ForgotPasswordScreen} 
                options={{ 
                  title: t('forgotPassword.title'),
                  animation: 'slide_from_bottom',
                }} 
              />
              <RootStack.Screen 
                name="ResetPassword" 
                component={ResetPasswordScreen} 
                options={{ 
                  title: t('resetPassword.title'),
                  animation: 'slide_from_bottom',
                }} 
              />
              <RootStack.Screen
                name="MainTabs"
                component={MainTabs}
                options={{ 
                  headerShown: false,
                  animation: 'fade',
                }}
              />
              <RootStack.Screen
                name="More"
                component={MoreScreen}
                options={({ navigation }) => ({
                  headerShown: true,
                  header: () => <Navbar navigation={navigation} />,
                  title: t('more.title'),
                })}
              />
              <RootStack.Screen 
                name="VerifyEmail" 
                component={VerifyEmailScreen} 
                options={{ 
                  title: t('verifyEmail.title'),
                  animation: 'slide_from_bottom',
                }} 
              />
              <RootStack.Screen name="ClubCourts" component={ClubCourtsScreen} />
              <RootStack.Screen name="CreateBooking" component={CreateBookingScreen} />
              <RootStack.Screen name="AdvancedBooking" component={AdvancedBookingScreen} />
              <RootStack.Screen
                name="AdminDashboard"
                component={AdminDashboardScreen}
                options={({ navigation }) => ({
                  headerShown: true,
                  header: () => <Navbar navigation={navigation} />,
                  title: t('more.adminDashboard'),
                  animation: 'slide_from_bottom',
                })}
              />
              <RootStack.Screen
                name="SuperAdmin"
                component={SuperAdminScreen}
                options={({ navigation }) => ({
                  headerShown: true,
                  header: () => <Navbar navigation={navigation} />,
                  title: t('superAdmin.title'),
                  animation: 'slide_from_bottom',
                })}
              />
              <RootStack.Screen
                name="ClubAdmin"
                component={ClubAdminScreen}
                options={({ navigation }) => ({
                  headerShown: true,
                  header: () => <Navbar navigation={navigation} />,
                  title: t('app.clubAdmin'),
                  animation: 'slide_from_bottom',
                })}
              />
            </RootStack.Navigator>
            <Toast />
          </NavigationContainer>
        </AuthProvider>
      </ThemeProvider>
    </ViewportProvider>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.courtBlueLight,
    padding: SPACING.xl,
  },
  logoContainer: {
    marginBottom: SPACING.xxl,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  logo: {
    width: 280,
    height: 280,
    resizeMode: 'contain',
  },
  splashTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.netDark,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  loadingDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingContent: {
    alignItems: 'center',
    gap: SPACING.lg,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.3,
    marginTop: SPACING.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default App;