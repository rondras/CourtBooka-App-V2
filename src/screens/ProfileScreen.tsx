import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Platform, 
  Image,
  Dimensions,
  Pressable,
  ScrollView
} from 'react-native';
import Modal from 'react-native-modal';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeOut,
  Layout,
  ZoomIn,
  SlideInRight,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
  interpolate,
  Easing
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuth } from '../context/AuthContext';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { useTheme } from '../../App';
import { getAllClubs, getUserClubStatuses, joinClub, getProfilePicture, updateProfile, uploadProfilePicture } from '../api/api';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { COLORS, SPACING } from '../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false
};

interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  street?: string;
  houseNumber?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  role: string;
  created_at: string;
  is_active?: boolean;
  profile_picture_id?: string;
  profile_picture_filename?: string;
  wallets?: any[];
}

interface Club {
  id: number;
  name: string;
  city?: string;
  country?: string;
  status?: string;
}

const ProfileScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading, token, updateUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [emailError, setEmailError] = useState('');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
  const [clubSearchQuery, setClubSearchQuery] = useState('');
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const [isClubsLoading, setIsClubsLoading] = useState(false);
  const [isAddingClub, setIsAddingClub] = useState(false);
  const [showClubModal, setShowClubModal] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);

  // Animation values
  const editModeAnimation = useSharedValue(0);
  const profileImageScale = useSharedValue(1);

  const styles = useMemo(() => createStyles(), []);

  // Animated styles
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          editModeAnimation.value,
          [0, 1],
          [1, 1.02]
        )
      }
    ],
    shadowOpacity: interpolate(
      editModeAnimation.value,
      [0, 1],
      [0.08, 0.15]
    )
  }));

  const profileImageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: profileImageScale.value }]
  }));

  useEffect(() => {
    editModeAnimation.value = withSpring(isEditing ? 1 : 0, {
      damping: 15,
      stiffness: 100
    });
  }, [isEditing]);

  useEffect(() => {
    if (!user || !token) return;

    const fetchProfilePicture = async () => {
      try {
        const uri = await getProfilePicture(user.id);
        setProfileImageUrl(uri);
      } catch (err) {
        console.error('Fetch profile picture error:', err);
      }
    };

    fetchProfilePicture();
  }, [user, token]);

  useEffect(() => {
    if (user) {
      setFormData({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        street: user.street,
        houseNumber: user.houseNumber,
        city: user.city,
        postalCode: user.postalCode,
        country: user.country,
        email: user.email,
        role: user.role,
      });
    }
  }, [user]);

  useEffect(() => {
    if (success || error || emailError) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
        setEmailError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error, emailError]);

  useEffect(() => {
    const fetchClubs = async () => {
      if (!token) {
        setError(t('profile.notAuthenticated'));
        return;
      }
      setIsClubsLoading(true);
      try {
        const data = await getAllClubs();
        setClubs(data || []);
      } catch (err: any) {
        console.error('Fetch all clubs error:', err.response?.status, err.response?.data || err.message);
        setError(t('profile.fetchClubsError'));
      } finally {
        setIsClubsLoading(false);
      }
    };

    const fetchUserClubs = async () => {
      if (!token || !user) return;
      setIsClubsLoading(true);
      try {
        const data = await getUserClubStatuses();
        setUserClubs(data || []);
      } catch (err: any) {
        console.error('Fetch user club statuses error:', err.response?.status, err.response?.data || err.message);
        setError(t('profile.fetchUserClubsError'));
      } finally {
        setIsClubsLoading(false);
      }
    };

    fetchClubs();
    fetchUserClubs();
  }, [token, user, t]);

  const validateEmail = useCallback((text: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailError(emailRegex.test(text) ? '' : t('profile.errorInvalidEmail'));
    setFormData((prev) => ({ ...prev, email: text }));
  }, [t]);

  const handleInputChange = useCallback((name: string, value: string) => {
    if (name === 'email') {
      validateEmail(value);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  }, [validateEmail]);

  const handleSaveProfile = useCallback(async () => {
    if (emailError) return;

    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setIsSaving(true);
    try {
      const updatedUser = await updateProfile(formData);
      updateUser(updatedUser);
      setSuccess(t('profile.success'));
      setIsEditing(false);
      ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
    } catch (err: any) {
      const message = err.response?.data?.error || t('profile.error');
      setError(message);
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
    } finally {
      setIsSaving(false);
    }
  }, [emailError, formData, t, updateUser]);

  const checkPermissions = useCallback(async (source: 'camera' | 'gallery') => {
    let permission;
    if (source === 'camera') {
      permission = Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;
    } else {
      permission = Platform.OS === 'ios' ? PERMISSIONS.IOS.PHOTO_LIBRARY : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
    }
    let result = await check(permission);
    if (result === RESULTS.DENIED) {
      result = await request(permission);
    }
    return result === RESULTS.GRANTED;
  }, []);

  const handleUploadImage = useCallback(async (source: 'camera' | 'gallery') => {
    if (!await checkPermissions(source)) {
      setError(t('profile.permissionDenied'));
      return;
    }

    const options = { mediaType: 'photo' as const, quality: 1 };
    const result = source === 'camera' ? await launchCamera(options) : await launchImageLibrary(options);

    if (result.didCancel || result.errorCode || !result.assets?.[0].uri) return;

    const asset = result.assets[0];
    const file = {
      uri: asset.uri,
      name: `profile_${Date.now()}.jpg`,
      type: asset.type || 'image/jpeg',
    };

    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      setError(t('profile.fileTooLarge'));
      return;
    }

    setIsUploading(true);
    setShowImageOptions(false);
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    
    try {
      const uploadResponse = await uploadProfilePicture(file.uri, file.type, file.name);
      await updateUser({
        profile_picture_id: uploadResponse.profile_picture_id,
        profile_picture_filename: uploadResponse.profile_picture_filename,
      });
      setProfileImageUrl(file.uri);
      setSuccess(t('profile.profilePictureUploadSuccess'));
      ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
    } catch (err: any) {
      const message = err.response?.data?.error || t('profile.profilePictureUploadError');
      setError(message);
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
    } finally {
      setIsUploading(false);
    }
  }, [checkPermissions, t, updateUser]);

  const handleAddClub = useCallback(async () => {
    if (!selectedClubId) return;

    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setIsAddingClub(true);
    try {
      await joinClub(selectedClubId);
      setSuccess(t('profile.clubAddedSuccess'));
      setSelectedClubId(null);
      setClubSearchQuery('');
      setShowClubModal(false);
      const userClubsData = await getUserClubStatuses();
      setUserClubs(userClubsData || []);
      ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
    } catch (err: any) {
      const message = err.response?.data?.error || t('profile.clubAddError');
      setError(message);
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
    } finally {
      setIsAddingClub(false);
    }
  }, [selectedClubId, t]);

  const filteredClubs = useMemo(() => 
    clubs.filter((club) =>
      club.name.toLowerCase().includes(clubSearchQuery.toLowerCase()) &&
      !userClubs.some((userClub) => userClub.id === club.id && (userClub.status === 'approved' || userClub.status === 'pending'))
    ), [clubs, clubSearchQuery, userClubs]
  );

  const handleProfileImagePress = useCallback(() => {
    profileImageScale.value = withSpring(0.95, {}, () => {
      profileImageScale.value = withSpring(1);
    });
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setShowImageOptions(true);
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={COLORS.courtBlue} />
        <Text style={[styles.loadingText, { color: COLORS.netDark }]}>{t('profile.loading')}</Text>
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Icon name="lock-outline" size={64} color={COLORS.grayMedium} style={{ marginBottom: SPACING.lg }} />
        <Text style={[styles.loadingText, { color: COLORS.netDark }]}>{t('profile.notAuthenticated')}</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.gradientBackground}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          extraHeight={120}
          extraScrollHeight={120}
          enableResetScrollToCoords={false}
          keyboardOpeningTime={0}
          scrollEventThrottle={16}
          keyboardDismissMode="on-drag"
          bounces={true}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <View style={styles.headerGradient}>
              <Text style={styles.title}>{t('profile.title')}</Text>
              <Text style={styles.subtitle}>
                {user.firstName} {user.lastName}
              </Text>
            </View>
          </Animated.View>

          {/* Messages */}
          {(error || success || emailError) && (
            <Animated.View 
              entering={ZoomIn.duration(300).springify()} 
              exiting={FadeOut.duration(200)}
              style={styles.messageContainer}
            >
              {error && (
                <View style={[styles.message, styles.errorMessage]}>
                  <Icon name="error-outline" size={20} color={COLORS.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              {success && (
                <View style={[styles.message, styles.successMessage]}>
                  <Icon name="check-circle" size={20} color={COLORS.aceGreen} />
                  <Text style={styles.successText}>{success}</Text>
                </View>
              )}
              {emailError && (
                <View style={[styles.message, styles.warningMessage]}>
                  <Icon name="warning" size={20} color={COLORS.warningYellow} />
                  <Text style={styles.warningText}>{emailError}</Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* Profile Picture Section */}
          <Animated.View 
            entering={FadeInDown.duration(400).delay(100).springify()} 
            style={styles.section}
          >
            <AnimatedPressable
              onPress={handleProfileImagePress}
              style={[styles.pictureCard, profileImageAnimatedStyle]}
            >
              <View style={styles.pictureContainer}>
                {profileImageUrl ? (
                  <Image
                    source={{ uri: profileImageUrl }}
                    style={styles.picture}
                    accessibilityLabel={t('profile.profilePicture')}
                  />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </Text>
                  </View>
                )}
                <TouchableOpacity 
                  style={styles.cameraButton}
                  onPress={handleProfileImagePress}
                  activeOpacity={0.8}
                >
                  <Icon name="camera-alt" size={20} color={COLORS.whiteLines} />
                </TouchableOpacity>
                {isUploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.courtBlue} />
                  </View>
                )}
              </View>
            </AnimatedPressable>
            <Text style={styles.profileName}>
              {user.firstName} {user.lastName}
            </Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
          </Animated.View>

          {/* Personal Info Section */}
          <Animated.View 
            entering={FadeInDown.duration(400).delay(200).springify()} 
            style={[styles.section, cardAnimatedStyle]}
          >
            <View style={styles.sectionHeader}>
              <Icon name="person" size={24} color={COLORS.courtBlue} />
              <Text style={styles.sectionTitle}>{t('profile.personalInfo')}</Text>
              {!isEditing && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
                    setIsEditing(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Icon name="edit" size={20} color={COLORS.courtBlue} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.card}>
              {isEditing ? (
                <Animated.View 
                  entering={FadeIn.duration(300)} 
                  style={styles.form}
                >
                  {[
                    { label: t('profile.firstName'), name: 'firstName', icon: 'person' },
                    { label: t('profile.lastName'), name: 'lastName', icon: 'person' },
                    { label: t('profile.email'), name: 'email', icon: 'email', keyboardType: 'email-address' },
                    { label: t('profile.street'), name: 'street', icon: 'home' },
                    { label: t('profile.houseNumber'), name: 'houseNumber', icon: 'home' },
                    { label: t('profile.city'), name: 'city', icon: 'location-city' },
                    { label: t('profile.postalCode'), name: 'postalCode', icon: 'markunread-mailbox' },
                    { label: t('profile.country'), name: 'country', icon: 'public' },
                  ].map((field, index) => (
                    <Animated.View
                      key={field.name}
                      entering={SlideInRight.duration(300).delay(index * 50)}
                      style={styles.formGroup}
                    >
                      <Text style={styles.label}>{field.label}</Text>
                      <View style={[
                        styles.inputContainer, 
                        field.name === 'email' && emailError ? styles.inputError : null
                      ]}>
                        <Icon name={field.icon} size={20} color={COLORS.grayMedium} style={styles.icon} />
                        <TextInput
                          style={styles.input}
                          value={formData[field.name] || ''}
                          onChangeText={(text) => handleInputChange(field.name, text)}
                          placeholder={field.label}
                          placeholderTextColor={COLORS.grayMedium}
                          keyboardType={field.keyboardType || 'default'}
                          autoCapitalize={field.name === 'email' ? 'none' : 'words'}
                          accessibilityLabel={field.label}
                        />
                      </View>
                    </Animated.View>
                  ))}
                  <View style={styles.formActions}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={() => {
                        ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
                        setIsEditing(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cancelButtonText}>{t('profile.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.primaryButton, isSaving && styles.disabledButton]}
                      onPress={handleSaveProfile}
                      disabled={isSaving || !!emailError}
                      activeOpacity={0.8}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color={COLORS.whiteLines} />
                      ) : (
                        <>
                          <Icon name="save" size={20} color={COLORS.whiteLines} />
                          <Text style={styles.primaryButtonText}>{t('profile.save')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ) : (
                <View style={styles.info}>
                  {[
                    { label: t('profile.street'), value: user.street },
                    { label: t('profile.houseNumber'), value: user.houseNumber },
                    { label: t('profile.city'), value: user.city },
                    { label: t('profile.postalCode'), value: user.postalCode },
                    { label: t('profile.country'), value: user.country },
                  ].map((item, index) => (
                    item.value && (
                      <Animated.View
                        key={item.label}
                        entering={FadeIn.duration(300).delay(index * 50)}
                        style={styles.infoRow}
                      >
                        <Text style={styles.infoLabel}>{item.label}</Text>
                        <Text style={styles.infoValue}>{item.value}</Text>
                      </Animated.View>
                    )
                  ))}
                </View>
              )}
            </View>
          </Animated.View>

          {/* Clubs Section */}
          <Animated.View 
            entering={FadeInDown.duration(400).delay(300).springify()} 
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <Icon name="groups" size={24} color={COLORS.courtBlue} />
              <Text style={styles.sectionTitle}>{t('profile.yourClubs')}</Text>
            </View>

            <View style={styles.card}>
              {isClubsLoading ? (
                <View style={styles.loadingClubs}>
                  <ActivityIndicator size="large" color={COLORS.courtBlue} />
                </View>
              ) : (
                <>
                  {userClubs.length > 0 ? (
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.clubsScroll}
                    >
                      {userClubs.map((item, index) => (
                        <Animated.View
                          key={item.id}
                          entering={ZoomIn.duration(300).delay(index * 100)}
                        >
                          <View 
                            style={[
                              styles.clubChip,
                              item.status === 'pending' ? styles.clubChipPending : styles.clubChipApproved
                            ]}
                          >
                            <Icon 
                              name={item.status === 'pending' ? 'schedule' : 'verified'} 
                              size={16} 
                              color={COLORS.whiteLines} 
                            />
                            <Text style={styles.clubChipText}>
                              {item.name || t('profile.unknown')}
                            </Text>
                          </View>
                        </Animated.View>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.emptyClubs}>
                      <Icon name="group-add" size={48} color={COLORS.grayMedium} />
                      <Text style={styles.emptyText}>{t('profile.noClubsAssigned')}</Text>
                    </View>
                  )}
                  
                  <TouchableOpacity
                    style={[styles.button, styles.addClubButton]}
                    onPress={() => {
                      ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
                      setShowClubModal(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Icon name="add" size={20} color={COLORS.courtBlue} />
                    <Text style={styles.addClubButtonText}>{t('profile.addClub')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Animated.View>
        </KeyboardAwareScrollView>
      </View>

      {/* Image Options Modal */}
      <Modal
        isVisible={showImageOptions}
        onBackdropPress={() => setShowImageOptions(false)}
        style={styles.modal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.5}
        useNativeDriverForBackdrop
      >
        <View style={styles.imageOptionsModal}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('profile.changePhoto')}</Text>
          
          <TouchableOpacity
            style={[styles.imageOption, styles.imageOptionCamera]}
            onPress={() => handleUploadImage('camera')}
            activeOpacity={0.8}
          >
            <Icon name="camera-alt" size={24} color={COLORS.whiteLines} />
            <Text style={styles.imageOptionText}>{t('profile.uploadPhotoCamera')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.imageOption, styles.imageOptionGallery]}
            onPress={() => handleUploadImage('gallery')}
            activeOpacity={0.8}
          >
            <Icon name="photo-library" size={24} color={COLORS.whiteLines} />
            <Text style={styles.imageOptionText}>{t('profile.uploadPhotoGallery')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Club Selection Modal */}
      <Modal
        isVisible={showClubModal}
        onBackdropPress={() => setShowClubModal(false)}
        style={styles.modal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.5}
        useNativeDriverForBackdrop
      >
        <KeyboardAwareScrollView
          contentContainerStyle={styles.modalContentWrapper}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          extraHeight={100}
          extraScrollHeight={100}
          enableResetScrollToCoords={false}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.addClub')}</Text>
              <TouchableOpacity
                style={styles.closeIcon}
                onPress={() => setShowClubModal(false)}
                activeOpacity={0.7}
              >
                <Icon name="close" size={24} color={COLORS.grayMedium} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Icon name="search" size={20} color={COLORS.grayMedium} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('profile.clubSearchPlaceholder')}
                placeholderTextColor={COLORS.grayMedium}
                value={clubSearchQuery}
                onChangeText={setClubSearchQuery}
                accessibilityLabel={t('profile.clubSearchPlaceholder')}
              />
            </View>

            <ScrollView style={styles.clubList} showsVerticalScrollIndicator={false}>
              {filteredClubs.map((item, index) => (
                <Animated.View
                  key={item.id}
                  entering={FadeIn.duration(300).delay(index * 50)}
                >
                  <TouchableOpacity
                    style={[
                      styles.clubItem,
                      selectedClubId === item.id && styles.clubItemSelected
                    ]}
                    onPress={() => {
                      ReactNativeHapticFeedback.trigger('selection', hapticOptions);
                      setSelectedClubId(item.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.clubItemContent}>
                      <Text style={styles.clubItemName}>{item.name || t('profile.unknown')}</Text>
                      <Text style={styles.clubItemLocation}>
                        {item.city || t('profile.unknown')}, {item.country || t('profile.unknown')}
                      </Text>
                    </View>
                    {selectedClubId === item.id && (
                      <Icon name="check-circle" size={24} color={COLORS.aceGreen} />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              ))}
              {filteredClubs.length === 0 && (
                <View style={styles.emptyClubs}>
                  <Icon name="search-off" size={48} color={COLORS.grayMedium} />
                  <Text style={styles.emptyText}>{t('profile.noClubsFound')}</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.button, 
                styles.modalPrimaryButton,
                (!selectedClubId || isAddingClub) && styles.disabledButton
              ]}
              onPress={handleAddClub}
              disabled={!selectedClubId || isAddingClub}
              activeOpacity={0.8}
            >
              {isAddingClub ? (
                <ActivityIndicator size="small" color={COLORS.whiteLines} />
              ) : (
                <>
                  <Icon name="add" size={20} color={COLORS.whiteLines} />
                  <Text style={styles.primaryButtonText}>{t('profile.joinClub')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </Modal>
    </>
  );
};

const createStyles = () => StyleSheet.create({
  gradientBackground: {
    flex: 1,
    backgroundColor: COLORS.grayLight,
  },
  container: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  headerGradient: {
    backgroundColor: COLORS.courtBlue,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: COLORS.whiteLines,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
    color: COLORS.whiteLines,
    opacity: 0.9,
  },
  messageContainer: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  message: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorMessage: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  successMessage: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.aceGreen,
  },
  warningMessage: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warningYellow,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginLeft: SPACING.sm,
    flex: 1,
  },
  successText: {
    color: COLORS.aceGreen,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginLeft: SPACING.sm,
    flex: 1,
  },
  warningText: {
    color: '#F57C00',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginLeft: SPACING.sm,
    flex: 1,
  },
  section: {
    marginTop: SPACING.xl,
    marginHorizontal: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.netDark,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  editButton: {
    padding: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.courtBlueLight,
  },
  card: {
    backgroundColor: COLORS.whiteLines,
    borderRadius: 20,
    padding: SPACING.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  pictureCard: {
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  pictureContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.whiteLines,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  picture: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: COLORS.courtBlue,
  },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: COLORS.courtBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 48,
    fontFamily: 'Inter-Bold',
    color: COLORS.whiteLines,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: COLORS.courtBlue,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.whiteLines,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  profileEmail: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    textAlign: 'center',
  },
  form: {
    gap: SPACING.md,
  },
  formGroup: {
    marginBottom: SPACING.sm,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.grayMedium,
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grayLight,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: '#FFEBEE',
  },
  icon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: COLORS.netDark,
  },
  formActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  info: {
    gap: SPACING.sm,
  },
  infoRow: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: COLORS.grayMedium,
    marginBottom: SPACING.xs,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: COLORS.netDark,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  primaryButton: {
    backgroundColor: COLORS.courtBlue,
    flex: 1,
    shadowColor: COLORS.courtBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelButton: {
    backgroundColor: COLORS.grayLight,
    flex: 1,
  },
  primaryButtonText: {
    color: COLORS.whiteLines,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  cancelButtonText: {
    color: COLORS.grayMedium,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  addClubButton: {
    backgroundColor: COLORS.courtBlueLight,
    marginTop: SPACING.md,
  },
  addClubButtonText: {
    color: COLORS.courtBlue,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  disabledButton: {
    backgroundColor: COLORS.disabled,
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginTop: SPACING.lg,
  },
  loadingClubs: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
  },
  clubsScroll: {
    marginBottom: SPACING.md,
  },
  clubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 20,
    marginRight: SPACING.sm,
    gap: SPACING.xs,
  },
  clubChipApproved: {
    backgroundColor: COLORS.aceGreen,
  },
  clubChipPending: {
    backgroundColor: COLORS.warningYellow,
  },
  clubChipText: {
    color: COLORS.whiteLines,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  emptyClubs: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContentWrapper: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.whiteLines,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xxxl : SPACING.xl,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.grayBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: COLORS.netDark,
    flex: 1,
  },
  closeIcon: {
    padding: SPACING.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grayLight,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    height: 48,
    marginBottom: SPACING.lg,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: COLORS.netDark,
  },
  clubList: {
    maxHeight: 300,
    marginBottom: SPACING.lg,
  },
  clubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.grayLight,
  },
  clubItemSelected: {
    backgroundColor: COLORS.courtBlueLight,
    borderWidth: 2,
    borderColor: COLORS.courtBlue,
  },
  clubItemContent: {
    flex: 1,
  },
  clubItemName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.netDark,
  },
  clubItemLocation: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: COLORS.grayMedium,
    marginTop: SPACING.xs,
  },
  modalPrimaryButton: {
    backgroundColor: COLORS.courtBlue,
    shadowColor: COLORS.courtBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  imageOptionsModal: {
    backgroundColor: COLORS.whiteLines,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xxxl : SPACING.xl,
  },
  imageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: 16,
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  imageOptionCamera: {
    backgroundColor: COLORS.courtBlue,
  },
  imageOptionGallery: {
    backgroundColor: COLORS.aceGreen,
  },
  imageOptionText: {
    color: COLORS.whiteLines,
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
});

export default ProfileScreen;