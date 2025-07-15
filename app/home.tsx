import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Dimensions,
  Easing,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from "react-native";

import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useFocusEffect } from 'expo-router';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Reminder, remindersData } from '../assets/Reminders';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';


const { width, height } = Dimensions.get('window');

interface DailyProgress {
  date: string;
  completedDeeds: number[];
  favorites: number[];
  currentStreak: number;
}

interface Settings {
  notifications: boolean;
  notificationInterval: number; // in minutes, 0 = disabled, 1-300 (5 hours)
  darkMode: boolean;
  showHadith: boolean;
  dailyGoal: number;
}

interface ThemeColors {
  background: string;
  cardBackground: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  border: string;
  navbar: string;
}

// Configure how notifications are handled when app is in foreground (only for development builds)
try {
  if (Constants.appOwnership !== 'expo') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch (error) {
  console.log('Notification handler setup skipped (Expo Go)');
}

export default function Home() {
  const systemColorScheme = useColorScheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentReminder, setCurrentReminder] = useState<Reminder | null>(null);
  const [completedToday, setCompletedToday] = useState<number[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    notifications: true,
    notificationInterval: 0, // disabled by default
    darkMode: false,
    showHadith: true,
    dailyGoal: 5,
  });
  const [notificationPermission, setNotificationPermission] = useState<string>('undetermined');
  const [isExpoGo, setIsExpoGo] = useState<boolean>(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
  // Load fonts
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardAnimations = useRef(
    remindersData.map(() => ({
      scale: new Animated.Value(1),
      rotation: new Animated.Value(0),
    }))
  ).current;
  const appState = useRef(AppState.currentState);
  const reminderInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTapRef = useRef<{ time: number; index: number } | null>(null);
  const [particles, setParticles] = useState<Array<{
    id: string;
    x: number;
    y: number;
    color: string;
    scale: Animated.Value;
    opacity: Animated.Value;
    translateX: Animated.Value;
    translateY: Animated.Value;
  }>>([]);
  const [hearts, setHearts] = useState<Array<{
    id: string;
    x: number;
    y: number;
    scale: Animated.Value;
    opacity: Animated.Value;
  }>>([]);
  const [completionOverlay, setCompletionOverlay] = useState<{
    visible: boolean;
    scale: Animated.Value;
    messageOpacity: Animated.Value;
    animation?: any;
  } | null>(null);
  
  // Pan gesture state for card following (horizontal only)
  const panX = useRef(new Animated.Value(0)).current;
  
  // Card transition animation
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardSlideX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProgress();
    loadSettings();
    loadThemePreference();
    loadProfileImage();
    setCurrentReminder(remindersData[currentIndex]);
    checkEnvironmentAndPermissions();
    startAnimations();
    
    // Handle app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
      // Clean up interval when component unmounts
      if (reminderInterval.current) {
        clearInterval(reminderInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    setCurrentReminder(remindersData[currentIndex]);
  }, [currentIndex]);

  useEffect(() => {
    // Start or stop reminder interval based on settings
    if (settings.notificationInterval > 0) {
      startReminderSystem();
      // Schedule background notifications (only works in development builds)
      if (notificationPermission === 'granted' && !isExpoGo) {
        scheduleRandomReminderNotifications();
      }
    } else {
      stopReminderSystem();
      // Cancel background notifications
      if (!isExpoGo) {
        cancelAllRandomReminderNotifications();
      }
    }
  }, [settings.notificationInterval, notificationPermission, isExpoGo]);

  // Check permissions after settings are loaded
  useEffect(() => {
    if (settings.notifications && settings.notificationInterval > 0) {
      checkAndRequestPermissions();
    }
  }, [settings.notifications, settings.notificationInterval]);

  // Refresh data when page comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadProgress();
      loadProfileImage();
    }, [])
  );

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to the foreground
      console.log('App has come to the foreground!');
    }
    appState.current = nextAppState;
  };

  // Alternative reminder system for Expo Go
  const startReminderSystem = () => {
    if (reminderInterval.current) {
      clearInterval(reminderInterval.current);
    }
    
    if (settings.notificationInterval === 0) {
      console.log('Reminders disabled');
      return;
    }
    
    const intervalMs = settings.notificationInterval * 60 * 1000; // Convert minutes to milliseconds
    
    reminderInterval.current = setInterval(() => {
      showReminderAlert();
    }, intervalMs);
    
    console.log(`Started reminder system with ${settings.notificationInterval} minute intervals`);
  };

  const stopReminderSystem = () => {
    if (reminderInterval.current) {
      clearInterval(reminderInterval.current);
      reminderInterval.current = null;
      console.log('Stopped reminder system');
    }
  };

  const showReminderAlert = () => {
    const randomIndex = Math.floor(Math.random() * remindersData.length);
    const randomReminder = remindersData[randomIndex];
    
    Alert.alert(
      "Daily Deed Reminder 🌟",
      `${randomReminder.reminder}\n\n— ${randomReminder.source}`,
      [
        {
          text: "Dismiss",
          style: "cancel"
        },
        {
          text: "Mark as Done",
          style: "default",
          onPress: () => {
            if (!completedToday.includes(randomIndex)) {
              const newCompleted = [...completedToday, randomIndex];
              setCompletedToday(newCompleted);
              setTotalCompleted(newCompleted.length);
              if (newCompleted.length === 1) {
                setStreak(streak + 1);
              }
              saveProgress();
            }
          }
        }
      ],
      { cancelable: true }
    );
  };

  const checkEnvironmentAndPermissions = async () => {
    try {
      // Check if running in Expo Go
      const isRunningInExpoGo = Constants.appOwnership === 'expo';
      setIsExpoGo(isRunningInExpoGo);
      
      if (isRunningInExpoGo) {
        console.log('Running in Expo Go - Background notifications not available');
        setNotificationPermission('expo-go-limitation');
        return;
      }
      
      // Only call notification APIs in development builds
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setNotificationPermission(status);
      } catch (notificationError) {
        console.log('Notification API error (likely Expo Go):', notificationError);
        setNotificationPermission('expo-go-limitation');
        setIsExpoGo(true);
      }
    } catch (error) {
      console.log('Error checking environment and permissions:', error);
      setNotificationPermission('error');
    }
  };

  const checkNotificationPermissions = async () => {
    try {
      // Check environment first
      const isRunningInExpoGo = Constants.appOwnership === 'expo';
      if (isRunningInExpoGo || isExpoGo) {
        setNotificationPermission('expo-go-limitation');
        setIsExpoGo(true);
        return;
      }
      
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setNotificationPermission(status);
      } catch (notificationError) {
        console.log('Notification API error (likely Expo Go):', notificationError);
        setNotificationPermission('expo-go-limitation');
        setIsExpoGo(true);
      }
    } catch (error) {
      console.log('Error checking notification permissions:', error);
    }
  };

  const checkAndRequestPermissions = async () => {
    try {
      // Check environment first
      const isRunningInExpoGo = Constants.appOwnership === 'expo';
      if (isRunningInExpoGo || isExpoGo) {
        setNotificationPermission('expo-go-limitation');
        setIsExpoGo(true);
        return;
      }
      
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setNotificationPermission(status);
        
        // If permissions not granted and notifications are enabled in settings, show permission request
        if (status !== 'granted' && settings.notifications && settings.notificationInterval > 0) {
          setTimeout(() => {
            Alert.alert(
              'Enable Notifications',
              'DailyDeeds would like to send you reminders to help you stay consistent with your daily deeds. You can change this in Settings later.',
              [
                {
                  text: 'Not Now',
                  style: 'cancel',
                  onPress: () => setNotificationPermission('denied')
                },
                {
                  text: 'Allow',
                  onPress: requestNotificationPermissions
                }
              ]
            );
          }, 1500); // Delay to ensure UI is ready
        }
      } catch (notificationError) {
        console.log('Notification API error (likely Expo Go):', notificationError);
        setNotificationPermission('expo-go-limitation');
        setIsExpoGo(true);
      }
    } catch (error) {
      console.log('Error checking notification permissions:', error);
    }
  };

  const requestNotificationPermissions = async () => {
    try {
      // Check environment first
      const isRunningInExpoGo = Constants.appOwnership === 'expo';
      if (isRunningInExpoGo || isExpoGo) {
        console.log('Cannot request permissions in Expo Go');
        setNotificationPermission('expo-go-limitation');
        setIsExpoGo(true);
        return false;
      }
      
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
              allowDisplayInCarPlay: false,
              allowCriticalAlerts: false,
              provideAppNotificationSettings: false,
              allowProvisional: false,
              allowAnnouncements: false,
            },
          });
          finalStatus = status;
        }
        
        setNotificationPermission(finalStatus);
        
        if (finalStatus !== 'granted') {
          console.log('Notification permissions not granted');
          Alert.alert(
            'Permissions Required',
            'To receive reminders, please enable notifications in your device settings.',
            [
              {
                text: 'Settings',
                onPress: () => Notifications.openNotificationSettingsAsync?.()
              },
              {
                text: 'Cancel',
                style: 'cancel'
              }
            ]
          );
          return false;
        }
        
        console.log('Local notification permissions granted');
        // Schedule notifications if interval is set
        if (settings.notificationInterval > 0) {
          scheduleRandomReminderNotifications();
        }
        return true;
      } catch (notificationError) {
        console.log('Notification API error (likely Expo Go):', notificationError);
        setNotificationPermission('expo-go-limitation');
        setIsExpoGo(true);
        return false;
      }
    } catch (error) {
      console.log('Error requesting notification permissions:', error);
      return false;
    }
  };

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('appSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      }
    } catch (error) {
      console.log('Error loading settings:', error);
    }
  };

  const scheduleRandomReminderNotifications = async () => {
    try {
      // Check environment first
      const isRunningInExpoGo = Constants.appOwnership === 'expo';
      if (isRunningInExpoGo || isExpoGo) {
        console.log('Background notifications not available in Expo Go');
        return;
      }
      
      await cancelAllRandomReminderNotifications();
      
      if (settings.notificationInterval === 0) {
        console.log('Notifications disabled, not scheduling any');
        return;
      }

      // Check if permissions are granted (with try-catch for Expo Go)
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          console.log('Notifications not granted, cannot schedule');
          return;
        }
      } catch (notificationError) {
        console.log('Notification API error (likely Expo Go):', notificationError);
        return;
      }
      
      const intervalSeconds = settings.notificationInterval * 60;
      const numberOfNotifications = intervalSeconds > 1800 ? 10 : 20;
      
      for (let i = 0; i < numberOfNotifications; i++) {
        const randomIndex = Math.floor(Math.random() * remindersData.length);
        const randomReminder = remindersData[randomIndex];
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Daily Deed Reminder 🌟",
            body: randomReminder.reminder,
            data: { 
              reminder: randomReminder,
              source: randomReminder.source,
              category: randomReminder.category,
              type: 'random_reminder'
            },
            sound: true,
          },
          trigger: {
            seconds: (i + 1) * intervalSeconds,
          } as Notifications.TimeIntervalTriggerInput,
        });
      }
      
      console.log(`Scheduled ${numberOfNotifications} random reminder notifications with ${settings.notificationInterval} minute intervals`);
    } catch (error) {
      console.log('Error scheduling random reminder notifications:', error);
    }
  };

  const cancelAllRandomReminderNotifications = async () => {
    try {
      // Check environment first
      const isRunningInExpoGo = Constants.appOwnership === 'expo';
      if (isRunningInExpoGo || isExpoGo) {
        console.log('Background notifications not available in Expo Go');
        return;
      }
      
      try {
        const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
        
        for (const notification of scheduledNotifications) {
          if (notification.content.data?.type === 'random_reminder') {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          }
        }
        
        console.log('Cancelled all random reminder notifications');
      } catch (notificationError) {
        console.log('Notification API error (likely Expo Go):', notificationError);
      }
    } catch (error) {
      console.log('Error cancelling random reminder notifications:', error);
    }
  };

  const loadProgress = async () => {
    try {
      const today = new Date().toDateString();
      const savedProgress = await AsyncStorage.getItem('dailyProgress');
      const savedFavorites = await AsyncStorage.getItem('favorites');
      const savedStreak = await AsyncStorage.getItem('streak');
      
      if (savedProgress) {
        const progress: DailyProgress = JSON.parse(savedProgress);
        if (progress.date === today) {
          setCompletedToday(progress.completedDeeds);
          setTotalCompleted(progress.completedDeeds.length);
        }
      }
      
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites));
      }
      
      if (savedStreak) {
        setStreak(parseInt(savedStreak));
      }
    } catch (error) {
      console.log('Error loading progress:', error);
    }
  };

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('darkMode');
      if (savedTheme !== null) {
        setIsDarkMode(JSON.parse(savedTheme));
      } else {
        setIsDarkMode(systemColorScheme === 'dark');
      }
    } catch (error) {
      console.log('Error loading theme:', error);
    }
  };

  const loadProfileImage = async () => {
    try {
      const savedProfile = await AsyncStorage.getItem('userProfile');
      if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        setProfileImage(profile.profileImage || null);
      }
    } catch (error) {
      console.log('Error loading profile image:', error);
    }
  };

  const saveProgress = async (updatedFavorites?: number[]) => {
    try {
      const today = new Date().toDateString();
      const favoritesToSave = updatedFavorites || favorites;
      const progress: DailyProgress = {
        date: today,
        completedDeeds: completedToday,
        favorites: favoritesToSave,
        currentStreak: streak
      };
      
      await AsyncStorage.setItem('dailyProgress', JSON.stringify(progress));
      await AsyncStorage.setItem('favorites', JSON.stringify(favoritesToSave));
      await AsyncStorage.setItem('streak', streak.toString());
    } catch (error) {
      console.log('Error saving progress:', error);
    }
  };

  const startAnimations = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  const formatIntervalText = (minutes: number) => {
    if (minutes === 0) return 'Disabled';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
    return `${hours}h ${remainingMinutes}m`;
  };


  // Carousel navigation helper with transition animation
  const navigateToCard = (targetIndex: number) => {
    navigateToCardWithDirection(targetIndex, 'none');
  };

  const navigateToCardWithDirection = (targetIndex: number, direction: 'left' | 'right' | 'none') => {
    if (targetIndex >= 0 && targetIndex < remindersData.length) {
      const slideOffset = direction === 'left' ? 50 : direction === 'right' ? -50 : 0;
      
      // Animate out current card
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(cardScale, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(cardSlideX, {
          toValue: -slideOffset, // Slide out in opposite direction
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start(() => {
        // Update card content
        setCurrentIndex(targetIndex);
        setCurrentReminder(remindersData[targetIndex]);
        
        // Set initial position for new card
        cardSlideX.stopAnimation();
        cardSlideX.setValue(slideOffset); // Start from slide direction
        
        // Animate in new card
        Animated.parallel([
          Animated.timing(cardOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(cardScale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(cardSlideX, {
            toValue: 0, // Slide to center
            duration: 200,
            useNativeDriver: false,
          }),
        ]).start();
      });
    }
  };


  // Gesture handler for card following finger movement (horizontal only)
  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: panX } }],
    { useNativeDriver: false }
  );

  const onHandlerStateChange = (event: any) => {
    const { state, translationX, velocityX } = event.nativeEvent;
    
    if (state === State.END) {
      const threshold = width * 0.25;
      const velocityThreshold = 500;
      
      // Determine if we should navigate to next/previous card
      const shouldNavigate = Math.abs(translationX) > threshold || Math.abs(velocityX) > velocityThreshold;
      
      if (shouldNavigate) {
        if (translationX > 0 && currentIndex > 0) {
          // Swipe right - go to previous card
          navigateToCardWithDirection(currentIndex - 1, 'right');
        } else if (translationX < 0 && currentIndex < remindersData.length - 1) {
          // Swipe left - go to next card
          navigateToCardWithDirection(currentIndex + 1, 'left');
        }
      }
      
      // Spring back to center position
      Animated.spring(panX, {
        toValue: 0,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }).start();
    }
  };

  const markAsCompleted = () => {
    if (!completedToday.includes(currentIndex)) {
      const newCompleted = [...completedToday, currentIndex];
      setCompletedToday(newCompleted);
      setTotalCompleted(newCompleted.length);
      
      if (newCompleted.length === 1) {
        setStreak(streak + 1);
      }
      
      saveProgress();
    }
  };

  const toggleFavorite = async () => {
    let newFavorites;
    if (favorites.includes(currentIndex)) {
      newFavorites = favorites.filter(fav => fav !== currentIndex);
    } else {
      newFavorites = [...favorites, currentIndex];
    }
    setFavorites(newFavorites);
    await saveProgress(newFavorites);
  };

  const getRandomReminder = () => {
    const randomIndex = Math.floor(Math.random() * remindersData.length);
    navigateToCard(randomIndex);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    
    // Get random reminder
    const randomIndex = Math.floor(Math.random() * remindersData.length);
    
    // Refresh data
    await loadProgress();
    
    // Small delay for better UX
    setTimeout(() => {
      navigateToCard(randomIndex);
      setRefreshing(false);
    }, 1000);
  };

  const createCardEdgeParticles = (color: string, count = 8) => {
    const cardWidth = width * 0.85;
    const cardHeight = 480;
    const cardCenterX = width * 0.5;
    const cardCenterY = height * 0.4;
    
    const newParticles = Array.from({ length: count }, (_, i) => {
      // Position particles around card edges
      const angle = (i / count) * 2 * Math.PI;
      const edgeX = cardCenterX + Math.cos(angle) * (cardWidth / 2 - 20);
      const edgeY = cardCenterY + Math.sin(angle) * (cardHeight / 2 - 20);
      
      return {
        id: `${Date.now()}_${i}`,
        x: edgeX,
        y: edgeY,
        color,
        scale: new Animated.Value(0),
        opacity: new Animated.Value(1),
        translateX: new Animated.Value(0),
        translateY: new Animated.Value(0),
      };
    });

    requestAnimationFrame(() => {
      setParticles(prev => [...prev, ...newParticles]);
    });

    // Animate particles outward from edges
    newParticles.forEach((particle, i) => {
      const angle = (i / count) * 2 * Math.PI;
      const outwardX = Math.cos(angle) * 60;
      const outwardY = Math.sin(angle) * 60;
      
      Animated.parallel([
        Animated.timing(particle.scale, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(particle.translateX, {
          toValue: outwardX,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(particle.translateY, {
          toValue: outwardY,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(particle.opacity, {
          toValue: 0,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        requestAnimationFrame(() => {
          setParticles(prev => prev.filter(p => p.id !== particle.id));
        });
      });
    });
  };

  const createHeartAnimation = (x: number, y: number) => {
    const newHeart = {
      id: `heart_${Date.now()}`,
      x,
      y,
      scale: new Animated.Value(0),
      opacity: new Animated.Value(1),
    };

    requestAnimationFrame(() => {
      setHearts(prev => [...prev, newHeart]);
    });

    Animated.sequence([
      Animated.timing(newHeart.scale, {
        toValue: 1.5,
        duration: 400,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(newHeart.scale, {
          toValue: 0,
          duration: 600,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(newHeart.opacity, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      requestAnimationFrame(() => {
        setHearts(prev => prev.filter(h => h.id !== newHeart.id));
      });
    });
  };

  const createCompletionOverlay = () => {
    const overlay = {
      visible: true,
      scale: new Animated.Value(0),
      messageOpacity: new Animated.Value(0),
      animation: null as any,
    };
    
    // Use requestAnimationFrame to avoid useInsertionEffect warning
    requestAnimationFrame(() => {
      setCompletionOverlay(overlay);
      
      const animation = Animated.sequence([
        // Circle grows from button position with bounce effect
        Animated.timing(overlay.scale, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: false,
        }),
        // Message appears with ease in
        Animated.timing(overlay.messageOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Wait a moment
        Animated.delay(1200),
        // Hide message before shrinking starts
        Animated.timing(overlay.messageOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        // Circle shrinks back to button position (no fade)
        Animated.timing(overlay.scale, {
          toValue: 0,
          duration: 800,
          easing: Easing.in(Easing.back(1.2)),
          useNativeDriver: false,
        }),
      ]);
      
      overlay.animation = animation;
      
      animation.start(() => {
        requestAnimationFrame(() => {
          setCompletionOverlay(null);
        });
      });
    });
  };

  const handleCompletionSkip = () => {
    if (completionOverlay?.animation) {
      completionOverlay.animation.stop();
      
      // Quick shrink animation
      Animated.timing(completionOverlay.scale, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        requestAnimationFrame(() => {
          setCompletionOverlay(null);
        });
      });
    }
  };

  const animateCard = (index: number, isFavoriteAction = false) => {
    const randomRotation = (Math.random() - 0.5) * 10;
    const cardAnim = cardAnimations[index];
    
    // Create particles around card edges
    const particleColor = isFavoriteAction ? '#ff6b6b' : '#2fcc35';
    createCardEdgeParticles(particleColor);
    
    Animated.sequence([
      Animated.parallel([
        Animated.timing(cardAnim.scale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: false,
        }),
        Animated.timing(cardAnim.rotation, {
          toValue: randomRotation,
          duration: 100,
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.timing(cardAnim.scale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(cardAnim.rotation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  };

  const handleCardDoubleTap = async (index: number, event?: any) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    // Always animate on tap
    animateCard(index);
    
    if (lastTapRef.current && 
        lastTapRef.current.index === index && 
        now - lastTapRef.current.time < DOUBLE_TAP_DELAY) {
      // Double tap detected - toggle favorite with special animation
      animateCard(index, true);
      
      // Create heart animation at tap location
      if (event && event.nativeEvent) {
        createHeartAnimation(event.nativeEvent.pageX, event.nativeEvent.pageY);
      } else {
        createHeartAnimation(width * 0.5, height * 0.4);
      }
      
      const newFavorites = favorites.includes(index) 
        ? favorites.filter(fav => fav !== index)
        : [...favorites, index];
      setFavorites(newFavorites);
      await saveProgress(newFavorites);
      
      // Reset to prevent triple tap
      lastTapRef.current = null;
    } else {
      // Single tap - record for potential double tap
      lastTapRef.current = { time: now, index };
    }
  };

  if (!fontsLoaded || !currentReminder) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#0a0a0a' : '#f6f8fc' }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: '#2fcc35' }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  const theme: ThemeColors = {
    background: isDarkMode ? '#0a0a0a' : '#f6f8fc',
    cardBackground: isDarkMode ? '#1a1a1a' : '#ffffff',
    textPrimary: isDarkMode ? '#ffffff' : '#333333',
    textSecondary: isDarkMode ? '#a0a0a0' : '#666666',
    accent: '#2fcc35',
    border: isDarkMode ? '#2a2a2a' : '#f0f4f9',
    navbar: '#9ca2ac',
  };

  const isCompleted = completedToday.includes(currentIndex);
  const isFavorite = favorites.includes(currentIndex);
  const progressPercentage = Math.round((totalCompleted / remindersData.length) * 100);

  const cardWidth = Math.floor(width * 0.8);
  const cardMargin = 10;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <Link href="/settings" asChild>
          <TouchableOpacity style={[styles.settingsButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                          <Ionicons name="settings" size={24} color="#9ca1ab" style={styles.settingsIcon} />
          </TouchableOpacity>
        </Link>
        
        <Text style={[styles.headerTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
          Daily Deeds
        </Text>
        
        <Link href="/profile" asChild>
          <TouchableOpacity style={[styles.profileButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={[styles.profileCircle, { backgroundColor: '#9ca2ac' }]}>
              <View style={[styles.profileAvatar, { backgroundColor: theme.border }]}>
                {profileImage ? (
                  <Image 
                    source={{ uri: profileImage }} 
                    style={styles.profileImage}
                  />
                ) : (
                  <Ionicons name="person" size={20} color="#9ca1ab" />
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Link>
      </View>

      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
            progressBackgroundColor={theme.cardBackground}
            title="Pull to refresh"
            titleColor={theme.textSecondary}
          />
        }
      >

        {/* Notification Permission Notice */}
        {settings.notificationInterval > 0 && notificationPermission !== 'granted' && (
          <View style={[styles.permissionNotice, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.permissionContent}>
              <Ionicons 
                name={notificationPermission === 'expo-go-limitation' ? 'build-outline' : 'notifications-off'} 
                size={24} 
                color={notificationPermission === 'expo-go-limitation' ? '#ffa500' : '#ff6b6b'} 
              />
              <View style={styles.permissionText}>
                <Text style={[styles.permissionTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
                  {notificationPermission === 'expo-go-limitation' 
                    ? 'Development Build Required' 
                    : 'Notification Permission Required'}
                </Text>
                <Text style={[styles.permissionDescription, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                  {notificationPermission === 'expo-go-limitation' 
                    ? 'Background notifications require a development build. They don\'t work in Expo Go. Visit expo.dev/develop/development-builds to learn more.'
                    : `Please enable notifications to receive reminders every ${formatIntervalText(settings.notificationInterval).toLowerCase()}, even when the app is closed.`}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.permissionButton, { backgroundColor: theme.accent }]}
              onPress={notificationPermission === 'expo-go-limitation' 
                ? () => Alert.alert(
                    'Development Build Required',
                    'Background notifications are not supported in Expo Go due to SDK 53 limitations. To enable notifications:\n\n1. Create a development build\n2. Install it on your device\n3. Background notifications will work\n\nFor now, in-app reminders will continue to work when the app is open.',
                    [
                      { text: 'Learn More', onPress: () => console.log('Open development builds docs') },
                      { text: 'OK', style: 'cancel' }
                    ]
                  )
                : requestNotificationPermissions
              }
            >
              <Text style={[styles.permissionButtonText, { fontFamily: 'Poppins_500Medium' }]}>
                {notificationPermission === 'expo-go-limitation' ? 'Learn More' : 'Enable'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

       

        {/* Card Carousel with Custom Swipe */}
        <View style={styles.carouselContainer}>
          <Animated.View style={{ opacity: fadeAnim }}>
            <PanGestureHandler
              onGestureEvent={onPanGestureEvent}
              onHandlerStateChange={onHandlerStateChange}
              minPointers={1}
              maxPointers={1}
              avgTouches={true}
              shouldCancelWhenOutside={false}
              activeOffsetX={[-10, 10]}
              activeOffsetY={[-1000, 1000]}
            >
              <View style={styles.cardContainer}>
                {/* Current Card */}
                <Animated.View
                  style={{
                    opacity: cardOpacity,
                    transform: [
                      { translateX: Animated.add(panX, cardSlideX) },
                      { scale: Animated.multiply(cardScale, cardAnimations[currentIndex].scale) },
                      { 
                        rotate: cardAnimations[currentIndex].rotation.interpolate({
                          inputRange: [-10, 10],
                          outputRange: ['-10deg', '10deg'],
                        })
                      }
                    ]
                  }}
                >
                  <TouchableOpacity
                    style={[
                      styles.carouselCard,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.border,
                      }
                    ]}
                    onPress={(event) => handleCardDoubleTap(currentIndex, event)}
                    activeOpacity={0.8}
                  >
                  <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                      <View style={[styles.categoryBadge, { backgroundColor: theme.border }]}> 
                        <Text style={[styles.categoryText, { color: '#6f7781', fontFamily: 'Poppins_500Medium' }]}> 
                          {currentReminder.category}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={async () => {
                      const newFavorites = favorites.includes(currentIndex) 
                        ? favorites.filter(fav => fav !== currentIndex)
                        : [...favorites, currentIndex];
                      setFavorites(newFavorites);
                      await saveProgress(newFavorites);
                      
                      // Create heart particles around the heart icon
                      createCardEdgeParticles('#ff6b6b', 6);
                    }} style={styles.favoriteButton}>
                      <Ionicons name={favorites.includes(currentIndex) ? "heart" : "heart-outline"} size={24} color={favorites.includes(currentIndex) ? "#ff6b6b" : "#9ca1ab"} style={styles.favoriteIcon} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}> 
                      Today&apos;s Good Deed
                    </Text>
                    <Text style={[
                      styles.quoteText, 
                      { 
                        color: theme.textPrimary, 
                        fontFamily: 'Poppins_400Regular'
                      }
                    ]}> 
                      {currentReminder.reminder}
                    </Text>
                    
                    <View style={[styles.sourceSection, { borderTopColor: theme.border }]}> 
                      <Text style={[styles.hadithText, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}> 
                        {currentReminder.hadith}
                      </Text>
                      <Text style={[styles.sourceText, { color: theme.accent, fontFamily: 'Poppins_500Medium' }]}> 
                        {currentReminder.source}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity 
                      style={[
                        styles.actionButton, 
                        { 
                          backgroundColor: completedToday.includes(currentIndex) ? '#95d5a0' : theme.accent,
                          marginBottom: 0
                        }
                      ]} 
                      onPress={async () => {
                        let newCompleted;
                        let newStreak = streak;
                        
                        if (completedToday.includes(currentIndex)) {
                          // Remove from completed
                          newCompleted = completedToday.filter(id => id !== currentIndex);
                          
                          // Decrease streak if this was the only completed deed today
                          if (completedToday.length === 1 && streak > 0) {
                            newStreak = streak - 1;
                            setStreak(newStreak);
                          }
                        } else {
                          // Add to completed
                          newCompleted = [...completedToday, currentIndex];
                          
                          // Update streak if this is the first deed today
                          if (newCompleted.length === 1) {
                            newStreak = streak + 1;
                            setStreak(newStreak);
                          }
                        }
                        
                        setCompletedToday(newCompleted);
                        setTotalCompleted(newCompleted.length);
                        
                        // Show completion overlay for new completions
                        if (!completedToday.includes(currentIndex)) {
                          createCompletionOverlay();
                        }
                        
                        // Save progress with updated data
                        try {
                          const today = new Date().toDateString();
                          const progress = {
                            date: today,
                            completedDeeds: newCompleted,
                            favorites: favorites,
                            currentStreak: newStreak
                          };
                          
                          await AsyncStorage.setItem('dailyProgress', JSON.stringify(progress));
                          await AsyncStorage.setItem('streak', newStreak.toString());
                        } catch (error) {
                          console.log('Error saving progress:', error);
                        }
                      }}
                    >
                      <Text style={[styles.buttonText, { fontFamily: 'Poppins_600SemiBold' }]}> 
                        {completedToday.includes(currentIndex) ? "✓ Tap to Undo" : "I Did It!"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </PanGestureHandler>
          </Animated.View>
          

          {/* Page Indicator */}
          <View style={styles.pageIndicator}>
            {remindersData.map((_, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dot,
                  { 
                    backgroundColor: index === currentIndex ? theme.accent : theme.border,
                    width: index === currentIndex ? 20 : 8,
                  }
                ]}
                onPress={() => navigateToCard(index)}
              />
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <Animated.View 
          style={[
            styles.quickActions,
            {
              opacity: fadeAnim
            }
          ]}
        >
          
        </Animated.View>

        {/* Bottom padding for navbar */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { backgroundColor: '#ffffff' }]}>
                  <TouchableOpacity style={styles.navItem}>
                                               <Ionicons name="home" size={24} color="#0c0c0c" style={styles.navIcon} />
                       <Text style={[styles.navText, { color: '#0c0c0c', fontFamily: 'Poppins_600SemiBold' }]}>Home</Text>
          </TouchableOpacity>
        <Link href="/progress" asChild>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="analytics" size={24} color="#9ca1ab" style={styles.navIcon} />
            <Text style={[styles.navText, { color: '#9ca1ab', fontFamily: 'Poppins_600SemiBold' }]}>
              Progress
            </Text>
          </TouchableOpacity>
        </Link>
        <Link href="/profile" asChild>
          <TouchableOpacity style={styles.navItem}>
                         <Ionicons name="person" size={24} color="#9ca1ab" style={styles.navIcon} />
                          <Text style={[styles.navText, { color: '#9ca1ab', fontFamily: 'Poppins_600SemiBold' }]}>Profile</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/favorites" asChild>
          <TouchableOpacity style={styles.navItem}>
                         <Ionicons name="heart" size={24} color="#9ca1ab" style={styles.navIcon} />
                          <Text style={[styles.navText, { color: '#9ca1ab', fontFamily: 'Poppins_600SemiBold' }]}>Favorites</Text>
          </TouchableOpacity>
        </Link>
      </View>

      {/* Completion Overlay */}
      {completionOverlay && (
        <TouchableOpacity 
          style={styles.completionOverlay} 
          onPress={handleCompletionSkip}
          activeOpacity={1}
        >
          <Animated.View
            style={[
              styles.completionCircle,
              {
                transform: [{ scale: completionOverlay.scale }],
              }
            ]}
          />
          <Animated.View
            style={[
              styles.completionMessage,
              { opacity: completionOverlay.messageOpacity }
            ]}
          >
            <Ionicons name="heart" size={32} color="#ffffff" />
            <Text style={[styles.completionText, { fontFamily: 'Poppins_600SemiBold' }]}>
              Well Done!
            </Text>
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* Heart Animations */}
      <View style={styles.heartOverlay} pointerEvents="none">
        {hearts.map(heart => (
          <Animated.View
            key={heart.id}
            style={[
              styles.heartAnimation,
              {
                left: heart.x - 20,
                top: heart.y - 20,
                transform: [{ scale: heart.scale }],
                opacity: heart.opacity,
              }
            ]}
          >
            <Ionicons name="heart" size={40} color="#ff6b6b" />
          </Animated.View>
        ))}
      </View>

      {/* Particle Overlay */}
      <View style={styles.particleOverlay} pointerEvents="none">
        {particles.map(particle => (
          <Animated.View
            key={particle.id}
            style={[
              styles.particle,
              {
                left: particle.x,
                top: particle.y,
                backgroundColor: particle.color,
                transform: [
                  { scale: particle.scale },
                  { translateX: particle.translateX },
                  { translateY: particle.translateY },
                ],
                opacity: particle.opacity,
              }
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  profileButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  profileCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  settingsButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  settingsIcon: {
    fontSize: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },

  carouselContainer: {
    marginBottom: 20,
  },
  carouselContent: {
    paddingLeft: Math.round(width * 0.075),
    paddingRight: Math.round(width * 0.075),
  },
  carouselCard: {
    width: Math.round(width * 0.85),
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 0,
    borderWidth: 1,
    minHeight: 480,
  },
  cardActions: {
    marginTop: 16,
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 6,
  },
  quickActions: {
    alignItems: 'center',
    marginBottom: 20,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    gap: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  mainCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    minHeight: 400,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  favoriteButton: {
    padding: 8,
  },
  favoriteIcon: {
    fontSize: 24,
  },
  cardContent: {
    flex: 1,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  quoteText: {
    fontSize: 20,
    lineHeight: 30,
    textAlign: 'center',
    fontWeight: '400',
    marginBottom: 20,
  },
  sourceSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  hadithText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  sourceText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  navigationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  actionButton: {
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 40,
    minWidth: 200,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  cardContainer: {
    height: 500,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  permissionNotice: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 1,
    minHeight: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  permissionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  permissionText: {
    marginLeft: 10,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  permissionDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  permissionButton: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },

  statusNotice: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 1,
    minHeight: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 10,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusDescription: {
    fontSize: 14,
    marginTop: 4,
  },

  bottomPadding: {
    height: 100,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 24,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  navText: {
    fontSize: 12,
    fontWeight: '500',
  },
  particleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  completionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
  },
  completionCircle: {
    position: 'absolute',
    width: Math.max(width, height) * 2, // Large enough to cover entire screen
    height: Math.max(width, height) * 2,
    borderRadius: Math.max(width, height),
    backgroundColor: '#2fcc35',
    top: height * 0.7 - Math.max(width, height), // Start from button position
    left: width * 0.5 - Math.max(width, height),
  },
  completionMessage: {
    position: 'absolute',
    top: height * 0.5 - 50, // Center vertically on screen
    left: width * 0.5 - 100, // Center horizontally on screen
    width: 200,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionText: {
    color: '#ffffff',
    fontSize: 24,
    textAlign: 'center',
    marginTop: 8,
  },
  heartOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1500,
  },
  heartAnimation: {
    position: 'absolute',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
