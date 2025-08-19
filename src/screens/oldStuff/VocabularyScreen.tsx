import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useTheme } from '../../App';
import axios, { AxiosError } from 'axios';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import AxiosRetry from 'axios-retry';
import { useFocusEffect } from '@react-navigation/native';

interface VocabularyExercise {
  french: string;
  german: string;
  part_of_speech: string;
  exercises: {
    input: string;
    multiple_choice: {
      question: string;
      options: string[];
      correct_answer: string;
    };
    spelling_variation: string;
    gap_text: string;
    c_test: string;
  };
}

const API_BASE_URL = 'https://api.jurite.de';

const axiosInstance = axios.create({
  timeout: 180000, // 180 seconds
});

AxiosRetry(axiosInstance, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 2000,
  retryCondition: (error: AxiosError) => {
    return (
      axios.isAxiosError(error) &&
      (error.response?.status === 500 ||
        !error.response ||
        error.message.includes('JSON'))
    );
  },
});

// Utility function to normalize French accents
const normalizeFrenchText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .trim()
    .toLowerCase();
};

// Utility function to shuffle an array
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Define types for FlatList items
type ListItem =
  | { type: 'title'; data: string }
  | { type: 'selection'; data: { unite: string; volet: string; numTerms: string } }
  | { type: 'changeSelection' }
  | { type: 'score'; data: number }
  | { type: 'exerciseType'; data: string }
  | { type: 'question'; data: string }
  | { type: 'hint'; data: string }
  | { type: 'input'; data: { placeholder: string } }
  | { type: 'multipleChoice'; data: { question: string; options: string[]; correctAnswer: string } }
  | { type: 'button'; data: { label: string; onPress: () => void; disabled?: boolean } }
  | { type: 'feedback'; data: { message: string; isCorrect: boolean | null } }
  | { type: 'info'; data: string }
  | { type: 'error'; data: string }
  | { type: 'loading' }
  | { type: 'testCompleted'; data: { totalScore: number; totalExercises: number } };

