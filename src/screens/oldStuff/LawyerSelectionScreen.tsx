// src/screens/LawyerSelectionScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Button,
} from 'react-native';
import { useTheme } from '../../App';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Picker } from '@react-native-picker/picker';
import Toast from 'react-native-toast-message';

interface Lawyer {
  id: string;
  name: string;
  specialty?: string;
  location?: string;
}

interface LawyerSelectionScreenProps {
  navigation: any; // Replace with proper navigation type
  route: any; // Replace with proper route type
}

const LawyerSelectionScreen: React.FC<LawyerSelectionScreenProps> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { token } = useAuth();
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [selectedLawyer, setSelectedLawyer] = useState<string | null>(null);
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('Alle');
  const [locationFilter, setLocationFilter] = useState<string>('Alle');

  const specialties = ['Alle', 'Mietrecht', 'Arbeitsrecht', 'Strafrecht', 'Familienrecht'];
  const locations = ['Alle', 'Berlin', 'München', 'Hamburg', 'Köln'];

  // Fetch lawyers
  useEffect(() => {
    const fetchLawyers = async () => {
      const useMockData = true; // Set to false when backend is ready
      if (useMockData) {
        console.log('Using mock lawyer data');
        setLawyers([
          { id: '1', name: 'John Doe', specialty: 'Mietrecht', location: 'Berlin' },
          { id: '2', name: 'Jane Smith', specialty: 'Arbeitsrecht', location: 'München' },
          { id: '3', name: 'Max Mustermann', specialty: 'Strafrecht', location: 'Hamburg' },
        ]);
        return;
      }

      try {
        const response = await axios.get('https://api.jurite.de/lawyers', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLawyers(response.data);
      } catch (error) {
        console.log('Error fetching lawyers:', error);
        Toast.show({
          type: 'info',
          text1: 'Hinweis',
          text2: 'Anwälte konnten nicht geladen werden. Mock-Daten werden verwendet.',
        });
        setLawyers([
          { id: '1', name: 'John Doe', specialty: 'Mietrecht', location: 'Berlin' },
          { id: '2', name: 'Jane Smith', specialty: 'Arbeitsrecht', location: 'München' },
          { id: '3', name: 'Max Mustermann', specialty: 'Strafrecht', location: 'Hamburg' },
        ]);
      }
    };
    fetchLawyers();
  }, [token]);

  // Filter lawyers based on specialty and location
  const filteredLawyers = lawyers.filter(
    (lawyer) =>
      (specialtyFilter === 'Alle' || lawyer.specialty === specialtyFilter) &&
      (locationFilter === 'Alle' || lawyer.location === locationFilter)
  );

  // Handle lawyer selection and return to LegalHelperScreen
  const handleSelectLawyer = () => {
    if (!selectedLawyer) {
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: 'Bitte wählen Sie einen Anwalt aus.',
      });
      return;
    }
    route.params?.onSelectLawyer?.(selectedLawyer);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Anwalt auswählen</Text>
      <View style={styles.filterContainer}>
        <Text style={[styles.filterLabel, { color: colors.text }]}>Rechtsgebiet:</Text>
        <Picker
          selectedValue={specialtyFilter}
          onValueChange={(value) => setSpecialtyFilter(value)}
          style={[styles.picker, { backgroundColor: colors.background, color: colors.text }]}
        >
          {specialties.map((specialty) => (
            <Picker.Item key={specialty} label={specialty} value={specialty} />
          ))}
        </Picker>
      </View>
      <View style={styles.filterContainer}>
        <Text style={[styles.filterLabel, { color: colors.text }]}>Standort:</Text>
        <Picker
          selectedValue={locationFilter}
          onValueChange={(value) => setLocationFilter(value)}
          style={[styles.picker, { backgroundColor: colors.background, color: colors.text }]}
        >
          {locations.map((location) => (
            <Picker.Item key={location} label={location} value={location} />
          ))}
        </Picker>
      </View>
      <FlatList
        data={filteredLawyers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.lawyerButton,
              { backgroundColor: selectedLawyer === item.id ? colors.primary : colors.background },
            ]}
            onPress={() => setSelectedLawyer(item.id)}
          >
            <Text style={[styles.lawyerText, { color: colors.text }]}>
              {item.name} ({item.specialty}, {item.location})
            </Text>
          </TouchableOpacity>
        )}
      />
      <Button title="Anwalt bestätigen" onPress={handleSelectLawyer} color={colors.primary} />
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
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  filterContainer: {
    marginBottom: 10,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
  },
  lawyerButton: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  lawyerText: {
    fontSize: 16,
  },
});

export default LawyerSelectionScreen;
