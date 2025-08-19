import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useTheme } from '../../App';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';

const AdminDashboardScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isSuperAdmin, isClubAdmin, userClubs } = useAuth();
  const navigation = useNavigation();

  // Filter to only clubs where user is admin
  const adminClubs = userClubs.filter(club => club.role === 'admin');

  if (!isSuperAdmin && !isClubAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.container}>
          <Text style={[styles.title, { color: colors.text }]}>{t('adminDashboard.accessDenied')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>{t('adminDashboard.title')}</Text>
        {isSuperAdmin && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('SuperAdmin')}
          >
            <Icon name="admin-panel-settings" size={24} color="#fff" />
            <Text style={styles.buttonText}>{t('adminDashboard.superadminTools')}</Text>
          </TouchableOpacity>
        )}
        {isClubAdmin && adminClubs.map(club => (
          <TouchableOpacity
            key={club.id}
            style={[styles.button, { backgroundColor: colors.secondary }]}
            onPress={() => navigation.navigate('ClubAdmin', { clubId: club.id })}
          >
            <Icon name="group" size={24} color="#fff" />
            <Text style={styles.buttonText}>{t('adminDashboard.manageClub', { name: club.name })}</Text>
          </TouchableOpacity>
        ))}
        {isClubAdmin && adminClubs.length === 0 && (
          <Text style={{ color: colors.muted }}>{t('adminDashboard.noAdminClubs')}</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 24, fontFamily: 'Inter-Bold', marginBottom: 20, textAlign: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 8, marginVertical: 8 },
  buttonText: { color: '#fff', marginLeft: 8, fontFamily: 'Inter-Medium' },
});

export default AdminDashboardScreen;