const VocabularyScreen: React.FC = () => {
  const { colors } = useTheme();
  const { token } = useAuth();
  const [vocabulary, setVocabulary] = useState<VocabularyExercise[]>([]);
  const [currentTermIndex, setCurrentTermIndex] = useState(0);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [exerciseTypeSequence, setExerciseTypeSequence] = useState<string[]>([]);
  const allExerciseTypes = [
    'multiple_choice',
    'spelling_variation',
    'gap_text',
    'c_test',
    'input',
  ] as const;
  const [score, setScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [totalExercises, setTotalExercises] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [testCompleted, setTestCompleted] = useState(false);
  const [unite, setUnite] = useState<string>('1');
  const [volet, setVolet] = useState<string>('1');
  const [numTerms, setNumTerms] = useState('10');
  const [previousTerms, setPreviousTerms] = useState<string[]>([]);
  const [showSelection, setShowSelection] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load previous terms from AsyncStorage
  const loadPreviousTerms = async () => {
    try {
      const storedTerms = await AsyncStorage.getItem('previousVocabularyTerms');
      if (storedTerms) {
        setPreviousTerms(JSON.parse(storedTerms));
      }
    } catch (error) {
      console.error('Fehler beim Laden vorheriger Vokabeln:', error);
    }
  };

  // Save current terms to AsyncStorage
  const saveTerms = async (newTerms: VocabularyExercise[]) => {
    try {
      const updatedTerms = [...previousTerms, ...newTerms.map(t => t.french)];
      await AsyncStorage.setItem(
        'previousVocabularyTerms',
        JSON.stringify(updatedTerms),
      );
      setPreviousTerms(updatedTerms);
    } catch (error) {
      console.error('Fehler beim Speichern der Vokabeln:', error);
    }
  };

  // Clear previous terms on restart
  const clearPreviousTerms = async () => {
    try {
      await AsyncStorage.removeItem('previousVocabularyTerms');
      setPreviousTerms([]);
    } catch (error) {
      console.error('Fehler beim Löschen vorheriger Vokabeln:', error);
    }
  };

  // Validate vocabulary data structure
  const isValidVocabulary = (data: any): data is VocabularyExercise[] => {
    if (!Array.isArray(data)) return false;
    return data.every(
      (item) =>
        typeof item.french === 'string' &&
        item.french.trim() !== '' &&
        typeof item.german === 'string' &&
        item.german.trim() !== '' &&
        typeof item.part_of_speech === 'string' &&
        item.part_of_speech.trim() !== '' &&
        item.exercises &&
        typeof item.exercises.input === 'string' &&
        item.exercises.input.trim() !== '' &&
        item.exercises.multiple_choice &&
        typeof item.exercises.multiple_choice.question === 'string' &&
        Array.isArray(item.exercises.multiple_choice.options) &&
        item.exercises.multiple_choice.options.every(
          (opt: any) => typeof opt === 'string' && opt.trim() !== '',
        ) &&
        typeof item.exercises.multiple_choice.correct_answer === 'string' &&
        item.exercises.multiple_choice.correct_answer.trim() !== '' &&
        typeof item.exercises.spelling_variation === 'string' &&
        item.exercises.spelling_variation.trim() !== '' &&
        typeof item.exercises.gap_text === 'string' &&
        item.exercises.gap_text.trim() !== '' &&
        typeof item.exercises.c_test === 'string' &&
        item.exercises.c_test.trim() !== '',
    );
  };

  // Validate unite input
  const validateUnite = (value: string) => {
    if (!['1', '2', '3'].includes(value)) {
      Toast.show({
        type: 'error',
        text1: 'Ungültige Eingabe',
        text2: 'Unité muss 1, 2 oder 3 sein.',
      });
      return false;
    }
    return true;
  };

  // Validate volet input
  const validateVolet = (value: string) => {
    if (!['1', '2'].includes(value)) {
      Toast.show({
        type: 'error',
        text1: 'Ungültige Eingabe',
        text2: 'Volet muss 1 oder 2 sein.',
      });
      return false;
    }
    return true;
  };

  // Initialize exercise type sequence
  const initializeExerciseSequence = () => {
    const middleExercises = shuffleArray(['spelling_variation', 'gap_text', 'c_test']);
    return ['multiple_choice', ...middleExercises, 'input'];
  };

  // Fetch vocabulary exercises from API
  const fetchVocabularyExercises = async () => {
    if (!validateUnite(unite) || !validateVolet(volet)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload = {
        unite,
        volet,
        num_terms: parseInt(numTerms) || 10,
        previous_terms: previousTerms.slice(-10),
      };
      console.log('Request URL:', `${API_BASE_URL}/api/vocabulary/exercises`);
      console.log('Request Payload:', payload);
      console.log('Request Token:', token);
      const startTime = Date.now();
      const response = await axiosInstance.post(
        `${API_BASE_URL}/api/vocabulary/exercises`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log(`Request duration: ${Date.now() - startTime}ms`);
      console.log('Raw API Response:', response.data);

      const vocabData = response.data.vocabulary;
      if (!isValidVocabulary(vocabData)) {
        throw new Error('Ungültiges oder unvollständiges Vokabeldatenformat');
      }

      // Shuffle the vocabulary array
      const shuffledVocab = shuffleArray(vocabData);
      setVocabulary(shuffledVocab);
      await saveTerms(shuffledVocab);
      setExerciseTypeSequence(initializeExerciseSequence());
      setShowSelection(false);
      setLoading(false);
    } catch (error: any) {
      console.error('Fehler beim Abrufen der Vokabelübungen:', error);
      let errorMessage = 'Vokabelübungen konnten nicht geladen werden.';
      if (axios.isAxiosError(error)) {
        console.log('Fehlerantwort:', error.response?.data);
        console.log('Status:', error.response?.status);
        if (error.response?.status === 500) {
          errorMessage = 'Serverfehler: Ungültige Daten empfangen.';
        } else if (error.message.includes('JSON')) {
          errorMessage = 'Serverfehler: Ungültiges Datenformat.';
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.message.includes('Ungültiges')) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: errorMessage,
      });
      setLoading(false);
    }
  };

  // Reset state when screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log('Screen focused, resetting state');
      resetTest();
      loadPreviousTerms();
    }, []),
  );

  // Handle answer submission
  const handleAnswer = (answer: string) => {
    if (answerSubmitted) return;
    setAnswerSubmitted(true);
    console.log('Answer submitted:', answer);

    const currentTerm = vocabulary[currentTermIndex];
    const inputWord = answer.trim();
    const normalizedInput = normalizeFrenchText(inputWord);

    // Remove article from user input if present
    const articleMatch = inputWord.match(/^(le|la|l'|un|une|les|des)\s+/i);
    const wordWithoutArticle = articleMatch
      ? inputWord.replace(/^(le|la|l'|un|une|les|des)\s+/i, '').trim()
      : inputWord;

    // Normalize word without article
    const normalizedWordWithoutArticle = normalizeFrenchText(wordWithoutArticle);

    // Extract expected word without article from currentTerm.french
    const expectedArticleMatch = currentTerm.french.match(/^(le|la|l'|un|une|les|des)\s+/i);
    const expectedWord = expectedArticleMatch
      ? currentTerm.french.replace(/^(le|la|l'|un|une|les|des)\s+/i, '').trim()
      : currentTerm.french.trim();

    // Normalize expected word
    const normalizedExpectedWord = normalizeFrenchText(expectedWord);

    // Construct full answer with article if present in currentTerm.french
    const fullAnswer = expectedArticleMatch
      ? `${expectedArticleMatch[1]} ${wordWithoutArticle}`.trim()
      : wordWithoutArticle;
    const normalizedFullAnswer = normalizeFrenchText(fullAnswer);

    // Check if input matches expected word
    const exerciseType = exerciseTypeSequence[currentExerciseIndex];
    const isCorrect =
      exerciseType === 'multiple_choice'
        ? answer === currentTerm.exercises.multiple_choice.correct_answer
        : normalizedInput === normalizeFrenchText(currentTerm.french) ||
          normalizedWordWithoutArticle === normalizedExpectedWord ||
          normalizedFullAnswer === normalizeFrenchText(currentTerm.french);

    console.log(
      'Exercise:', exerciseType,
      'User input:', inputWord,
      'Normalized input:', normalizedInput,
      'Word without article:', wordWithoutArticle,
      'Normalized word without article:', normalizedWordWithoutArticle,
      'Full answer:', fullAnswer,
      'Normalized full answer:', normalizedFullAnswer,
      'Expected word:', expectedWord,
      'Normalized expected word:', normalizedExpectedWord,
      'Expected full:', currentTerm.french,
      'Is correct:', isCorrect
    );

    setIsAnswerCorrect(isCorrect);
    if (isCorrect) {
      setScore(score + 1);
      setFeedbackMessage('Richtig! Gut gemacht!');
    } else {
      // Determine the correct answer for feedback
      let correctAnswer = currentTerm.french;
      if (exerciseType === 'multiple_choice') {
        const normalizedCorrectAnswer = normalizeFrenchText(currentTerm.exercises.multiple_choice.correct_answer);
        const normalizedGerman = normalizeFrenchText(currentTerm.german);
        const normalizedFrench = normalizeFrenchText(currentTerm.french);
        if (normalizedCorrectAnswer === normalizedGerman) {
          correctAnswer = currentTerm.german;
        } else if (normalizedCorrectAnswer === normalizedFrench) {
          correctAnswer = currentTerm.french;
        }
      }
      setFeedbackMessage(`Falsch. Die richtige Antwort ist ${correctAnswer}`);
    }
  };

  // Proceed to next exercise or term
  const proceedToNext = () => {
    if (currentTermIndex < vocabulary.length - 1) {
      // Move to the next term with the same exercise type
      setCurrentTermIndex(currentTermIndex + 1);
      setSelectedAnswer('');
      setAnswerSubmitted(false);
      setIsAnswerCorrect(null);
      setFeedbackMessage('');
    } else if (currentExerciseIndex < allExerciseTypes.length - 1) {
      // Move to the next exercise type, reshuffle vocabulary
      setVocabulary(shuffleArray(vocabulary));
      setCurrentTermIndex(0);
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setSelectedAnswer('');
      setAnswerSubmitted(false);
      setIsAnswerCorrect(null);
      setFeedbackMessage('');
    } else {
      // Test completed
      setTotalScore(totalScore + (isAnswerCorrect ? score + 1 : score));
      setTotalExercises(totalExercises + vocabulary.length * allExerciseTypes.length);
      setTestCompleted(true);
      setAnswerSubmitted(false);
      setIsAnswerCorrect(null);
      setFeedbackMessage('');
    }
  };

  // Reset test
  const resetTest = () => {
    setVocabulary([]);
    setCurrentTermIndex(0);
    setCurrentExerciseIndex(0);
    setExerciseTypeSequence([]);
    setScore(0);
    setTotalScore(0);
    setTotalExercises(0);
    setSelectedAnswer('');
    setAnswerSubmitted(false);
    setIsAnswerCorrect(null);
    setFeedbackMessage('');
    setTestCompleted(false);
    setShowSelection(true);
    setError(null);
    clearPreviousTerms();
  };

  // Restart test
  const restartTest = () => {
    resetTest();
  };

  // Generate FlatList data based on state
  const getListData = (): ListItem[] => {
    if (loading) {
      return [{ type: 'loading' }];
    }

    if (error) {
      return [
        { type: 'title', data: 'Fehler beim Laden' },
        { type: 'error', data: error },
        {
          type: 'button',
          data: { label: 'Erneut versuchen', onPress: fetchVocabularyExercises },
        },
        {
          type: 'button',
          data: { label: 'Test neu starten', onPress: restartTest },
        },
      ];
    }

    if (testCompleted) {
      return [
        { type: 'title', data: 'Vokabeltest abgeschlossen!' },
        {
          type: 'testCompleted',
          data: { totalScore, totalExercises },
        },
        {
          type: 'button',
          data: { label: 'Test neu starten', onPress: restartTest },
        },
      ];
    }

    const data: ListItem[] = [
      { type: 'title', data: `Vokabeltest: Unité ${unite}, Volet ${volet}` },
    ];

    if (showSelection) {
      data.push({
        type: 'selection',
        data: { unite, volet, numTerms },
      });
      data.push({
        type: 'button',
        data: { label: 'Vokabeln laden', onPress: fetchVocabularyExercises },
      });
    } else {
      data.push({
        type: 'button',
        data: { label: 'Auswahl ändern', onPress: () => setShowSelection(true) },
      });
    }

    if (vocabulary.length > 0 && currentTermIndex < vocabulary.length) {
      const currentTerm = vocabulary[currentTermIndex];
      const exerciseType = exerciseTypeSequence[currentExerciseIndex];

      data.push({
        type: 'score',
        data: score,
      });
      data.push({
        type: 'exerciseType',
        data:
          exerciseType === 'input'
            ? 'Eingabe'
            : exerciseType === 'multiple_choice'
            ? 'Multiple Choice'
            : exerciseType === 'spelling_variation'
            ? 'Rechtschreibung'
            : exerciseType === 'gap_text'
            ? 'Lückentext'
            : 'C-Test',
      });

      if (exerciseType === 'input') {
        data.push({
          type: 'question',
          data: currentTerm.exercises.input,
        });
        data.push({
          type: 'hint',
          data: 'Akzente sind optional, z.B. "ecole" für "école".',
        });
        data.push({
          type: 'input',
          data: { placeholder: 'Antwort eingeben' },
        });
        data.push({
          type: 'button',
          data: {
            label: 'Antwort prüfen',
            onPress: () => {
              Keyboard.dismiss();
              handleAnswer(selectedAnswer);
            },
            disabled: !selectedAnswer || answerSubmitted,
          },
        });
      } else if (exerciseType === 'multiple_choice') {
        data.push({
          type: 'question',
          data: currentTerm.exercises.multiple_choice.question,
        });
        data.push({
          type: 'multipleChoice',
          data: {
            question: currentTerm.exercises.multiple_choice.question,
            options: currentTerm.exercises.multiple_choice.options,
            correctAnswer: currentTerm.exercises.multiple_choice.correct_answer,
          },
        });
      } else if (exerciseType === 'spelling_variation') {
        data.push({
          type: 'question',
          data: currentTerm.exercises.spelling_variation,
        });
        data.push({
          type: 'hint',
          data: 'Geben Sie die korrigierte Schreibweise ein (Akzente sind optional).',
        });
        data.push({
          type: 'input',
          data: { placeholder: 'Korrigierte Schreibweise eingeben' },
        });
        data.push({
          type: 'button',
          data: {
            label: 'Antwort prüfen',
            onPress: () => {
              Keyboard.dismiss();
              handleAnswer(selectedAnswer);
            },
            disabled: !selectedAnswer || answerSubmitted,
          },
        });
      } else if (exerciseType === 'gap_text') {
        data.push({
          type: 'question',
          data: currentTerm.exercises.gap_text,
        });
        data.push({
          type: 'hint',
          data: 'Geben Sie das fehlende Wort ein (mit oder ohne Artikel; Akzente sind optional).',
        });
        data.push({
          type: 'input',
          data: { placeholder: 'Fehlendes Wort eingeben' },
        });
        data.push({
          type: 'button',
          data: {
            label: 'Antwort prüfen',
            onPress: () => {
              Keyboard.dismiss();
              handleAnswer(selectedAnswer);
            },
            disabled: !selectedAnswer || answerSubmitted,
          },
        });
      } else if (exerciseType === 'c_test') {
        data.push({
          type: 'question',
          data: currentTerm.exercises.c_test,
        });
        data.push({
          type: 'hint',
          data: 'Geben Sie das vollständige Wort ein (mit oder ohne Artikel; Akzente sind optional).',
        });
        data.push({
          type: 'input',
          data: { placeholder: 'Vollständiges Wort eingeben' },
        });
        data.push({
          type: 'button',
          data: {
            label: 'Antwort prüfen',
            onPress: () => {
              Keyboard.dismiss();
              handleAnswer(selectedAnswer);
            },
            disabled: !selectedAnswer || answerSubmitted,
          },
        });
      }

      if (answerSubmitted) {
        data.push({
          type: 'feedback',
          data: { message: feedbackMessage, isCorrect: isAnswerCorrect },
        });
        data.push({
          type: 'button',
          data: { label: 'Weiter', onPress: proceedToNext },
        });
      }
    }

    if (vocabulary.length === 0 && !showSelection && !loading && !error) {
      data.push({
        type: 'info',
        data: 'Bitte Vokabeln laden, um den Test zu starten.',
      });
    }

    return data;
  };

  // Render FlatList items
  const renderItem = ({ item }: { item: ListItem }) => {
    switch (item.type) {
      case 'title':
        return (
          <Text style={[styles.title, { color: colors.text }]}>
            {item.data}
          </Text>
        );
      case 'selection':
        return (
          <View style={styles.selectionContainer}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Unité:</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.muted }]}
                value={unite}
                onChangeText={(text) => {
                  console.log('Unite input changed:', text);
                  setUnite(text);
                }}
                keyboardType="numeric"
                placeholder="1, 2 oder 3"
                placeholderTextColor={colors.muted}
                multiline={false}
                returnKeyType="done"
                blurOnSubmit={true}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Volet:</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.muted }]}
                value={volet}
                onChangeText={(text) => {
                  console.log('Volet input changed:', text);
                  setVolet(text);
                }}
                keyboardType="numeric"
                placeholder="1 oder 2"
                placeholderTextColor={colors.muted}
                multiline={false}
                returnKeyType="done"
                blurOnSubmit={true}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>
                Anzahl der Begriffe:
              </Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.muted }]}
                value={numTerms}
                onChangeText={setNumTerms}
                keyboardType="numeric"
                placeholder="z.B. 10"
                placeholderTextColor={colors.muted}
                multiline={false}
                returnKeyType="done"
                blurOnSubmit={true}
              />
            </View>
          </View>
        );
      case 'changeSelection':
        return (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.secondary }]}
            onPress={() => setShowSelection(true)}
          >
            <Text style={styles.buttonText}>Auswahl ändern</Text>
          </TouchableOpacity>
        );
      case 'score':
        return (
          <Text style={[styles.score, { color: colors.primary }]}>
            Punktestand: {item.data} / {vocabulary.length * allExerciseTypes.length}
          </Text>
        );
      case 'exerciseType':
        return (
          <Text style={[styles.exerciseType, { color: colors.text }]}>
            Übung: {item.data}
          </Text>
        );
      case 'question':
        return (
          <Text style={[styles.question, { color: colors.text }]}>
            {item.data}
          </Text>
        );
      case 'hint':
        return (
          <Text style={[styles.hintText, { color: colors.text }]}>
            {item.data}
          </Text>
        );
      case 'input':
        return (
          <View style={styles.answerInputContainer}>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.muted }]}
              onChangeText={(text) => {
                console.log('TextInput changed:', text);
                setSelectedAnswer(text);
              }}
              value={selectedAnswer}
              editable={!answerSubmitted}
              placeholder={item.data.placeholder}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              multiline={false}
              returnKeyType="done"
              blurOnSubmit={true}
            />
          </View>
        );
      case 'multipleChoice':
        return (
          <View>
            {item.data.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor:
                      selectedAnswer === option
                        ? option === item.data.correctAnswer
                          ? colors.primary
                          : colors.secondary
                        : colors.background,
                    borderColor: colors.muted,
                  },
                ]}
                onPress={() => handleAnswer(option)}
                disabled={answerSubmitted}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      case 'button':
        return (
          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: item.data.disabled ? colors.muted : colors.primary,
              },
            ]}
            onPress={item.data.onPress}
            disabled={item.data.disabled}
          >
            <Text style={styles.buttonText}>{item.data.label}</Text>
          </TouchableOpacity>
        );
      case 'feedback':
        return (
          <View style={styles.feedbackContainer}>
            <Text
              style={[
                styles.feedbackText,
                { color: item.data.isCorrect ? colors.primary : colors.secondary },
              ]}
            >
              {item.data.message}
            </Text>
          </View>
        );
      case 'info':
        return (
          <Text style={[styles.infoText, { color: colors.text }]}>
            {item.data}
          </Text>
        );
      case 'error':
        return (
          <Text style={[styles.errorText, { color: colors.secondary }]}>
            {item.data}
          </Text>
        );
      case 'loading':
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Vokabeltest wird geladen...
            </Text>
          </View>
        );
      case 'testCompleted':
        return (
          <Text style={[styles.score, { color: colors.primary }]}>
            Dein Gesamtergebnis: {item.data.totalScore} / {item.data.totalExercises}
          </Text>
        );
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
    >
      <FlatList
        data={getListData()}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.type}-${index}`}
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  selectionContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
    height: 40,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    width: 100,
    color: '#333',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 6,
    height: 40,
    fontSize: 13,
    marginVertical: 2,
    color: '#333',
  },
  question: {
    fontSize: 18,
    marginBottom: 15,
    textAlign: 'center',
  },
  hintText: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
    color: '#666',
  },
  optionButton: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 10,
    marginVertical: 5,
  },
  optionText: {
    fontSize: 16,
  },
  score: {
    fontSize: 20,
    fontWeight: '600',
    marginVertical: 10,
    textAlign: 'center',
  },
  exerciseType: {
    fontSize: 18,
    marginVertical: 10,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    marginVertical: 10,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 16,
    marginVertical: 10,
    textAlign: 'center',
  },
  feedbackContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  feedbackText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  button: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 3,
    minWidth: 120,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  answerInputContainer: {
    height: 40,
    justifyContent: 'center',
    marginBottom: 8,
  },
});

export default VocabularyScreen;