import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons'; // Added import for icons

interface UserMenuProps {
  isVisible: boolean;
  onClose: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ isVisible, onClose }) => {
  const { logout } = useAuth();
  const navigation = useNavigation();

  const handleEditProfile = () => {
    navigation.navigate('Profile');
    onClose();
  };

  const handleLogout = () => {
    console.log('UserMenu: Starting logout');
    logout();
    console.log('UserMenu: After logout, navigating to Login');
    navigation.navigate('Login');
    console.log('UserMenu: Closing modal');
    onClose();
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      style={styles.modal}
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <View style={styles.modalContent}>
        <TouchableOpacity style={styles.modalItem} onPress={handleEditProfile}>
          <Icon name="edit" size={20} color="#000" style={styles.icon} />
          <Text style={styles.modalText}>Profil bearbeiten</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modalItem} onPress={handleLogout}>
          <Icon name="exit-to-app" size={20} color="#000" style={styles.icon} />
          <Text style={styles.modalText}>Log out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modalItem} onPress={onClose}>
          <Icon name="close" size={20} color="#000" style={styles.icon} />
          <Text style={styles.modalText}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    flexDirection: 'row', // Align icon and text horizontally
    alignItems: 'center', // Center vertically
  },
  modalText: {
    fontSize: 18,
    color: '#000',
  },
  icon: {
    marginRight: 10, // Space between icon and text
  },
});

export default UserMenu;
