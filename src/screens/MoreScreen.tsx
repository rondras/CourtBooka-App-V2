import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Animated, FlatList } from 'react-native';
import { useTheme } from '../../App';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

type MoreScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MoreScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user, isSuperAdmin, isClubAdmin } = useAuth();
  const navigation = useNavigation<MoreScreenNavigationProp>();

  const baseMenuItems = [
  ];

  // Admin menu item if superadmin or club admin
  const adminItem = (isSuperAdmin || isClubAdmin) ? [
    { name: t('more.adminDashboard'), icon: 'admin-panel-settings', route: 'AdminDashboard' }
  ] : [];

  const menuItems = [...baseMenuItems, ...adminItem];

  const renderItem = ({ item }: { item: typeof baseMenuItems[0] }) => {
    const scaleAnim = new Animated.Value(1);
    const onPressIn = () => Animated.timing(scaleAnim, { toValue: 0.98, duration: 100, useNativeDriver: true }).start();
    const onPressOut = () => Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start();

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.muted }]}
          onPress={() => navigation.navigate(item.route as keyof RootStackParamList)}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityLabel={t('more.navigateToLabel', { name: item.name })}
          accessibilityRole="button"
        >
          <Icon name={item.icon} size={24} color={colors.primary} style={styles.icon} accessibilityLabel={t('more.itemIconLabel', { name: item.name })} />
          <Text style={[styles.menuText, { color: colors.text }]}>{item.name}</Text>
          <Icon name="chevron-right" size={24} color={colors.muted} accessibilityLabel={t('more.chevronRightLabel')} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>{t('more.title')}</Text>
        <FlatList
          data={menuItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.route}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  icon: {
    marginRight: 16,
  },
  menuText: {
    fontSize: 18,
    flex: 1,
  },
});

export default MoreScreen;