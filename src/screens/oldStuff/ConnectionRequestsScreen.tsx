import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,RefreshControl } from 'react-native';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';

interface StudentRequest {
  student_id: number;
  student_name: string;
  request_date: string;
}

const ConnectionRequestsScreen: React.FC = () => {
  const { user, token } = useAuth();
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user || user.role !== 'coach' || !token) {
      console.warn('Invalid user or token, skipping API calls');
      setError('Please log in as a coach to view requests');
      setLoading(false);
      return;
    }
    console.log('Fetching student requests');
    setLoading(true);
    try {
      const response = await axios.get('https://api.jurite.de/coach/student/requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Requests fetched:', response.data);
      if (!Array.isArray(response.data)) {
        throw new Error('Invalid requests response format');
      }
      setRequests(response.data);
      setError(null);
    } catch (err: any) {
      console.error('API error:', err.response?.data || err.message);
      setError('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    fetchRequests();
    // Start polling every 30 seconds
    pollingInterval.current = setInterval(fetchRequests, 30000);
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [fetchRequests]);

  useFocusEffect(
    useCallback(() => {
      fetchRequests();
    }, [fetchRequests])
  );

  const acceptRequest = async (studentId: number) => {
    if (!token) {
      Alert.alert('Error', 'Please log in to accept a request');
      return;
    }
    try {
      await axios.post(
        `https://api.jurite.de/coach/student/requests/${studentId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRequests((prev) => prev.filter((req) => req.student_id !== studentId));
      Alert.alert('Success', 'Request accepted!');
      fetchRequests(); // Refresh after action
    } catch (err: any) {
      console.error('Accept request error:', err.response?.data || err.message);
      Alert.alert('Error', 'Could not accept request');
    }
  };

  const rejectRequest = async (studentId: number) => {
    if (!token) {
      Alert.alert('Error', 'Please log in to reject a request');
      return;
    }
    try {
      await axios.post(
        `https://api.jurite.de/coach/student/requests/${studentId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRequests((prev) => prev.filter((req) => req.student_id !== studentId));
      Alert.alert('Success', 'Request rejected');
      fetchRequests(); // Refresh after action
    } catch (err: any) {
      console.error('Reject request error:', err.response?.data || err.message);
      Alert.alert('Error', 'Could not reject request');
    }
  };

  const renderRequestCard = ({ item }: { item: StudentRequest }) => (
    <View style={styles.requestCard}>
      <Text style={styles.studentName}>{item.student_name}</Text>
      <Text style={styles.requestDate}>
        {new Date(item.request_date).toLocaleDateString()}
      </Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => acceptRequest(item.student_id)}
          accessibilityLabel={`Accept request from ${item.student_name}`}
        >
          <Text style={styles.actionText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => rejectRequest(item.student_id)}
          accessibilityLabel={`Reject request from ${item.student_name}`}
        >
          <Text style={styles.actionText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!user || user.role !== 'coach') {
    return <Text style={styles.errorText}>Only coaches can view connection requests.</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connection Requests</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#2ECC71" />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.student_id.toString()}
          renderItem={renderRequestCard}
          ListEmptyComponent={<Text style={styles.emptyText}>No pending requests.</Text>}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchRequests} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F9F9F9' },
  title: { fontSize: 24, fontWeight: '600', color: '#2C3E50', marginBottom: 20 },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1.5,
    borderColor: '#2ECC71',
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  studentName: { fontSize: 18, fontWeight: '600', color: '#2C3E50' },
  requestDate: { fontSize: 14, color: '#7B8A8B', marginBottom: 10 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  actionButton: {
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  acceptButton: { backgroundColor: '#2ECC71' },
  rejectButton: { backgroundColor: '#D35400' },
  actionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14, color: '#2C3E50', textAlign: 'center', marginTop: 20 },
  errorText: { fontSize: 14, color: '#D35400', textAlign: 'center', marginTop: 20 },
});

export default ConnectionRequestsScreen;
