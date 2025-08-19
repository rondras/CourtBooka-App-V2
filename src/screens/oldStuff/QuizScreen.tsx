import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Button,
} from 'react-native';
import { useTheme } from '../../App';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import AxiosRetry from 'axios-retry';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  difficulty: string;
  correct_answer: string;
  explanation: string;
  topic: string;
}

const API_BASE_URL = 'https://api.jurite.de'; // Replace with your API base URL

// Configure Axios with retries and timeout
const axiosInstance = axios.create({
  timeout: 180000, // 60 seconds
});
AxiosRetry(axiosInstance, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 1000,
});

const QuizScreen: React.FC = () => {
  const { colors } = useTheme();
  const { token } = useAuth();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [round, setRound] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizSeed, setQuizSeed] = useState(Date.now());
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);
  const [currentQuiz, setCurrentQuiz] = useState<any>({ questions: [], score: 0, streak: 0, round: 1 });
  const [performanceHistory, setPerformanceHistory] = useState<any>({});
  const [currentStreak, setCurrentStreak] = useState(0);

  // Load previous questions from AsyncStorage
  const loadPreviousQuestions = async () => {
    try {
      const storedQuestions = await AsyncStorage.getItem('previousQuestions');
      if (storedQuestions) {
        setPreviousQuestions(JSON.parse(storedQuestions));
      }
    } catch (error) {
      console.error('Fehler beim Laden vorheriger Fragen:', error);
    }
  };

  // Save current questions to AsyncStorage
  const saveQuestions = async (newQuestions: QuizQuestion[]) => {
    try {
      const updatedQuestions = [...previousQuestions, ...newQuestions.map(q => q.question)];
      await AsyncStorage.setItem('previousQuestions', JSON.stringify(updatedQuestions));
      setPreviousQuestions(updatedQuestions);
    } catch (error) {
      console.error('Fehler beim Speichern der Fragen:', error);
    }
  };

  // Clear previous questions on full restart
  const clearPreviousQuestions = async () => {
    try {
      await AsyncStorage.removeItem('previousQuestions');
      setPreviousQuestions([]);
    } catch (error) {
      console.error('Fehler beim Löschen vorheriger Fragen:', error);
    }
  };

  // Fetch quiz questions from your API
  const fetchQuizQuestions = async () => {
    try {
      setLoading(true);
      if (round >= 2) {
        await loadPreviousQuestions();
      }
      const payload = {
        quizSeed: quizSeed,
        previousQuestions: previousQuestions.slice(-10),
        round: round,
        currentQuiz: currentQuiz,
        performanceHistory: performanceHistory,
      };
      console.log('Request URL:', `${API_BASE_URL}/api/quiz/questions`);
      console.log('Request Payload:', payload);
      console.log('Request Token:', token);
      console.log('Axios Timeout:', axiosInstance.defaults.timeout);
      const startTime = Date.now();
      const response = await axiosInstance.post(
        `${API_BASE_URL}/api/quiz/questions`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`Request duration: ${Date.now() - startTime}ms`);
      const quizData = response.data.questions;
      // Validate quiz data
      if (!Array.isArray(quizData) || !quizData.every(q => q.question && Array.isArray(q.options) && q.options.length === 4 && q.difficulty && q.correct_answer && q.explanation && q.topic)) {
        throw new Error('Ungültiges Quizdatenformat');
      }
      setQuestions(quizData);
      await saveQuestions(quizData);
      setSelectedAnswers(new Array(quizData.length).fill(null));
      setLoading(false);
      // Log cache savings if available
      if (response.data.cache_discount) {
        console.log('Cache savings:', response.data.cache_discount);
      }
    } catch (error: any) {
      console.error('Fehler beim Abrufen der Quizfragen:', error);
      if (error.response) {
        console.log('Fehlerantwort:', error.response.data);
        console.log('Status:', error.response.status);
      }
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: error.response?.data?.error || 'Quizfragen konnten nicht geladen werden. Bitte versuche es erneut.',
      });
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    loadPreviousQuestions();
    fetchQuizQuestions();
  }, [quizSeed, round]);

  // Handle answer selection
  const handleAnswer = (option: string) => {
    if (selectedOption) return;
    setSelectedOption(option);

    const updatedAnswers = [...selectedAnswers];
    updatedAnswers[currentQuestionIndex] = option;
    setSelectedAnswers(updatedAnswers);

    const currentQ = questions[currentQuestionIndex];
    const is_correct = option === currentQ.correct_answer;

    Toast.show({
      type: is_correct ? 'success' : 'error',
      text1: is_correct ? 'Richtig!' : 'Falsch',
      text2: is_correct ? 'Gut gemacht!' : `Die richtige Antwort ist ${currentQ.correct_answer}. Erklärung: ${currentQ.explanation}`,
    });

    let newScore = score;
    let newStreak = is_correct ? currentStreak + 1 : 0;
    if (is_correct) {
      newScore += 10;
      if (newStreak >= 3) newScore += 5;
    } else {
      newScore -= 5;
    }
    setScore(newScore);
    setCurrentStreak(newStreak);

    // Update performance history
    const topic = currentQ.topic;
    let updatedHistory = { ...performanceHistory };
    if (!updatedHistory[topic]) {
      updatedHistory[topic] = { correct: 0, total: 0 };
    }
    updatedHistory[topic].total += 1;
    if (is_correct) {
      updatedHistory[topic].correct += 1;
    }
    setPerformanceHistory(updatedHistory);

    setShowFeedback(true);

    setTimeout(() => {
      setShowFeedback(false);
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedOption(null);
      } else {
        // End of round
        setTotalScore(totalScore + newScore);
        setTotalQuestions(totalQuestions + questions.length);

        const updatedQuiz = {
          ...currentQuiz,
          questions: [...currentQuiz.questions, ...questions],
          score: currentQuiz.score + newScore,
          streak: newStreak,
        };
        setCurrentQuiz(updatedQuiz);

        if (totalQuestions + questions.length >= 10) {
          setQuizCompleted(true);
        } else if (newScore >= 20) {  // Adjust threshold if needed, assuming ~4 correct for bonus
          setQuestions([]);
          setCurrentQuestionIndex(0);
          setScore(0);
          setCurrentStreak(0);
          setSelectedOption(null);
          setSelectedAnswers([]);
          setRound(round + 1);
          setCurrentQuiz({ ...updatedQuiz, round: round + 1 });
          setQuizSeed(Date.now());
        } else {
          setQuizCompleted(true);
        }
      }
    }, 2000); // Longer delay for feedback
  };

  // Restart quiz
  const restartQuiz = () => {
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setScore(0);
    setTotalScore(0);
    setTotalQuestions(0);
    setRound(1);
    setSelectedOption(null);
    setShowFeedback(false);
    setQuizCompleted(false);
    setQuizSeed(Date.now());
    setCurrentQuiz({ questions: [], score: 0, streak: 0, round: 1 });
    setPerformanceHistory({});
    setCurrentStreak(0);
    clearPreviousQuestions();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Quiz wird geladen...</Text>
      </View>
    );
  }

  if (quizCompleted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Quiz abgeschlossen!</Text>
        <Text style={[styles.score, { color: colors.primary }]}>
          Dein Gesamtergebnis: {totalScore} / {totalQuestions}
        </Text>
        <Text style={[styles.roundText, { color: colors.text }]}>
          Runden gespielt: {round}
        </Text>
        <Button title="Quiz neu starten" onPress={restartQuiz} color={colors.primary} />
      </View>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        Runde {round} - Frage {currentQuestionIndex + 1} / {questions.length}
      </Text>
      <Text style={[styles.score, { color: colors.primary }]}>
        Aktueller Punktestand: {score}
      </Text>
      <Text style={[styles.question, { color: colors.text }]}>
        {currentQuestion?.question}
      </Text>
      <FlatList
        data={currentQuestion?.options}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.optionButton,
              {
                backgroundColor: showFeedback
                  ? item === currentQuestion.correct_answer
                    ? 'green'
                    : item === selectedOption
                      ? 'red'
                      : colors.background
                  : selectedOption === item
                    ? colors.primary
                    : colors.background,
                borderColor: colors.muted,
              },
            ]}
            onPress={() => handleAnswer(item)}
            disabled={selectedOption !== null || showFeedback}
          >
            <Text style={[styles.optionText, { color: colors.text }]}>{item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  question: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
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
  roundText: {
    fontSize: 18,
    marginVertical: 10,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 18,
    marginTop: 10,
    textAlign: 'center',
  },
});

export default QuizScreen;
