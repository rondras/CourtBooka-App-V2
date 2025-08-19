// src/screens/ClubCourtsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '../../App';
import { useApi, getClubCourts } from '../api/api';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Navbar from '../components/Navbar';
import UserMenu from '../components/UserMenu';

const ClubCourtsScreen: React.FC<{ route: { params: { clubId: number } } }> = ({ route, navigation }) => {
  const { clubId } = route.params;
  const { colors } = useTheme();
  const api = useApi();
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourts();
  }, [clubId]);

  const fetchCourts = async () => {
    try {
      const data = await getClubCourts(api, clubId);
      setCourts(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load courts');
    } finally {
      setLoading(false);
    }
  };

  const renderCourt = ({ item }) => (
    <View style={{ backgroundColor: colors.surface, padding: 16, marginVertical: 8, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View>
        <Text style={{ color: colors.text, fontFamily: 'Inter-Bold', fontSize: 16 }}>{item.name}</Text>
        <Text style={{ color: colors.muted }}>Surface: {item.surface_type} {item.has_floodlights ? '• Floodlights' : ''}</Text>
      </View>
      <TouchableOpacity onPress={() => navigation.navigate('CreateBooking', { courtId: item.id })} style={{ backgroundColor: colors.primary, padding: 8, borderRadius: 4 }}>
        <Text style={{ color: '#FFFFFF', fontFamily: 'Inter-Regular' }}>Book</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) return <ActivityIndicator color={colors.primary} size="large" />;

  return (
    <>
      <Navbar navigation={navigation} onProfilePress={() => setShowUserMenu(true)} />
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontFamily: 'Inter-Bold', marginBottom: 16 }}>Courts in Club</Text>
        <FlatList data={courts} renderItem={renderCourt} keyExtractor={(item) => item.id.toString()} />
      </View>
    </>
  );
};

export default ClubCourtsScreen;
