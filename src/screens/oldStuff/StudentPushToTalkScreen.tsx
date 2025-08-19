import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Image,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  AppState,
} from 'react-native';
import {
  createAgoraRtcEngine,
  ClientRoleType,
  ChannelProfileType,
  AudioVolumeInfo,
  LocalAudioStreamState,
  LocalAudioStreamReason,
  RtcConnection,
  UserOfflineReasonType,
  ErrorCodeType,
  RemoteAudioState,
  RemoteAudioStateReason,
  ConnectionStateType,
  ConnectionChangedReasonType,
} from 'react-native-agora';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import * as Animatable from 'react-native-animatable';
import { useTheme, useViewport } from '../../App';
import { useRoute, useNavigation } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import SoundPlayer from 'react-native-sound-player';
import Slider from '@react-native-community/slider';
import Navbar from '../components/Navbar';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import Toast from 'react-native-toast-message';

interface Coach {
  id: number;
  firstName: string;
  lastName: string;
  profile_picture_id?: string;
}

const AGORA_PING_URL = 'https://webdemo.agora.io';
const APP_ID = '823fc35be02245e7882fd6761fe4f907';
const DEBUG = true;

const log = (message: string, data: any = {}) => {
  if (DEBUG) {
    console.log(`[AgoraStudent ${new Date().toISOString()}] ${message}`, JSON.stringify(data, null, 2));
  }
};

