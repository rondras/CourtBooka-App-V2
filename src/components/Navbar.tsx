import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  Animated,
  Platform,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../../App';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import logo from '../assets/Logo1200x600.png';
import UserMenu from './UserMenu';
import { COLORS, SPACING } from '../constants/colors';

const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation();
  const [isUserMenuVisible, setIsUserMenuVisible] = useState(false);
  
  // Animation values
  const logoScale = useRef(new Animated.Value(1)).current;
  const avatarScale = useRef(new Animated.Value(1)).current;
  const homeScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const avatarRotation = useRef(new Animated.Value(0)).current;

  // Entrance animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const animatePress = (animValue: Animated.Value, callback?: () => void) => {
    ReactNativeHapticFeedback.trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: 0.92,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => callback?.());
  };

  const toggleUserMenu = useCallback(() => {
    const toValue = isUserMenuVisible ? 0 : 1;
    
    Animated.spring(avatarRotation, {
      toValue,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
    
    setIsUserMenuVisible(!isUserMenuVisible);
  }, [isUserMenuVisible]);

  const handleAvatarPress = useCallback(() => {
    animatePress(avatarScale, toggleUserMenu);
  }, [toggleUserMenu]);

  const handleHomePress = useCallback(() => {
    animatePress(homeScale, () => {
      navigation.navigate('MainTabs', { screen: 'Dashboard' });
    });
  }, [navigation]);

  const handleLogoPress = useCallback(() => {
    animatePress(logoScale, () => {
      ReactNativeHapticFeedback.trigger('impactMedium');
      navigation.navigate('MainTabs', { screen: 'Dashboard' });
    });
  }, [navigation]);

  const avatarRotateInterpolate = avatarRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View 
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-10, 0],
            })}],
          },
        ]}
      >
        <View style={styles.contentWrapper}>
          <Pressable 
            onPress={handleLogoPress}
            style={styles.brand}
            accessibilityRole="button"
            accessibilityLabel={t('navbar.logo')}
          >
            <Animated.View
              style={[
                styles.logoContainer,
                { transform: [{ scale: logoScale }] },
              ]}
            >
              <Image 
                source={logo} 
                style={styles.logo} 
                accessibilityLabel={t('navbar.logo')}
              />
            </Animated.View>
          </Pressable>

          <View style={styles.right}>
            {isAuthenticated && (
              <View style={styles.avatarContainer}>
                <Pressable
                  onPress={handleAvatarPress}
                  accessibilityLabel={t('navbar.userMenu')}
                  accessibilityHint={t('navbar.userMenuHint')}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.iconButton,
                    styles.avatarButton,
                    pressed && styles.iconButtonPressed,
                    isUserMenuVisible && styles.avatarButtonActive,
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.iconWrapper,
                      {
                        transform: [
                          { scale: avatarScale },
                          { rotate: avatarRotateInterpolate },
                        ],
                      },
                    ]}
                  >
                    <Icon 
                      name="person" 
                      size={24} 
                      color={isUserMenuVisible ? COLORS.courtBlue : COLORS.netDark}
                    />
                  </Animated.View>
                  {isUserMenuVisible && <View style={styles.activeIndicator} />}
                </Pressable>
                <UserMenu isVisible={isUserMenuVisible} onClose={toggleUserMenu} />
              </View>
            )}

            <Pressable
              onPress={handleHomePress}
              accessibilityLabel={t('navbar.home')}
              accessibilityHint={t('navbar.homeHint')}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.iconButton,
                styles.homeButton,
                pressed && styles.iconButtonPressed,
              ]}
            >
              <Animated.View
                style={[
                  styles.iconWrapper,
                  { transform: [{ scale: homeScale }] },
                ]}
              >
                <Icon 
                  name="home" 
                  size={24} 
                  color={COLORS.netDark}
                />
              </Animated.View>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: COLORS.whiteLines,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  container: {
    backgroundColor: COLORS.whiteLines,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  contentWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minHeight: 64,
  },
  brand: {
    flex: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignSelf: 'flex-start',
    padding: SPACING.xs,
    borderRadius: 8,
  },
  logo: {
    width: 120,
    height: 48,
    resizeMode: 'contain',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  avatarContainer: {
    position: 'relative',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  avatarButton: {
    backgroundColor: COLORS.courtBlueLight,
  },
  homeButton: {
    backgroundColor: COLORS.grayLight,
  },
  avatarButtonActive: {
    backgroundColor: COLORS.courtBlue,
    borderColor: COLORS.courtBlueDark,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.courtBlue,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  iconButtonPressed: {
    backgroundColor: COLORS.courtBlueLight,
    borderColor: COLORS.courtBlue,
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    left: '50%',
    marginLeft: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.aceGreen,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.aceGreen,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
});

export default Navbar;