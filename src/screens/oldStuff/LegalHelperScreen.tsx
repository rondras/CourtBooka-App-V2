import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Button,
  Modal,
} from 'react-native';
import { useTheme } from '../../App';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import DocumentPicker, { isCancel } from 'react-native-document-picker';
import AxiosRetry from 'axios-retry';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
  options?: string[];
}

interface CaseData {
  caseId: number;
  conversation: Message[];
  summary: string;
  documents: { id: number; filename: string; originalFilename: string; cloudStorageId: string; fileSize: number; uploadDate: string }[];
  lawyerId?: number;
}

const API_BASE_URL = 'https://api.jurite.de'; // Replace with your API base URL
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20MB, updated to match backend

// Configure Axios with retries and timeout
const axiosInstance = axios.create({
  timeout: 60000, // 60 seconds
});
AxiosRetry(axiosInstance, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 1000,
});

const LegalHelperScreen: React.FC = ({ navigation }) => {
  const { colors } = useTheme();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [selectedLawyer, setSelectedLawyer] = useState<number | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Initialize new case
  const initializeNewCase = async () => {
    try {
      const response = await axiosInstance.post(
        `${API_BASE_URL}/legalCases`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCaseData(response.data);
      setMessages(response.data.conversation);
      Toast.show({
        type: 'success',
        text1: 'Erfolg',
        text2: 'Neuer Fall wurde angelegt.',
      });
    } catch (error: any) {
      console.error('Error creating case:', error);
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: 'Fall konnte nicht angelegt werden.',
      });
    }
  };

  // Load case data
  useEffect(() => {
    const loadCaseData = async () => {
      try {
        const response = await axiosInstance.get(
          `${API_BASE_URL}/legalCases/${user?.id}/latest`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data) {
          setCaseData(response.data);
          setMessages(response.data.conversation);
        } else {
          initializeNewCase();
        }
      } catch (error) {
        console.error('Error loading case:', error);
        initializeNewCase();
      }
    };
    if (user?.id) {
      loadCaseData();
    }
  }, [user?.id]);

  // Scroll to end when messages update
  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // Send message
  const sendMessage = async (text: string, isOption = false) => {
    if (!text.trim() || !caseData) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInputText('');
    setLoading(true);

    try {
      const response = await axiosInstance.post(
        `${API_BASE_URL}/legalCases/${caseData.caseId}/messages`,
        { text, sender: 'user', options: [] },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const aiMessage = response.data;
      const newMessages = [...updatedMessages, {
        id: aiMessage.messageId.toString(),
        text: aiMessage.text,
        sender: aiMessage.sender,
        timestamp: aiMessage.timestamp,
        options: aiMessage.options || [],
      }];
      setMessages(newMessages);
      setCaseData({ ...caseData, conversation: newMessages, summary: aiMessage.summary || caseData.summary });

      if (isOption && text === 'Zusammenfassung anzeigen') {
        setShowSummaryModal(true);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: error.message || 'Nachricht konnte nicht gesendet werden.',
      });
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  // Handle option selection
  const handleOptionSelect = (option: string) => {
    sendMessage(option, true);
  };

  // Upload document
  const uploadDocument = async () => {
    if (!caseData) return;

    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.images],
      });
      const file = result[0];

      // Validate file size client-side
      if (file.size && file.size > MAX_DOCUMENT_SIZE) {
        Toast.show({
          type: 'error',
          text1: 'Fehler',
          text2: `Datei zu groß. Maximal ${MAX_DOCUMENT_SIZE / (1024 * 1024)}MB erlaubt.`,
        });
        return;
      }

      const formData = new FormData();
      formData.append('document', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);

      const response = await axiosInstance.post(
        `${API_BASE_URL}/legalCases/${caseData.caseId}/documents`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const updatedDocuments = [...caseData.documents, response.data];
      setCaseData({ ...caseData, documents: updatedDocuments });

      await sendMessage(
        `Ein Dokument (${response.data.originalFilename}) wurde hochgeladen. Bitte analysieren Sie es, falls es kleiner als 5MB ist.`,
        false
      );

      Toast.show({
        type: 'success',
        text1: 'Erfolg',
        text2: `Dokument ${file.name} hochgeladen.`,
      });
    } catch (error: any) {
      if (isCancel(error)) {
        console.log('Document picking cancelled');
        return;
      }
      console.error('Error uploading document:', error);
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: error.message || 'Dokument konnte nicht hochgeladen werden.',
      });
    }
  };

  // Share with lawyer
  const shareWithLawyer = async () => {
    if (!selectedLawyer || !caseData) {
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: 'Bitte wählen Sie einen Anwalt aus.',
      });
      return;
    }

    try {
      await axiosInstance.post(
        `${API_BASE_URL}/legalCases/${caseData.caseId}/share`,
        { lawyerId: selectedLawyer },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: 'Erfolg',
        text2: 'Daten an Anwalt gesendet.',
      });

      initializeNewCase();
    } catch (error: any) {
      console.error('Error sharing with lawyer:', error);
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: 'Daten konnten nicht gesendet werden.',
      });
    }
  };

  // Navigate to LawyerSelectionScreen
  const navigateToLawyerSelection = () => {
    navigation.navigate('LawyerSelection', {
      onSelectLawyer: (lawyerId: number) => setSelectedLawyer(lawyerId),
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Rechtsberatung</Text>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageContainer,
              item.sender === 'user' ? styles.userMessage : styles.aiMessage,
            ]}
          >
            <Text style={[styles.messageText, { color: colors.text }]}>{item.text}</Text>
            {item.sender === 'ai' && item.options && item.options.length > 0 && (
              <View style={styles.optionsContainer}>
                {item.options.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.optionButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleOptionSelect(option)}
                  >
                    <Text style={styles.optionButtonText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
        style={styles.chatContainer}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />
      {loading && <ActivityIndicator size="small" color={colors.primary} />}
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, { borderColor: colors.muted, color: colors.text }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Beschreiben Sie Ihr rechtliches Problem..."
          placeholderTextColor={colors.muted}
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: colors.primary }]}
          onPress={() => sendMessage(inputText)}
          disabled={loading}
        >
          <Text style={styles.sendButtonText}>Senden</Text>
        </TouchableOpacity>
      </View>
      <Button title="Dokument hochladen" onPress={uploadDocument} color={colors.primary} />
      <Button title="Anwalt auswählen" onPress={navigateToLawyerSelection} color={colors.secondary} />
      <Button title="Neuen Fall anlegen" onPress={initializeNewCase} color={colors.accent} />
      {selectedLawyer && (
        <Button title="Daten an Anwalt senden" onPress={shareWithLawyer} color={colors.secondary} />
      )}
      <Modal
        visible={showSummaryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSummaryModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Zusammenfassung</Text>
            <Text style={[styles.modalText, { color: colors.text }]}>
              {caseData?.summary ? caseData.summary : 'Keine Zusammenfassung verfügbar.'}
            </Text>
            <Button title="Schließen" onPress={() => setShowSummaryModal(false)} color={colors.primary} />
          </View>
        </View>
      </Modal>
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
  chatContainer: {
    flex: 1,
    marginBottom: 10,
  },
  messageContainer: {
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECECEC',
  },
  messageText: {
    fontSize: 16,
    marginBottom: 5,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  optionButton: {
    padding: 8,
    borderRadius: 8,
    marginRight: 5,
    marginBottom: 5,
    minWidth: 100,
  },
  optionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
  },
  sendButton: {
    padding: 10,
    borderRadius: 10,
    marginLeft: 10,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    margin: 20,
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
  },
});

export default LegalHelperScreen;
