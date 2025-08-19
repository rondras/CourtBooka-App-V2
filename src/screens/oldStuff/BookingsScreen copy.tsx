import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, Switch, SafeAreaView, StyleSheet } from 'react-native';
import { useTheme } from '../../App';
import { getUserBookings, getClubSettings, cancelBooking } from '../api/api';
import { format, isAfter } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

const BookingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user, isSuperAdmin, userClubs } = useAuth();
  const navigation = useNavigation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistoric, setShowHistoric] = useState(false);
  const [maxBookingsAllowed, setMaxBookingsAllowed] = useState(1);

  const fetchMaxBookings = async () => {
    try {
      if (userClubs.length > 0) {
        const firstClubId = userClubs[0].id;
        const settings = await getClubSettings(firstClubId);
        setMaxBookingsAllowed(settings.max_bookings_allowed || 1);
        console.log('Fetched max_bookings_allowed:', settings.max_bookings_allowed);
      } else {
        console.log('No clubs found for user');
      }
    } catch (error: any) {
      console.error('Fetch max bookings error:', error.response?.status, error.response?.data || error.message);
    }
  };

  const fetchBookings = async () => {
    try {
      const data = await getUserBookings();
      const parsedBookings = data
        .filter((b: any) => b.status !== 'cancelled')
        .map((b: any) => ({
          ...b,
          start_time: new Date(b.start_time + (b.start_time.endsWith('Z') ? '' : 'Z')),
          end_time: new Date(b.end_time + (b.end_time.endsWith('Z') ? '' : 'Z')),
        }))
        .filter((b: any) => !isNaN(b.start_time.getTime()));
      setBookings(parsedBookings);
      console.log('Parsed bookings:', parsedBookings);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load bookings');
      console.error('Fetch bookings error:', error.response?.status, error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchMaxBookings();
      fetchBookings();
    }, [])
  );

  const handleCancel = async (id: number) => {
    Alert.alert('Confirm Cancel', 'Cancel this booking?', [
      { text: 'No' },
      {
        text: 'Yes',
        onPress: async () => {
          try {
            await cancelBooking(id);
            Alert.alert('Success', 'Booking cancelled');
            fetchBookings();
          } catch (error: any) {
            Alert.alert('Error', 'Failed to cancel');
            console.error('Cancel error:', error.response?.status, error.response?.data || error.message);
          }
        },
      },
    ]);
  };

  const handleEdit = (item: any) => {
    const isEditable = item.user_id === user.id || isSuperAdmin || userClubs.some((c: any) => c.id === item.club_id && c.role === 'admin');
    if (!isEditable) {
      Alert.alert('Permission Denied', 'You can only edit your own bookings or as admin.');
      return;
    }
    navigation.navigate('AdvancedBooking', { editBooking: item });
  };

  const formatToCEST = (date: Date) => {
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  };

  const filteredBookings = bookings.filter((item: any) => {
    const endTime = item.end_time;
    return showHistoric || isAfter(endTime, new Date());
  });

  const futureBookingsCount = bookings.filter((item: any) => isAfter(item.end_time, new Date())).length;
  console.log('Future bookings count:', futureBookingsCount);
  console.log('Max bookings allowed:', maxBookingsAllowed);
  const hasReachedMax = futureBookingsCount >= maxBookingsAllowed;

  const renderBooking = ({ item }: { item: any }) => {
    const isEditable = item.user_id === user.id || isSuperAdmin || userClubs.some((c: any) => c.id === item.club_id && c.role === 'admin');
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Court {item.court_id} - {formatToCEST(item.start_time)}
        </Text>
        <Text style={styles.cardSubtitle}>Status: {item.status}</Text>
        {isAfter(item.end_time, new Date()) && item.status !== 'cancelled' && (
          <View style={styles.buttonContainer}>
            {item.type === 'regular' && isEditable && (
              <TouchableOpacity
                style={[styles.button, styles.editButton]}
                onPress={() => handleEdit(item)}
                activeOpacity={0.7}
                accessibilityLabel={`Edit booking for court ${item.court_id}`}
              >
                <Text style={styles.buttonText}>EDIT</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => handleCancel(item.id)}
              activeOpacity={0.7}
              accessibilityLabel={`Cancel booking for court ${item.court_id}`}
            >
              <Text style={styles.buttonText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) return <ActivityIndicator color={colors.primary} size="large" style={styles.loader} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.header}>My Bookings</Text>
        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>Show historic bookings</Text>
          <Switch
            value={showHistoric}
            onValueChange={setShowHistoric}
            trackColor={{ false: colors.muted, true: '#5C9EAD' }}
            thumbColor='#FFFFFF'
            style={styles.switch}
            accessibilityLabel="Toggle historic bookings"
          />
        </View>
        <FlatList
          data={filteredBookings}
          renderItem={renderBooking}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
        />
        <TouchableOpacity
          onPress={hasReachedMax ? undefined : () => navigation.navigate('AdvancedBooking')}
          style={[styles.fab, { backgroundColor: hasReachedMax ? colors.muted : '#5C9EAD' }]}
          disabled={hasReachedMax}
          activeOpacity={0.7}
          accessibilityLabel="Book a new court"
        >
          <Text style={styles.fabText}>BOOK A COURT</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5DC', // Soft Beige for background
  },
  content: {
    flex: 1,
    padding: 24,
    paddingBottom: 80,
  },
  header: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: '#2A3D45', // Net Dark for text
    marginBottom: 24,
    lineHeight: 36,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  toggleLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#2A3D45',
    lineHeight: 24,
  },
  switch: {
    transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
  },
  card: {
    backgroundColor: '#FFFFFF', // White Lines for card background
    padding: 20,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5C9EAD', // Court Blue border
    shadowColor: '#2A3D45',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    marginHorizontal: 8,
  },
  cardTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#2A3D45',
    lineHeight: 24,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#2A3D45',
    opacity: 0.7,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: '#4CAF50', // Ace Green for edit
  },
  cancelButton: {
    backgroundColor: '#FFC107', // Warning Yellow for cancel
  },
  buttonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2A3D45',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  fabText: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default BookingsScreen;