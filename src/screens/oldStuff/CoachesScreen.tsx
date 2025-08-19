import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  Animated,
  FlatList,
  RefreshControl,
  TextInput,
  useColorScheme,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import RNFS from 'react-native-fs';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/MaterialIcons';
import noMessages from '../assets/no-messages.png';
import { useTheme, useViewport } from '../../App';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

interface Student {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  created_at: string;
  profile_picture_id?: string;
  profile_picture_filename?: string;
}

interface ProfileImage {
  [key: number]: string | null;
}

const CoachesScreen: React.FC = () => {
  const scheme = useColorScheme();
  const isDarkMode = scheme === 'dark';
  const { colors: themeColors } = useTheme();
  const colors = themeColors || {
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
    accent: '#F4D03F',
    buttonText: '#FFFFFF',
  };

  const { user, token } = useAuth();
  const { width } = useViewport();
  const navigation = useNavigation();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [profileImages, setProfileImages] = useState<ProfileImage>({});
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  if (user?.role !== 'coach') {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Animatable.Text animation="fadeIn" style={[styles.error, { color: colors.secondary }]}>
          Nur Trainer können auf diese Seite zugreifen.
        </Animatable.Text>
      </View>
    );
  }

  const fetchStudents = useCallback(async () => {
    try {
      const response = await axios.get('https://api.jurite.de/coach/students', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Schüler konnten nicht geladen werden.');
    }
  }, [token]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useFocusEffect(
    useCallback(() => {
      fetchStudents();
    }, [fetchStudents])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStudents().finally(() => setRefreshing(false));
  }, [fetchStudents]);

  useEffect(() => {
    if (error || success || tooltip) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
        setTooltip(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, success, tooltip]);

  useEffect(() => {
    const fetchProfilePictures = async () => {
      if (!token || students.length === 0) return;

      const newProfileImages: ProfileImage = {};
      for (const student of students) {
        if (student.profile_picture_id) {
          try {
            const filename = `profile_picture_${student.id}.png`;
            const tempPath = `${RNFS.TemporaryDirectoryPath}/${filename}`;
            const url = `https://api.jurite.de/auth/users/${student.id}/profile-picture`;

            const res = await RNFS.downloadFile({
              fromUrl: url,
              toFile: tempPath,
              headers: { Authorization: `Bearer ${token}` },
            }).promise;

            if (res.statusCode === 200) {
              newProfileImages[student.id] = `file://${tempPath}`;
            } else {
              newProfileImages[student.id] = null;
            }
          } catch (err) {
            newProfileImages[student.id] = null;
          }
        } else {
          newProfileImages[student.id] = null;
        }
      }
      setProfileImages(newProfileImages);
    };

    fetchProfilePictures();

    return () => {
      Object.values(profileImages).forEach((uri) => {
        if (uri && typeof uri === 'string') {
          const path = uri.replace('file://', '');
          RNFS.unlink(path).catch((err) => console.warn('Error deleting temp file:', err));
        }
      });
    };
  }, [students, token]);

  const toggleSelectionMode = () => {
    if (students.length === 0) {
      setTooltip('Keine Schüler verfügbar');
      return;
    }
    if (isSelectionMode) {
      setSelectedStudentIds([]);
      setTooltip('Auswahl abgebrochen');
    } else {
      setTooltip('Schülerauswahl gestartet');
    }
    setIsSelectionMode(!isSelectionMode);
    setSearchQuery('');
  };

  const toggleStudentSelection = (studentId: number) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const startSession = () => {
    const selectedStudents = students.filter((student) => selectedStudentIds.includes(student.id));
    if (selectedStudents.length === 0) {
      setTooltip('Bitte mindestens einen Schüler auswählen');
      return;
    }
    navigation.navigate('MultiPushToTalkScreen', { students: selectedStudents });
    setIsSelectionMode(false);
    setSelectedStudentIds([]);
    setSearchQuery('');
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const filteredStudents = students.filter((student) =>
    `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const cardWidth = (width - 48) / 2; // Padding 20*2=40, gap 8 between cards

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

  const renderStudentItem = ({ item }: { item: Student }) => {
    const isSelected = selectedStudentIds.includes(item.id);
    const itemScale = new Animated.Value(1);
    const onPressIn = () => Animated.timing(itemScale, { toValue: 0.98, duration: 100, useNativeDriver: true }).start();
    const onPressOut = () => Animated.timing(itemScale, { toValue: 1, duration: 100, useNativeDriver: true }).start();

    return (
      <Animated.View style={{ transform: [{ scale: itemScale }], width: cardWidth, marginBottom: 8 }}>
        <TouchableOpacity
          style={[
            styles.studentButton,
            { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : colors.muted, borderWidth: isSelected ? 2 : 1 },
          ]}
          onPress={() => toggleStudentSelection(item.id)}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityLabel={`Schüler ${item.firstName} ${item.lastName} auswählen`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSelected }}
        >
          {profileImages[item.id] ? (
            <Image
              source={{ uri: profileImages[item.id] }}
              style={styles.avatarImage}
              accessibilityLabel={`Profilbild von ${item.firstName} ${item.lastName}`}
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.secondary, borderColor: colors.accent }]}>
              <Text style={styles.avatarText}>
                {`${item.firstName[0]}${item.lastName[0]}`}
              </Text>
            </View>
          )}
          <Text
            style={[styles.studentName, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {item.firstName} {item.lastName}
          </Text>
          {isSelected && <Icon name="check-circle" size={24} color={colors.primary} style={styles.checkIcon} />}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Audio-Coaching-Session</Text>
      <View style={styles.messageContainer}>
        {error && (
          <Animatable.Text animation="fadeIn" style={[styles.error, { color: colors.error, backgroundColor: `${colors.background}80` }]}>
            {error}
          </Animatable.Text>
        )}
        {success && (
          <Animatable.Text animation="fadeIn" style={[styles.success, { color: colors.success, backgroundColor: `${colors.background}80` }]}>
            {success}
          </Animatable.Text>
        )}
        {tooltip && (
          <Animatable.Text
            animation="fadeIn"
            style={[styles.tooltip, { borderColor: colors.primary, color: colors.text, backgroundColor: `${colors.background}90` }]}
          >
            {tooltip}
          </Animatable.Text>
        )}
      </View>
      <FlatList
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        data={filteredStudents}
        renderItem={renderStudentItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.studentGrid}
        ListHeaderComponent={
          <>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                { backgroundColor: students.length === 0 ? colors.muted : (isSelectionMode ? colors.secondary : colors.primary) },
              ]}
              onPress={() => {
                animateButton();
                toggleSelectionMode();
              }}
              disabled={students.length === 0}
              accessibilityLabel={isSelectionMode ? 'Abbrechen' : 'Schüler auswählen'}
            >
              <Animated.View style={[styles.buttonContent, { transform: [{ scale: scaleAnim }] }]}>
                <Icon name={isSelectionMode ? 'cancel' : 'person-add'} size={18} color={colors.buttonText} style={styles.buttonIcon} />
                <Text style={[styles.toggleButtonText, { color: colors.buttonText }]}>
                  {isSelectionMode ? 'Abbrechen' : 'Schüler auswählen'}
                </Text>
              </Animated.View>
            </TouchableOpacity>
            {isSelectionMode ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Ausgewählte Schüler ({selectedStudentIds.length})
                </Text>
                {selectedStudentIds.length === 0 ? (
                  <Text style={[styles.noSelectionText, { color: colors.muted }]}>
                    Keine ausgewählt
                  </Text>
                ) : (
                  <FlatList
                    data={selectedStudentIds.map((id) => students.find((s) => s.id === id)!)}
                    renderItem={renderStudentItem}
                    keyExtractor={(item) => item.id.toString()}
                    numColumns={2}
                    columnWrapperStyle={styles.studentGrid}
                    contentContainerStyle={styles.selectedGrid}
                  />
                )}
                <TouchableOpacity
                  style={[
                    styles.multiButton,
                    { backgroundColor: selectedStudentIds.length > 0 ? colors.primary : colors.muted },
                  ]}
                  onPress={() => {
                    animateButton();
                    startSession();
                  }}
                  disabled={selectedStudentIds.length === 0}
                  accessibilityLabel="Coaching starten"
                >
                  <Animated.View style={[styles.buttonContent, { transform: [{ scale: scaleAnim }] }]}>
                    <Icon name="play-arrow" size={18} color={colors.buttonText} style={styles.buttonIcon} />
                    <Text style={[styles.toggleButtonText, { color: colors.buttonText }]}>
                      {selectedStudentIds.length > 1 ? `Multi-Coaching starten (${selectedStudentIds.length})` : `Coaching starten (${selectedStudentIds.length})`}
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Verfügbare Schüler
                </Text>
                <TextInput
                  style={[styles.searchInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.muted }]}
                  placeholder="Suche nach Name..."
                  placeholderTextColor={colors.muted}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  accessibilityLabel="Schüler suchen"
                />
              </>
            ) : (
              <Animatable.Text
                animation="fadeIn"
                style={[styles.noSelectionText, { color: colors.text }]}
              >
                Keine Schüler ausgewählt. Klicken Sie auf „Schüler auswählen“, um zu beginnen.
              </Animatable.Text>
            )}
          </>
        }
        ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.text }]}>Keine Schüler gefunden.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  scrollContent: { paddingBottom: 20 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 32, marginTop: 10, textAlign: 'center', letterSpacing: 0.2 },
  messageContainer: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  error: {
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 10,
    color: '#E74C3C',
    textAlign: 'center',
  },
  success: {
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 10,
    color: '#2ECC71',
    textAlign: 'center',
  },
  tooltip: {
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 10,
    color: '#2C3E50',
    textAlign: 'center',
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: 120, height: 120, resizeMode: 'contain' },
  emptyText: { fontSize: 16, marginTop: 16, textAlign: 'center', paddingHorizontal: 20 },
  toggleButton: {
    width: '100%',
    borderRadius: 12,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  multiButton: {
    width: '100%',
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: 16,
  },
  buttonIcon: { marginRight: 8 },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  noSelectionText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  studentGrid: {
    justifyContent: 'space-evenly', // Even spacing for consistent gaps
  },
  selectedGrid: {
    marginBottom: 16,
  },
  studentButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 12,
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
});

export default CoachesScreen;