const StudentPushToTalkScreen: React.FC = () => {
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const { width, height } = useViewport();
  const route = useRoute();
  const navigation = useNavigation();
  const { coach } = route.params as { coach: Coach };
  const [isJoined, setIsJoined] = useState(false);
  const [isCoachTalking, setIsCoachTalking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [localVolume, setLocalVolume] = useState<number>(0);
  const [remoteVolume, setRemoteVolume] = useState<number>(0);
  const [agoraToken, setAgoraToken] = useState<string | null>(null);
  const rtcEngine = useRef<ReturnType<typeof createAgoraRtcEngine> | null>(null);
  const eventHandler = useRef<any>(null);
  const avatarScaleAnim = useRef<Animated.Value>(new Animated.Value(1)).current;
  const buttonScaleAnim = useRef<Animated.Value>(new Animated.Value(1)).current;
  const appState = useRef(AppState.currentState);
  const pulseAnim = useRef<Animated.Value>(new Animated.Value(1)).current;

  const CHANNEL_ID = `coach_${coach.id}_student_${user?.id}`;
  const cardWidth = Math.min(width * 0.9, 400);
  const dynamicFontSize = Math.min(24, width * 0.06);
  const [playbackVolume, setPlaybackVolume] = useState<number>(100); // Default volume at 100%

  useEffect(() => {
    log('Rendering StudentPushToTalkScreen', { userRole: user?.role, coachId: coach.id });
  }, []);

  useEffect(() => {
    if (error) {
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: error,
      });
    }
    if (success) {
      Toast.show({
        type: 'success',
        text1: 'Erfolg',
        text2: success,
      });
    }
  }, [error, success]);

  useEffect(() => {
    // Update Agora playback volume whenever playbackVolume changes
    if (rtcEngine.current && isJoined) {
      rtcEngine.current.adjustPlaybackSignalVolume(playbackVolume);
      log('Adjusted playback volume', { volume: playbackVolume });
    }
  }, [playbackVolume, isJoined]);

  useEffect(() => {
    if (remoteVolume > 20) { // Threshold for coach speaking
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [remoteVolume]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      log('App state changed', { from: appState.current, to: nextAppState });
      appState.current = nextAppState;
      if (nextAppState === 'active' && !isJoined) {
        log('App returned to active, attempting to rejoin channel');
        joinChannel();
      } else if (nextAppState === 'background') {
        log('App entered background, maintaining Agora connection');
        // Ensure Agora audio session remains active
        if (rtcEngine.current) {
          rtcEngine.current.setParameters('{"che.audio.keep.audiosession": true}');
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isJoined]);

  const getPermission = async () => {
    log('Checking audio permissions');
    const permission =
      Platform.OS === 'android' ? PERMISSIONS.ANDROID.RECORD_AUDIO : PERMISSIONS.IOS.MICROPHONE;
    const result = await check(permission);
    if (result !== RESULTS.GRANTED) {
      const newResult = await request(permission);
      if (newResult !== RESULTS.GRANTED) {
        setError('Mikrofonzugriff verweigert. Bitte in den Einstellungen aktivieren.');
        log('Permission denied');
        return false;
      }
    }
    log('Permission granted');
    return true;
  };

  const pingAgora = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(AGORA_PING_URL, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeoutId);
      log('Agora server ping successful', { status: response.status });
      return response.status === 200;
    } catch (err) {
      log('Agora server ping failed', { error: (err as Error).message });
      return false;
    }
  };

  const fetchAgoraToken = async (channelName: string, uid: number) => {
    log('Fetching Agora token', { channelName, uid });
    try {
      const response = await axios.post(
        'https://api.jurite.de/auth/agora-token',
        { channelName, uid },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const fetchedToken = response.data.token;
      const role = response.data.role;
      log('Token fetched successfully', { token: fetchedToken.slice(0, 20) + '...', role });
      if (!['audience', 'subscriber'].includes(role) && user?.role === 'student') {
        log('Role mismatch: Expected audience or subscriber for student', { receivedRole: role });
        setError('Rollenkonflikt: Tokenrolle passt nicht zu Student.');
        return null;
      }
      setSuccess('Verbunden mit Coach!');
      return fetchedToken;
    } catch (err: any) {
      log('Token fetch error', { error: err.response?.data || err.message });
      setError('Agora Token konnte nicht abgerufen werden: ' + (err.response?.data?.message || err.message));
      return null;
    }
  };

  const joinChannel = async (retryCount = 0, maxRetries = 5) => {
    if (!rtcEngine.current) {
      log('No Agora engine instance');
      setError('Agora Engine nicht initialisiert.');
      return;
    }

    let token = agoraToken;
    if (!token) {
      log('No cached token, fetching new one');
      token = await fetchAgoraToken(CHANNEL_ID, user?.id || 0);
      if (!token) {
        log('Token fetch failed, aborting join');
        return;
      }
      setAgoraToken(token);
    }

    const isReachable = await pingAgora();
    if (!isReachable) {
      log('Agora servers unreachable');
      setError('Keine Verbindung zu Agora-Servern. Überprüfen Sie Ihre Netzwerkverbindung.');
      return;
    }

    log('Validating join parameters', { appId: APP_ID, token: token.slice(0, 20) + '...', channelId: CHANNEL_ID });
    if (!token || !CHANNEL_ID) {
      log('Invalid token or channel ID');
      setError('Ungültiges Token oder Channel-ID.');
      return;
    }

    try {
      log(`Attempting to join channel (Retry ${retryCount + 1}/${maxRetries})`, {
        channelId: CHANNEL_ID,
        token: token.slice(0, 20) + '...',
        uid: user?.id || 0,
      });
      await rtcEngine.current.setChannelProfile(ChannelProfileType.ChannelProfileLiveBroadcasting);
      await rtcEngine.current.setClientRole(ClientRoleType.ClientRoleAudience);
      await rtcEngine.current.setParameters('{"che.audio.keep.audiosession": true}'); // Ensure audio session persists
      const startTime = Date.now();
      const code = rtcEngine.current.joinChannel(token, CHANNEL_ID, user?.id || 0, {});
      const duration = Date.now() - startTime;
      log('Join channel request sent, awaiting response (timeout: 60s)', { duration, returnCode: code });
      if (code !== 0) {
        throw new Error(`Join failed immediately with code ${code}`);
      }
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          if (!isJoined && retryCount < maxRetries) {
            log('Join timeout detected, retrying');
            reject(new Error('Timeout'));
          } else {
            resolve();
          }
        }, 60000);
        const intervalId = setInterval(() => {
          if (isJoined) {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
            resolve();
          }
        }, 500);
      });
    } catch (err) {
      log('Join channel error', { error: (err as Error).message });
      setError(`Kanalbeitritt fehlgeschlagen: ${(err as Error).message}`);
      if (retryCount < maxRetries) {
        log(`Retrying join in 2 seconds (Attempt ${retryCount + 2}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await joinChannel(retryCount + 1, maxRetries);
      } else {
        log('Max retries reached');
      }
    }
  };

  const retryConnection = async () => {
    log('Manual retry triggered');
    setError('Manuelles erneutes Verbinden...');
    Animated.timing(buttonScaleAnim, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
    await rtcEngine.current?.leaveChannel();
    setAgoraToken(null); // Clear token to force refresh
    await joinChannel();
    if (!isJoined) {
      setError('Kanal konnte nicht beigetreten werden.');
    }
  };

  useEffect(() => {
    const initAgora = async () => {
      if (!user?.id || !coach.id) {
        log('Missing user or coach ID');
        setError('Benutzer- oder Coach-ID fehlt.');
        return;
      }

      const permissionGranted = await getPermission();
      if (!permissionGranted) {
        log('Initialization aborted due to missing permission');
        return;
      }

      log('Starting Agora initialization');
      try {
        log('Creating Agora engine');
        rtcEngine.current = createAgoraRtcEngine();

        log('Initializing engine with App ID', { appId: APP_ID });
        await rtcEngine.current.initialize({
          appId: APP_ID,
          logConfig: { filePath: `${RNFS.DocumentDirectoryPath}/agora_student.log` },
        });

        eventHandler.current = {
          onJoinChannelSuccess: (connection: RtcConnection, elapsed: number) => {
            log('Joined channel', { connection });
            setIsJoined(true);
            setSuccess('Verbunden mit Kanal!');
          },
          onError: (err: ErrorCodeType, msg: string) => {
            log('Agora error', { err, msg });
            let errorMessage = `Agora Fehler: ${msg} (Code: ${err})`;
            if (err === ErrorCodeType.ErrTokenExpired) {
              errorMessage = 'Sitzung abgelaufen. Bitte erneut verbinden.';
              setAgoraToken(null); // Force token refresh
              joinChannel();
            } else if (err === ErrorCodeType.ErrNoServerResources) {
              errorMessage = 'Server überlastet. Bitte später versuchen.';
            }
            setError(errorMessage);
          },
          onUserJoined: (connection: RtcConnection, remoteUid: number, elapsed: number) => {
            log('Coach joined', { remoteUid });
            if (remoteUid === coach.id) {
              setIsCoachTalking(true);
            }
          },
          onUserOffline: (connection: RtcConnection, remoteUid: number, reason: UserOfflineReasonType) => {
            log('Coach offline', { remoteUid, reason });
            if (remoteUid === coach.id) {
              setIsCoachTalking(false);
              setRemoteVolume(0);
              setError('Coach hat den Kanal verlassen.');
            }
          },
          onRemoteAudioStateChanged: (connection: RtcConnection, remoteUid: number, state: RemoteAudioState, reason: RemoteAudioStateReason, elapsed: number) => {
            log('Remote audio state changed', { remoteUid, state, reason });
            if (remoteUid === coach.id) {
              const talking = state === 2;
              setIsCoachTalking(talking);
              if (!talking) {
                setRemoteVolume(0);
              }
            }
          },
          onAudioVolumeIndication: (
            connection: RtcConnection,
            speakers: AudioVolumeInfo[],
            speakerNumber: number,
            totalVolume: number
          ) => {
            speakers.forEach((speaker) => {
              if (speaker.uid === 0) {
                setLocalVolume(speaker.volume);
              } else if (speaker.uid === coach.id) {
                setRemoteVolume(speaker.volume);
                if (speaker.volume > 0) {
                  log('Coach volume changed', { volume: speaker.volume });
                }
              }
            });
          },
          onConnectionStateChanged: (connection: RtcConnection, state: ConnectionStateType, reason: ConnectionChangedReasonType) => {
            log('Connection state changed', { state, reason });
            if (state === ConnectionStateType.ConnectionStateDisconnected) {  // Note: 5 is ConnectionStateFailed, but use enum
              setIsJoined(false);
              setError('Verbindung verloren. Versuche erneut zu verbinden...');
              joinChannel();
            }
          },
          onConnectionLost: (connection: RtcConnection) => {
            log('Connection lost', { connection });
            setIsJoined(false);
            setError('Verbindung verloren. Versuche erneut zu verbinden...');
            joinChannel();
          },
          onLocalAudioStateChanged: (
            connection: RtcConnection,
            state: LocalAudioStreamState,
            reason: LocalAudioStreamReason
          ) => {
            log('Local audio state changed', { state, reason });
            if (state === LocalAudioStreamState.LocalAudioStreamStateFailed) {
              setError(`Audioaufnahme fehlgeschlagen: ${reason}`);
            }
          },
        };
        log('Registering event handler');
        rtcEngine.current.registerEventHandler(eventHandler.current);

        log('Configuring engine');
        await rtcEngine.current.setChannelProfile(ChannelProfileType.ChannelProfileLiveBroadcasting);
        await rtcEngine.current.setClientRole(ClientRoleType.ClientRoleAudience);
        await rtcEngine.current.setDefaultAudioRouteToSpeakerphone(true);
        await rtcEngine.current.enableAudio();
        await rtcEngine.current.enableAudioVolumeIndication(200, 3, true);
        await rtcEngine.current.setParameters('{"che.audio.keep.audiosession": true}'); // Persist audio session

        await joinChannel();
      } catch (err) {
        log('Initialization error', { error: (err as Error).message });
        setError('Agora konnte nicht initialisiert werden: ' + (err as Error).message);
      }
    };

    initAgora();

    return () => {
      log('Cleaning up Agora engine');
      if (rtcEngine.current) {
        rtcEngine.current.unregisterEventHandler(eventHandler.current);
        rtcEngine.current.leaveChannel();
        rtcEngine.current.release();
      }
    };
  }, [user?.id, coach.id, token]);

  useEffect(() => {
    const fetchProfilePicture = async () => {
      if (!coach.profile_picture_id || !token) return;
      try {
        log('Fetching profile picture for coach', { coachId: coach.id });
        const filename = `profile_picture_${coach.id}.png`;
        const cachePath = `${RNFS.DocumentDirectoryPath}/${filename}`;
        const exists = await RNFS.exists(cachePath);
        if (exists) {
          setProfileImage(`file://${cachePath}`);
          log('Using cached profile image');
          return;
        }
        const url = `https://api.jurite.de/auth/users/${coach.id}/profile-picture`;
        const res = await RNFS.downloadFile({
          fromUrl: url,
          toFile: cachePath,
          headers: { Authorization: `Bearer ${token}` },
        }).promise;
        if (res.statusCode === 200) {
          setProfileImage(`file://${cachePath}`);
          log('Profile image fetched and cached');
        } else {
          log('Profile image fetch failed', { statusCode: res.statusCode });
        }
      } catch (err) {
        log('Profile picture fetch error', { error: (err as Error).message });
      }
    };

    fetchProfilePicture();

    return () => {
      if (profileImage) {
        RNFS.unlink(profileImage.replace('file://', '')).catch((err) =>
          log('Error deleting temp file', { error: err })
        );
      }
    };
  }, [coach.id, coach.profile_picture_id, token]);

  if (user?.role !== 'student') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Navbar navigation={navigation} />
        <Animatable.Text animation="fadeIn" style={[styles.error, { color: colors.secondary }]}>
          Nur Schüler können diese Seite sehen.
        </Animatable.Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Navbar navigation={navigation} />
      <Animatable.Text
        animation="fadeInDown"
        duration={600}
        style={[
          styles.title,
          { color: colors.text },
        ]}
      >
        Live-Coaching mit {coach.firstName} {coach.lastName}
      </Animatable.Text>
      <View style={styles.centeredContent}>
        <Animatable.View
          animation="bounceInUp"
          duration={1000}
          easing="ease-out"
          style={[styles.coachCard, { width: cardWidth }]}
        >
          <View style={[styles.cardGradient, { backgroundColor: colors.surface }]}>
            <View style={styles.paddedWrapper}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                {profileImage ? (
                  <Image
                    source={{ uri: profileImage }}
                    style={[styles.avatarImage, { borderColor: colors.primary + '33' }]}
                    accessibilityLabel={`Profilbild von ${coach.firstName} ${coach.lastName}`}
                    onError={() => setProfileImage(null)}
                  />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.primary + '33', borderColor: colors.primary + '33' }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>{`${coach.firstName[0]}${coach.lastName[0]}`}</Text>
                  </View>
                )}
              </Animated.View>
              <View style={styles.studentInfo}>
                <Text style={[styles.coachName, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  {coach.firstName} {coach.lastName}
                </Text>
                <View style={styles.connectionStatus}>
                  <Animatable.View animation={isCoachTalking ? "pulse" : undefined} iterationCount="infinite" duration={800} style={[
                    styles.statusDot,
                    { backgroundColor: isCoachTalking ? colors.primary : colors.secondary },
                  ]} />
                  <Text
                    style={[
                      styles.connectionText,
                      { color: isCoachTalking ? colors.primary : colors.secondary },
                    ]}
                  >
                    {isCoachTalking ? 'Spricht' : 'Nicht aktiv'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Animatable.View>
        <Animatable.View
          animation="bounceInUp"
          duration={1000}
          delay={300}
          easing="ease-out"
          style={[styles.statusCard, { width: cardWidth }]}
        >
          <View style={[styles.cardGradient, { backgroundColor: colors.surface }]}>
            <View style={styles.statusContent}>
              {!isJoined && !error && (
                <Animatable.View animation="rotate" iterationCount="infinite" duration={1000}>
                  <ActivityIndicator size="large" color={colors.primary} style={styles.loadingIndicator} />
                </Animatable.View>
              )}
              <View
                style={[styles.statusGradient, { backgroundColor: isCoachTalking ? colors.primary : colors.secondary }]}
              >
                <Text style={[styles.statusText, { color: colors.background }]} adjustsFontSizeToFit numberOfLines={1}>
                  {isJoined
                    ? isCoachTalking
                      ? 'Coach spricht...'
                      : 'Warten auf Coach...'
                    : 'Verbinde...'}
                </Text>
              </View>
              <View style={styles.volumeContainer}>
                <Text style={[styles.volumeText, { color: colors.text }]}>Coach Lautstärke</Text>
                <View style={styles.volumeBarBackground}>
                  <View
                    style={[
                      styles.volumeBar,
                      { width: `${(remoteVolume / 255) * 100}%`, backgroundColor: colors.primary },
                    ]}
                  />
                </View>
                <Text style={[styles.volumeText, { color: colors.text }]}>Ausgabe-Lautstärke: {playbackVolume}%</Text>
                <Slider
                  style={styles.volumeSlider}
                  minimumValue={0}
                  maximumValue={100}
                  step={1}
                  value={playbackVolume}
                  onValueChange={(value) => setPlaybackVolume(Math.round(value))}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.muted}
                  thumbTintColor={colors.primary}
                  accessibilityLabel="Ausgabe-Lautstärke anpassen"
                />
              </View>
              {!isJoined && (
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={retryConnection}
                  accessibilityLabel="Verbindung erneut versuchen"
                >
                  <View style={[styles.buttonGradient, { backgroundColor: colors.accent }]}>
                    <Animated.Text style={[styles.retryButtonText, { transform: [{ scale: buttonScaleAnim }], color: colors.background }]}>
                      Erneut verbinden
                    </Animated.Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animatable.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 40,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  coachCard: {
    marginBottom: 32,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  statusCard: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
    flex: 1,
    maxWidth: 400,
  },
  cardGradient: {
    borderRadius: 16,
    width: '100%',
  },
  paddedWrapper: {
    padding: 24,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
  },
  coachName: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  statusGradient: {
    borderRadius: 16,
    marginBottom: 32,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  volumeContainer: {
    width: '100%',
    marginBottom: 32,
  },
  volumeText: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
  volumeBarBackground: {
    width: '90%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333333',
    marginBottom: 24,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  volumeBar: {
    height: '100%',
    borderRadius: 4,
  },
  volumeSlider: {
    width: '90%',
    height: 50,
    alignSelf: 'center',
  },
  retryButton: {
    borderRadius: 16,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  retryButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  studentInfo: {
    alignItems: 'center',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusContent: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIndicator: {
    marginBottom: 24,
  },
});

// Custom toast config (assuming this is set in App.tsx, but for completeness)
export const toastConfig = {
  success: ({ text1, text2 }: { text1: string; text2: string }) => (
    <View style={toastStyles.container}>
      <Text style={toastStyles.text1}>{text1}</Text>
      <Text style={toastStyles.text2}>{text2}</Text>
    </View>
  ),
  error: ({ text1, text2 }: { text1: string; text2: string }) => (
    <View style={[toastStyles.container, { backgroundColor: '#EF5350' }]}>
      <Text style={toastStyles.text1}>{text1}</Text>
      <Text style={toastStyles.text2}>{text2}</Text>
    </View>
  ),
};

const toastStyles = StyleSheet.create({
  container: {
    backgroundColor: '#2ECC71', // Match LoginScreen primary color
    padding: 24, // Increased for larger component
    borderRadius: 12,
    width: '100%', // Full-width for bigger feel
    alignItems: 'center',
  },
  text1: {
    fontSize: 20, // Increased from 18
    fontWeight: '700',
    color: '#FFFFFF',
  },
  text2: {
    fontSize: 18, // Increased from 16
    color: '#FFFFFF',
    marginTop: 4,
  },
});

export default StudentPushToTalkScreen;
