import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../../App'; // Adjust path based on your project structure
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';

const DrawerContent = (props: any) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation();

  return (
    <DrawerContentScrollView {...props}>
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.drawerItem, { borderBottomColor: colors.muted }]}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Icon name="home" size={24} color={colors.text} style={styles.icon} />
          <Text style={[styles.drawerText, { color: colors.text }]}>{t('drawer.home')}</Text>
        </TouchableOpacity>
        {isAuthenticated ? (
          <>
            <TouchableOpacity
              style={[styles.drawerItem, { borderBottomColor: colors.muted }]}
              onPress={() => navigation.navigate('Dashboard')} // Adjust to 'Bookings' screen if implemented
            >
              <Icon name="receipt" size={24} color={colors.text} style={styles.icon} /> {/* Or tennis-ball icon if custom */}
              <Text style={[styles.drawerText, { color: colors.text }]}>{t('bookings.title')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.drawerItem, { borderBottomColor: colors.muted }]}
            onPress={() => navigation.navigate('Login')}
          >
            <Icon name="login" size={24} color={colors.text} style={styles.icon} />
            <Text style={[styles.drawerText, { color: colors.text }]}>{t('register.login')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderRadius: 8, // Rounded for modern feel
  },
  icon: {
    marginRight: 10,
  },
  drawerText: {
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    lineHeight: 27, // 1.5x font size
  },
});

export default DrawerContent;