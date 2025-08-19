import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, Switch } from 'react-native';
import { useTheme } from '../../App';
import { createClub } from '../api/api'; // Import the new function from api.ts
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

const SuperAdminScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [numberOfCourts, setNumberOfCourts] = useState('');
  const [hasFloodlights, setHasFloodlights] = useState(false);
  const [initialAdminId, setInitialAdminId] = useState('');

  const handleCreateClub = async () => {
    // Basic validation (best practice: prevent invalid submissions)
    if (!name || !street || !houseNumber || !city || !postalCode || !country || !numberOfCourts || !initialAdminId) {
      Alert.alert(t('adminDashboard.error'), t('adminDashboard.allFieldsRequired'));
      return;
    }

    try {
      await createClub({
        name,
        street,
        houseNumber,
        city,
        postalCode,
        country,
        numberOfCourts: Number(numberOfCourts),
        hasFloodlights,
        initial_admin_id: Number(initialAdminId),
      });
      Alert.alert(t('adminDashboard.success'), t('adminDashboard.clubCreated'));
      navigation.navigate('MainTabs'); // Navigate back to main menu
    } catch (error) {
      Alert.alert(t('adminDashboard.error'), t('adminDashboard.failedToCreateClub'));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>{t('superAdmin.title')}</Text>
        <TextInput 
          style={styles.input} 
          placeholder={t('superAdmin.namePlaceholder')} 
          value={name} 
          onChangeText={setName} 
          autoCorrect={false}
          autoCapitalize="none"
        />
        <TextInput 
          style={styles.input} 
          placeholder={t('profile.street')} 
          value={street} 
          onChangeText={setStreet} 
          autoCorrect={false}
          autoCapitalize="none"
        />
        <TextInput 
          style={styles.input} 
          placeholder={t('profile.houseNumber')} 
          value={houseNumber} 
          onChangeText={setHouseNumber} 
          autoCorrect={false}
          autoCapitalize="none"
        />
        <TextInput 
          style={styles.input} 
          placeholder={t('profile.city')} 
          value={city} 
          onChangeText={setCity} 
          autoCorrect={false}
          autoCapitalize="none"
        />
        <TextInput 
          style={styles.input} 
          placeholder={t('profile.postalCode')} 
          value={postalCode} 
          onChangeText={setPostalCode} 
          autoCorrect={false}
          autoCapitalize="none"
        />
        <TextInput 
          style={styles.input} 
          placeholder={t('profile.country')} 
          value={country} 
          onChangeText={setCountry} 
          autoCorrect={false}
          autoCapitalize="none"
        />
        <TextInput 
          style={styles.input} 
          placeholder={t('superAdmin.numberOfCourtsPlaceholder')} 
          value={numberOfCourts} 
          onChangeText={setNumberOfCourts} 
          keyboardType="numeric"
          autoCorrect={false}
          autoCapitalize="none"
        />
        <View style={styles.switchContainer}>
          <Text>{t('clubAdmin.floodlightsLabel')}</Text>
          <Switch value={hasFloodlights} onValueChange={setHasFloodlights} />
        </View>
        
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleCreateClub}>
          <Text style={styles.buttonText}>{t('superAdmin.createClubButton')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontFamily: 'Inter-Bold', marginBottom: 20 },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 },
  switchContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  button: { padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontFamily: 'Inter-Medium' },
});

export default SuperAdminScreen;