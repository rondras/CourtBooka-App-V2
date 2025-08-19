// src/screens/CreateBookingScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, FlatList, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../App';
import { useApi, createBooking, getCourtBookings } from '../api/api';
import { format, addMinutes, setHours, setMinutes as dateSetMinutes, isAfter, startOfDay } from 'date-fns';
import Navbar from '../components/Navbar';
import UserMenu from '../components/UserMenu';

const CreateBookingScreen: React.FC<{ route: { params: { courtId: number } }; navigation: any }> = ({ route, navigation }) => {
  const { courtId } = route.params;
  const { colors } = useTheme();
  const api = useApi();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    fetchBookings(selectedDate); // Load bookings on initial mount
  }, [courtId]);

  const fetchBookings = async (date: Date) => {
    setLoading(true);
    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      const response = await getCourtBookings(api, courtId, dateStr);
      // Parse times as UTC by appending 'Z'
      const parsedBookings = response.map((b: any) => ({
        ...b,
        start_time: new Date(b.start_time + 'Z'),
        end_time: new Date(b.end_time + 'Z'),
      }));
      setBookings(parsedBookings);
      console.log('Parsed bookings:', parsedBookings); // Debug: Check parsed dates
    } catch (error: any) {
      Alert.alert('Error', 'Failed to fetch bookings');
      console.error('Fetch bookings error:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateSlots = (date: Date) => {
    const slots = [];
    for (let hour = 8; hour <= 21; hour++) {
      [0, 30].forEach(min => {
        const start = dateSetMinutes(setHours(startOfDay(date), hour), min);
        const end = addMinutes(start, 30); // 30-minute slots
        slots.push({ start, end });
      });
    }
    return slots;
  };

  const bookSlot = async (start: Date) => {
    if (!isAfter(start, new Date())) {
      return Alert.alert('Invalid Time', 'Cannot book past slots.');
    }
    try {
      await createBooking(api, { court_id: courtId, start_time: start.toISOString(), duration_minutes: 30 });
      Alert.alert('Success', 'Booking created!');
      fetchBookings(selectedDate); // Refresh slots
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create booking. Slot may be taken.');
      console.error('Create booking error:', error.response?.data || error.message);
    }
  };

  const handleDateChange = (event: any, selected: Date | undefined) => {
    setShowDatePicker(false);
    if (selected) {
      setSelectedDate(selected);
      fetchBookings(selected);
    }
  };

  const formatToCEST = (date: Date) => {
    return new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  };

  const slots = generateSlots(selectedDate);

  return (
    <>
      <Navbar navigation={navigation} onProfilePress={() => setShowUserMenu(true)} />
      {showUserMenu && <UserMenu onClose={() => setShowUserMenu(false)} navigation={navigation} />} 
      <View style={[styles.container, { backgroundColor: colors.background }]}>
      
        

        <Text style={[styles.title, { color: colors.text }]}>Book Court {courtId}</Text>
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.dateButton, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.text, fontFamily: 'Inter-Regular' }}>Select Date: {format(selectedDate, 'yyyy-MM-dd')}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}
        {loading ? (
          <Text style={{ color: colors.text }}>Loading slots...</Text>
        ) : (
          <FlatList
            data={slots}
            keyExtractor={(item) => item.start.toISOString()}
            renderItem={({ item }) => {
              const isBooked = bookings.some((b: any) => {
                const bStart = b.start_time; // Already parsed as Date
                const bEnd = b.end_time;
                return !(item.end <= bStart || item.start >= bEnd);
              });
              const bookedBy = isBooked ? bookings.find((b: any) => {
                const bStart = b.start_time;
                const bEnd = b.end_time;
                return !(item.end <= bStart || item.start >= bEnd);
              })?.booked_by : null;

              return (
                <TouchableOpacity
                  disabled={isBooked}
                  onPress={() => bookSlot(item.start)} // Send UTC to backend
                  style={[
                    styles.slot,
                    { backgroundColor: isBooked ? colors.error : colors.primary },
                  ]}
                >
                  <Text style={[styles.slotText, { color: isBooked ? colors.text : '#FFFFFF' }]}>
                    {formatToCEST(item.start)} - {formatToCEST(item.end)} {isBooked ? `(Booked by ${bookedBy})` : '(Free)'}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}

        
      </View>
    </>
    
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontFamily: 'Inter-Bold', marginBottom: 16 },
  dateButton: { padding: 16, borderRadius: 8, marginBottom: 16 },
  slot: { padding: 16, borderRadius: 8, marginBottom: 8 },
  slotText: { textAlign: 'center', fontFamily: 'Inter-Bold' },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: { alignItems: 'center' },
  navText: { fontSize: 14, fontFamily: 'Inter-Regular' },
});

export default CreateBookingScreen;