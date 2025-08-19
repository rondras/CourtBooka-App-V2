import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, View, Text, Image, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Animated, useColorScheme } from 'react-native';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/MaterialIcons';
import noMessages from '../assets/no-messages.png';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import RNFS from 'react-native-fs';

interface Coach {
  id: number;
  firstName: string;
  lastName: string;
  profile_picture_id: string | null;
}

interface ProfileImage {
  [key: number]: string | null;
}

const StudentsScreen: React.FC = () => {
  const scheme = useColorScheme();
  const isDarkMode = scheme === 'dark';

  const colors = {
    background: isDarkMode ? '#121212' : '#FAFAFA', // Softer for premium feel
    text: isDarkMode ? '#EDEDED' : '#1A1A1A',
    primary: '#4CAF50', // Slightly deeper green
    secondary: '#FF9800',
    error: '#EF5350',
    success: '#4CAF50',
    surface: isDarkMode ? '#1E1E1E' : '#FFFFFF',
    muted: isDarkMode ? '#9E9E9E' : '#757575',
    accent: '#FFC107',
  };

  const { user, token } = useAuth();
  const navigation = useNavigation();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profileImages, setProfileImages] = useState<ProfileImage>({});

  if (user?.role !== 'student') {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Animatable.Text animation="fadeIn" style={[styles.error, { color: colors.error }]}>
          Nur Schüler können auf diese Seite zugreifen.
        </Animatable.Text>
      </SafeAreaView>
    );
  }

  const fetchCoaches = useCallback(async () => {
    setIsLoading(true);
    try {
      const [coachesRes, requestsRes] = await Promise.all([
        axios.get('https://api.jurite.de/coach/search-coaches', {
          params: { query: '' },
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('https://api.jurite.de/coach/coach/requests', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const reqMap = requestsRes.data.reduce(
        (acc: { [key: number]: string }, req: { coach_id: number; status: string }) => {
          acc[req.coach_id] = req.status;
          return acc;
        },
        {}
      );

      const acceptedCoaches: Coach[] = coachesRes.data
        .filter((coach: any) => reqMap[coach.id] === 'accepted')
        .map((coach: any) => ({
          id: coach.id,
          firstName: coach.firstName,
          lastName: coach.lastName,
          profile_picture_id: coach.profile_picture_id || null,
        }));

      setCoaches(acceptedCoaches);
      setError(null);
    } catch (error: any) {
      setError('Coaches konnten nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  useFocusEffect(
    useCallback(() => {
      fetchCoaches();
    }, [fetchCoaches])
  );

  useEffect(() => {
    const fetchProfilePictures = async () => {
      if (!token || coaches.length === 0) return;

      const newProfileImages: ProfileImage = {};
      for (const coach of coaches) {
        if (coach.profile_picture_id) {
          try {
            const filename = `profile_picture_${coach.id}.png`;
            const tempPath = `${RNFS.TemporaryDirectoryPath}/${filename}`;
            const url = `https://api.jurite.de/auth/users/${coach.id}/profile-picture`;

            const res = await RNFS.downloadFile({
              fromUrl: url,
              toFile: tempPath,
              headers: { Authorization: `Bearer ${token}` },
            }).promise;

            if (res.statusCode === 200) {
              newProfileImages[coach.id] = `file://${tempPath}`;
            } else {
              newProfileImages[coach.id] = null;
            }
          } catch (err) {
            newProfileImages[coach.id] = null;
          }
        } else {
          newProfileImages[coach.id] = null;
        }
      }
      setProfileImages(newProfileImages);
    };

    fetchProfilePictures();

    return () => {
      Object.values(profileImages).forEach((uri) => {
        if (uri) {
          const path = uri.replace('file://', '');
          RNFS.unlink(path).catch((err) => console.warn('Error deleting temp file:', err));
        }
      });
    };
  }, [coaches, token]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCoaches().finally(() => setRefreshing(false));
  }, [fetchCoaches]);

  const navigateToPushToTalk = (coach: Coach) => {
    navigation.navigate('StudentPushToTalk', { coach });
  };

  const renderCoachItem = ({ item, index }: { item: Coach; index: number }) => {
    const scaleAnim = new Animated.Value(1);
    const onPressIn = () => Animated.timing(scaleAnim, { toValue: 0.95, duration: 150, useNativeDriver: true }).start();
    const onPressOut = () => Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Animatable.View
          animation="bounceInUp"
          duration={600}
          delay={index * 150}
          easing="ease-out"
          style={styles.coachItem}
        >
          <TouchableOpacity
            style={[styles.coachButton, { backgroundColor: colors.surface }]}
            onPress={() => navigateToPushToTalk(item)}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            accessibilityLabel={`Verbinden mit ${item.firstName} ${item.lastName}`}
            accessibilityRole="button"
          >
            <View style={styles.coachHeader}>
              {profileImages[item.id] ? (
                <Image
                  source={{ uri: profileImages[item.id] }}
                  style={styles.avatarImage}
                  accessibilityLabel={`Profilbild von ${item.firstName} ${item.lastName}`}
                />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>
                    {item.firstName?.[0] || 'C'}
                  </Text>
                </View>
              )}
              <View style={styles.coachInfo}>
                <Text style={[styles.coachName, { color: colors.text }]}>
                  {item.firstName} {item.lastName}
                </Text>
              </View>
              <Icon name="chevron-right" size={28} color={colors.muted} />
            </View>
          </TouchableOpacity>
        </Animatable.View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Meine Coaches</Text>
      {error && (
        <Animatable.Text animation="shake" duration={500} style={[styles.error, { color: colors.error }]}>
          {error}
        </Animatable.Text>
      )}
      {isLoading && coaches.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Animatable.View animation="pulse" iterationCount="infinite" duration={800}>
            <Icon name="refresh" size={48} color={colors.primary} />
          </Animatable.View>
          <Text style={[styles.loadingText, { color: colors.text }]}>Laden...</Text>
        </View>
      ) : coaches.length === 0 ? (
        <Animatable.View animation="fadeIn" duration={1000} style={styles.emptyState}>
          <Image source={noMessages} style={[styles.emptyImage, { tintColor: colors.accent }]} />
          <Text style={[styles.emptyText, { color: colors.text }]}>
            Keine Coaches gefunden. Kontaktieren Sie Ihren Administrator!
          </Text>
        </Animatable.View>
      ) : (
        <FlatList
          data={coaches}
          renderItem={renderCoachItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.coachList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          getItemLayout={(_, index) => ({ length: 96, offset: 96 * index, index })} // Adjusted for larger items
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingVertical: 32 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 32, marginTop: 32, textAlign: 'center', letterSpacing: 0.5 },
  error: {
    fontSize: 15,
    textAlign: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
    backgroundColor: '#FFEBEE', // Subtle bg for errors
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 18, marginTop: 20, fontWeight: '500' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyImage: { width: 160, height: 160, resizeMode: 'contain', opacity: 0.9 },
  emptyText: { fontSize: 18, marginTop: 24, textAlign: 'center', fontWeight: '500', lineHeight: 26 },
  coachList: { paddingBottom: 40 },
  coachItem: {
    marginBottom: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  coachButton: {
    padding: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  coachHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    borderWidth: 1.5,
    borderColor: '#4CAF5033', // Subtle accent border
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 20,
    borderWidth: 1.5,
    borderColor: '#4CAF5033',
  },
  avatarText: { fontSize: 24, color: '#FFFFFF', fontWeight: '700' },
  coachInfo: { flex: 1 },
  coachName: { fontSize: 20, fontWeight: '600', letterSpacing: 0.3 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default StudentsScreen;