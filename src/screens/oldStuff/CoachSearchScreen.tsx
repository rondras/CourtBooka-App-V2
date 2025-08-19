import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Platform,
  useColorScheme,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import RNFS from 'react-native-fs';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';

interface Coach {
  id: number;
  firstName: string;
  lastName: string;
  city: string;
  country: string;
  profile_picture_id?: string;
}

interface Club {
  id: number;
  name: string;
}

interface ProfileImage {
  [key: number]: string | null;
}

const CoachSearchScreen: React.FC = () => {
  const scheme = useColorScheme();
  const isDarkMode = scheme === 'dark';

  const colors = {
    background: isDarkMode ? '#1C1C1E' : '#F9F9F9',
    text: isDarkMode ? '#FFFFFF' : '#2C3E50',
    inputBg: isDarkMode ? '#2C2C2E' : '#FFFFFF',
    placeholder: isDarkMode ? '#A1A1A3' : '#7B8A8B',
    primary: '#2ECC71',
    secondary: '#E67E22',
    error: '#E74C3C',
    success: '#2ECC71',
    surface: isDarkMode ? '#2C2C2E' : '#FFFFFF',
    muted: isDarkMode ? '#A1A1A3' : '#CCC',
  };

  const { user, token } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClub, setSelectedClub] = useState<number | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [requestsMap, setRequestsMap] = useState<{ [key: number]: string }>({});
  const [profileImages, setProfileImages] = useState<ProfileImage>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const searchDebounce = useRef<NodeJS.Timeout | null>(null);

  const fetchClubs = useCallback(async () => {
    if (!token) {
      setError('Bitte melden Sie sich an, um Clubs zu laden');
      return;
    }
    try {
      const response = await axios.get('https://api.jurite.de/users/me/clubs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClubs(response.data);
      if (response.data.length > 0) {
        setSelectedClub(response.data[0].id);
      }
    } catch (err: any) {
      setError('Clubs konnten nicht geladen werden.');
    }
  }, [token]);

  const fetchData = useCallback(async () => {
    if (!token) {
      setError('Bitte melden Sie sich an, um Trainer zu suchen');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const coachesUrl = 'https://api.jurite.de/coach/search-coaches';
      const coachesParams = { query: searchQuery, club_id: selectedClub || undefined };
      const requestsUrl = 'https://api.jurite.de/coach/coach/requests';

      const [coachesRes, requestsRes] = await Promise.all([
        axios.get(coachesUrl, {
          params: coachesParams,
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(requestsUrl, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setCoaches(coachesRes.data);

      const reqMap = requestsRes.data.reduce(
        (acc: { [key: number]: string }, req: { coach_id: number; status: string }) => {
          acc[req.coach_id] = req.status;
          return acc;
        },
        {}
      );
      setRequestsMap(reqMap);

      setError(null);
    } catch (err: any) {
      setError('Trainer konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedClub, token]);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    const fetchProfilePictures = async () => {
      if (!token || coaches.length === 0) return;

      const newProfileImages: ProfileImage = {};
      for (const coach of coaches) {
        if (!newProfileImages[coach.id]) {
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
          } catch (err: any) {
            newProfileImages[coach.id] = null;
          }
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

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const sendRequest = async (coachId: number) => {
    try {
      const response = await axios.post(
        'https://api.jurite.de/coach/coach/request',
        { coach_id: coachId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRequestsMap((prev) => ({ ...prev, [coachId]: 'pending' }));
      setSuccess('Anfrage erfolgreich gesendet!');
      fetchData();
    } catch (err: any) {
      setError('Anfrage konnte nicht gesendet werden.');
    }
  };

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchData();
    }, 300);
  };

  const renderCoachCard = ({ item }: { item: Coach }) => {
    const status = requestsMap[item.id];
    const cardScale = new Animated.Value(1);
    const onPressIn = () => Animated.timing(cardScale, { toValue: 0.98, duration: 100, useNativeDriver: true }).start();
    const onPressOut = () => Animated.timing(cardScale, { toValue: 1, duration: 100, useNativeDriver: true }).start();

    return (
      <Animated.View style={{ transform: [{ scale: cardScale }] }}>
        <Animatable.View
          animation="fadeIn"
          duration={500}
          style={[styles.coachCard, { backgroundColor: colors.surface }]}
          accessibilityLabel={`Trainer ${item.firstName} ${item.lastName}`}
        >
          <View style={styles.coachHeader}>
            {profileImages[item.id] ? (
              <Image
                source={{ uri: profileImages[item.id] }}
                style={styles.avatarImage}
                onError={() => {
                  setProfileImages((prev) => ({ ...prev, [item.id]: null }));
                }}
                accessibilityLabel={`Profilbild von ${item.firstName} ${item.lastName}`}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{`${item.firstName[0]}${item.lastName[0]}`}</Text>
              </View>
            )}
            <View style={styles.coachInfo}>
              <Text style={[styles.coachName, { color: colors.text }]}>{`${item.firstName} ${item.lastName}`}</Text>
              <Text style={[styles.coachLocation, { color: colors.muted }]}>{`${item.city}, ${item.country}`}</Text>
            </View>
          </View>
          {status === 'accepted' ? (
            <Text style={[styles.statusText, { color: colors.success }]}>Verbunden</Text>
          ) : status === 'pending' ? (
            <Text style={[styles.statusText, { color: colors.muted }]}>Anfrage gesendet</Text>
          ) : (
            <TouchableOpacity
              style={[styles.connectButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                animateButton();
                sendRequest(item.id);
              }}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              accessibilityLabel={`Mit ${item.firstName} verbinden`}
            >
              <Animated.Text style={[styles.connectText, { transform: [{ scale: scaleAnim }], color: colors.buttonText }]}>
                Verbinden
              </Animated.Text>
            </TouchableOpacity>
          )}
        </Animatable.View>
      </Animated.View>
    );
  };

  if (user?.role !== 'student') {
    return <Text style={[styles.errorText, { color: colors.error }]}>Nur Schüler können Trainer suchen.</Text>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Trainer suchen</Text>
      <View style={styles.messageContainer}>
        {error && (
          <Animatable.Text animation="fadeIn" style={[styles.error, { color: colors.error }]}>
            {error}
          </Animatable.Text>
        )}
        {success && (
          <Animatable.Text animation="fadeIn" style={[styles.success, { color: colors.success }]}>
            {success}
          </Animatable.Text>
        )}
      </View>
      <View style={styles.searchContainer}>
        <View style={[styles.inputContainer, { backgroundColor: colors.inputBg }]}>
          <Icon name="search" size={24} color={colors.placeholder} style={styles.icon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder="Nach Name oder Ort suchen"
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Trainer suchen"
          />
        </View>
        <View style={[styles.pickerContainer, { backgroundColor: colors.inputBg }]}>
          <Picker
            selectedValue={selectedClub}
            onValueChange={(itemValue) => setSelectedClub(itemValue)}
            style={[styles.picker, Platform.OS === 'ios' ? styles.pickerIOS : styles.pickerAndroid, { color: colors.text }]}
            accessibilityLabel="Club auswählen"
            dropdownIconColor={colors.text}
          >
            <Picker.Item label="Alle Clubs" value={null} />
            {clubs.length === 0 ? (
              <Picker.Item label="Keine Clubs verfügbar" value={null} enabled={false} />
            ) : (
              clubs.map((club) => (
                <Picker.Item key={club.id} label={club.name} value={club.id} />
              ))
            )}
          </Picker>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={coaches}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderCoachCard}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.text }]}>Keine Trainer gefunden.</Text>}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
          getItemLayout={(_, index) => ({ length: 100, offset: 100 * index, index })}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
  },
  messageContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  error: {
    fontSize: 16,
    fontWeight: 'bold',
    padding: 8,
    borderRadius: 4,
  },
  success: {
    fontSize: 16,
    fontWeight: 'bold',
    padding: 8,
    borderRadius: 4,
  },
  searchContainer: {
    zIndex: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingLeft: 10,
    paddingRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    height: 48,
    marginBottom: 15,
  },
  icon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
    height: 48,
  },
  pickerContainer: {
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  picker: {
    height: Platform.OS === 'ios' ? 150 : 48,
  },
  pickerIOS: {
    height: 200,
  },
  pickerAndroid: {
    height: 48,
  },
  loader: {
    marginTop: 20,
  },
  coachCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  coachInfo: {
    flex: 1,
  },
  coachName: {
    fontSize: 18,
    fontWeight: '600',
  },
  coachLocation: {
    fontSize: 14,
  },
  connectButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
});

export default CoachSearchScreen;
