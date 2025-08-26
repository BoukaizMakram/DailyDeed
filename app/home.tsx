import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Dimensions,
  Easing,
  Image,
  Modal,
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
import { Reminder } from '../assets/Reminders';
import { ReminderManager } from '../services/ReminderManager';
import { Achievement, achievementsList } from '../assets/Achievements';
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
        shouldShowBanner: true,
        shouldShowList: true,
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
  const [isAnyAnimationPlaying, setIsAnyAnimationPlaying] = useState(false);
  const [remindersData, setRemindersData] = useState<Reminder[]>([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(true);
  
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

  // Achievement overlay state
  const [achievementOverlay, setAchievementOverlay] = useState<{
    visible: boolean;
    achievement: {
      title: string;
      message: string;
      icon: string;
      color: string;
      category: string;
    };
    scale: Animated.Value;
    messageOpacity: Animated.Value;
    iconScale?: Animated.Value;
    titleScale?: Animated.Value;
    animation?: any;
  } | null>(null);

  // Right-side popup notification state
  const [rightPopup, setRightPopup] = useState<{
    visible: boolean;
    message: string;
    translateX: Animated.Value;
    opacity: Animated.Value;
    animation?: any;
  } | null>(null);

  // Custom alert modal state
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: string;
    }>;
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
    
    // Handle notification responses
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );
    
    return () => {
      subscription?.remove();
      notificationSubscription?.remove();
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

  const handleNotificationResponse = async (response: Notifications.NotificationResponse) => {
    const notificationData = response.notification.request.content.data;
    
    if (notificationData?.type === 'good_deed_inspiration') {
      console.log('User tapped on good deed notification:', notificationData.goodDeed);
      
      // Find the good deed in our data
      const goodDeedIndex = remindersData.findIndex(
        reminder => reminder.reminder === notificationData.goodDeed
      );
      
      if (goodDeedIndex !== -1) {
        // Navigate to that specific good deed
        setCurrentIndex(goodDeedIndex);
        setCurrentReminder(remindersData[goodDeedIndex]);
        
        // Show a welcome back message
        setTimeout(async () => {
          await showRightPopupNotification("Welcome back! Ready to do this good deed?");
        }, 1000);
      } else {
        // Show a general inspiration message
        setTimeout(async () => {
          await showRightPopupNotification("Great to see you back! Time for some kindness.");
        }, 1000);
      }
    }
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
    const randomGoodDeed = remindersData[randomIndex];
    
    const alertTitles = [
      "💫 Good Deed Inspiration",
      "🌟 Kindness Reminder", 
      "✨ Spread Some Joy",
      "💖 Make Someone's Day"
    ];
    const randomTitle = alertTitles[Math.floor(Math.random() * alertTitles.length)];
    
    Alert.alert(
      randomTitle,
      `${randomGoodDeed.reminder}\n\n— ${randomGoodDeed.source}`,
      [
        {
          text: "Maybe Later",
          style: "cancel"
        },
        {
          text: "I'll Do It!",
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
              // Navigate to the good deed they committed to
              setCurrentIndex(randomIndex);
              setCurrentReminder(randomGoodDeed);
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
                onPress: () => {
                  // Navigate to system settings since openNotificationSettingsAsync is not available
                  console.log('Opening notification settings...');
                }
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

  // Custom alert function to show properly contained modal
  const showCustomAlert = (title: string, message: string, buttons: Array<{text: string, onPress?: () => void, style?: string}>) => {
    setCustomAlert({
      visible: true,
      title,
      message,
      buttons
    });
  };

  const hideCustomAlert = () => {
    setCustomAlert(null);
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

  const scheduleRandomGoodDeedNotifications = async () => {
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
      const numberOfNotifications = intervalSeconds > 1800 ? 15 : 30; // More notifications for good deeds
      
      for (let i = 0; i < numberOfNotifications; i++) {
        const randomIndex = Math.floor(Math.random() * remindersData.length);
        const randomGoodDeed = remindersData[randomIndex];
        
        // Create variation in notification titles
        const notificationTitles = [
          "💫 Good Deed Inspiration",
          "🌟 Daily Kindness Reminder", 
          "✨ Spread Some Joy",
          "💖 Make Someone's Day",
          "🌈 Random Act of Kindness"
        ];
        const randomTitle = notificationTitles[Math.floor(Math.random() * notificationTitles.length)];
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: randomTitle,
            body: randomGoodDeed.reminder,
            data: { 
              goodDeed: randomGoodDeed.reminder,
              source: randomGoodDeed.source,
              category: randomGoodDeed.category,
              type: 'good_deed_inspiration',
              originalReminder: randomGoodDeed
            },
            sound: true,
            badge: 1,
          },
          trigger: {
            seconds: (i + 1) * intervalSeconds + Math.floor(Math.random() * 300), // Add randomness up to 5 minutes
          } as Notifications.TimeIntervalTriggerInput,
        });
      }
      
      console.log(`Scheduled ${numberOfNotifications} good deed inspiration notifications with ${settings.notificationInterval} minute intervals`);
    } catch (error) {
      console.log('Error scheduling good deed notifications:', error);
    }
  };

  // Keep the old function name for backward compatibility but point to new function
  const scheduleRandomReminderNotifications = scheduleRandomGoodDeedNotifications;

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
          if (notification.content.data?.type === 'random_reminder' || 
              notification.content.data?.type === 'good_deed_inspiration') {
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

  const handleDailyReset = async (lastDate: string, currentDate: string) => {
    try {
      // Save yesterday's progress to calendar/weekly tracking
      const savedProgress = await AsyncStorage.getItem('dailyProgress');
      if (savedProgress) {
        const progress: DailyProgress = JSON.parse(savedProgress);
        
        // Save to calendar system
        const savedCalendar = await AsyncStorage.getItem('calendarProgress');
        const calendarData: Record<string, {
          completed: number[];
          completedCount: number;
          goalMet: boolean;
          streak: number;
        }> = savedCalendar ? JSON.parse(savedCalendar) : {};
        
        // Store yesterday's data
        calendarData[lastDate] = {
          completed: progress.completedDeeds,
          completedCount: progress.completedDeeds.length,
          goalMet: progress.completedDeeds.length >= settings.dailyGoal,
          streak: progress.currentStreak
        };
        
        await AsyncStorage.setItem('calendarProgress', JSON.stringify(calendarData));
        
        // Update weekly tracking
        await updateWeeklyTracking(lastDate, progress.completedDeeds.length);
        
        // Handle streak logic
        const daysDifference = Math.floor((new Date(currentDate).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysDifference > 1) {
          // Missed days, reset streak
          setStreak(0);
          await AsyncStorage.setItem('streak', '0');
        } else if (progress.completedDeeds.length === 0) {
          // Yesterday had no completions, reset streak
          setStreak(0);
          await AsyncStorage.setItem('streak', '0');
        }
      }
      
      console.log(`Daily reset completed for ${lastDate} -> ${currentDate}`);
    } catch (error) {
      console.log('Error handling daily reset:', error);
    }
  };

  const updateWeeklyTracking = async (date: string, completedCount: number) => {
    try {
      const dateObj = new Date(date);
      const weekStart = new Date(dateObj);
      weekStart.setDate(dateObj.getDate() - dateObj.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toDateString();
      
      const savedWeekly = await AsyncStorage.getItem('weeklyProgress');
      const weeklyData: Record<string, {
        days: Record<string, number>;
        totalCompleted: number;
        daysActive: number;
      }> = savedWeekly ? JSON.parse(savedWeekly) : {};
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          days: {},
          totalCompleted: 0,
          daysActive: 0
        };
      }
      
      // Check if this day already exists to avoid double counting
      const previousCount = weeklyData[weekKey].days[date] || 0;
      const wasActive = previousCount > 0;
      
      // Update the day's count
      weeklyData[weekKey].days[date] = completedCount;
      
      // Update total completed (subtract old count, add new count)
      weeklyData[weekKey].totalCompleted = weeklyData[weekKey].totalCompleted - previousCount + completedCount;
      
      // Update active days count
      const isActive = completedCount > 0;
      if (wasActive && !isActive) {
        // Day became inactive
        weeklyData[weekKey].daysActive = Math.max(0, weeklyData[weekKey].daysActive - 1);
      } else if (!wasActive && isActive) {
        // Day became active
        weeklyData[weekKey].daysActive += 1;
      }
      
      await AsyncStorage.setItem('weeklyProgress', JSON.stringify(weeklyData));
    } catch (error) {
      console.log('Error updating weekly tracking:', error);
    }
  };

  const loadProgress = async () => {
    try {
      const today = new Date().toDateString();
      const savedProgress = await AsyncStorage.getItem('dailyProgress');
      const savedFavorites = await AsyncStorage.getItem('favorites');
      const savedStreak = await AsyncStorage.getItem('streak');
      const savedLastActiveDate = await AsyncStorage.getItem('lastActiveDate');
      
      // Check if it's a new day and handle reset
      if (savedLastActiveDate && savedLastActiveDate !== today) {
        await handleDailyReset(savedLastActiveDate, today);
      }
      
      if (savedProgress) {
        const progress: DailyProgress = JSON.parse(savedProgress);
        if (progress.date === today) {
          setCompletedToday(progress.completedDeeds);
          setTotalCompleted(progress.completedDeeds.length);
        } else {
          // New day, start fresh
          setCompletedToday([]);
          setTotalCompleted(0);
        }
      } else {
        // No previous progress, start fresh
        setCompletedToday([]);
        setTotalCompleted(0);
      }
      
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites));
      }
      
      if (savedStreak) {
        setStreak(parseInt(savedStreak));
      }

      // Update last active date
      await AsyncStorage.setItem('lastActiveDate', today);
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
      
      // Save current day's progress
      await AsyncStorage.setItem('dailyProgress', JSON.stringify(progress));
      await AsyncStorage.setItem('favorites', JSON.stringify(favoritesToSave));
      await AsyncStorage.setItem('streak', streak.toString());
      await AsyncStorage.setItem('totalCompleted', totalCompleted.toString());

      // Update historical progress data
      const savedHistory = await AsyncStorage.getItem('progressHistory');
      const historyData: Record<string, number> = savedHistory ? JSON.parse(savedHistory) : {};
      
      // Update today's count in history
      historyData[today] = completedToday.length;
      
      // Save updated history
      await AsyncStorage.setItem('progressHistory', JSON.stringify(historyData));

      // Update calendar data for today
      const savedCalendar = await AsyncStorage.getItem('calendarProgress');
      const calendarData: Record<string, {
        completed: number[];
        completedCount: number;
        goalMet: boolean;
        streak: number;
      }> = savedCalendar ? JSON.parse(savedCalendar) : {};
      
      calendarData[today] = {
        completed: completedToday,
        completedCount: completedToday.length,
        goalMet: completedToday.length >= settings.dailyGoal,
        streak: streak
      };
      
      await AsyncStorage.setItem('calendarProgress', JSON.stringify(calendarData));

      // Update weekly tracking for today
      console.log('Updating weekly tracking for today:', today, 'count:', completedToday.length);
      await updateWeeklyTracking(today, completedToday.length);

      // Update best streak if current is higher
      if (streak > 0) {
        const savedBestStreak = await AsyncStorage.getItem('bestStreak');
        const currentBest = savedBestStreak ? parseInt(savedBestStreak) : 0;
        if (streak > currentBest) {
          await AsyncStorage.setItem('bestStreak', streak.toString());
        }
      }
    } catch (error) {
      console.log('Error saving progress:', error);
    }
  };

  // Achievement system functions
  const checkAndUnlockAchievements = async () => {
    try {
      const savedAchievements = await AsyncStorage.getItem('achievements');
      let userAchievements: Achievement[] = savedAchievements ? JSON.parse(savedAchievements) : achievementsList;
      
      const currentStats = {
        totalCompleted: totalCompleted,
        currentStreak: streak,
        goalDaysCount: await getGoalDaysCount()
      };
      
      let newlyUnlocked: Achievement[] = [];
      
      // Check each achievement
      const updatedAchievements = userAchievements.map(achievement => {
        if (achievement.unlocked) return achievement;
        
        let shouldUnlock = false;
        
        switch (achievement.condition.type) {
          case 'total_completed':
            shouldUnlock = currentStats.totalCompleted >= achievement.condition.value;
            break;
          case 'streak':
            shouldUnlock = currentStats.currentStreak >= achievement.condition.value;
            break;
          case 'daily_goal':
            shouldUnlock = currentStats.goalDaysCount >= achievement.condition.value;
            break;
          case 'app_shared':
          case 'deed_shared':
          case 'app_reviewed':
            // These achievements are handled separately when the user performs the action
            // Don't check them here as they're not part of automatic progress tracking
            shouldUnlock = false;
            break;
        }
        
        if (shouldUnlock) {
          newlyUnlocked.push({ ...achievement, unlocked: true });
          return { ...achievement, unlocked: true };
        }
        
        return achievement;
      });
      
      // Save updated achievements
      await AsyncStorage.setItem('achievements', JSON.stringify(updatedAchievements));
      
      // Show animations for newly unlocked achievements
      if (newlyUnlocked.length > 0) {
        for (const achievement of newlyUnlocked) {
          await showAchievementOverlay(achievement);
          // Wait before showing next achievement
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
    } catch (error) {
      console.log('Error checking achievements:', error);
    }
  };

  const getGoalDaysCount = async (): Promise<number> => {
    try {
      const savedCalendar = await AsyncStorage.getItem('calendarProgress');
      if (!savedCalendar) return 0;
      
      const calendarData = JSON.parse(savedCalendar);
      let goalDays = 0;
      
      Object.values(calendarData).forEach((dayData: any) => {
        if (dayData.goalMet) goalDays++;
      });
      
      return goalDays;
    } catch (error) {
      console.log('Error getting goal days count:', error);
      return 0;
    }
  };

  const showAchievementOverlay = (achievement: Achievement): Promise<void> => {
    return new Promise((resolve) => {
      const scale = new Animated.Value(0);
      const messageOpacity = new Animated.Value(0);
      const iconScale = new Animated.Value(0);
      const titleScale = new Animated.Value(0);

      setIsAnyAnimationPlaying(true);
      setAchievementOverlay({
        visible: true,
        achievement: {
          title: achievement.title,
          message: achievement.message,
          icon: achievement.icon,
          color: achievement.color,
          category: achievement.category
        },
        scale,
        messageOpacity,
      });

      // Create enhanced expanding circle animation with staggered content
      const animation = Animated.sequence([
        // Phase 1: Circle expansion with bounce effect
        Animated.spring(scale, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        // Phase 2: Staggered content animation
        Animated.stagger(150, [
          Animated.spring(iconScale, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(titleScale, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(messageOpacity, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        // Phase 3: Hold for display
        Animated.delay(2500),
        // Phase 4: Exit animation
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0,
            duration: 600,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(messageOpacity, {
            toValue: 0,
            duration: 400,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ])
      ]);

      // Store animation references for skip functionality
      setAchievementOverlay(prev => prev ? { 
        ...prev, 
        animation,
        iconScale,
        titleScale
      } : null);

      animation.start(() => {
        setAchievementOverlay(null);
        setIsAnyAnimationPlaying(false);
        resolve();
      });
    });
  };

  const showRightPopupNotification = (message: string): Promise<void> => {
    return new Promise((resolve) => {
      const translateX = new Animated.Value(width);
      const opacity = new Animated.Value(0);

      setRightPopup({
        visible: true,
        message,
        translateX,
        opacity,
      });

      const animation = Animated.sequence([
        // Slide in from right
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: 0,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        // Hold for reading
        Animated.delay(3000),
        // Slide out to right
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: width,
            duration: 300,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ])
      ]);

      setRightPopup(prev => prev ? { ...prev, animation } : null);

      animation.start(() => {
        setRightPopup(null);
        resolve();
      });
    });
  };

  const createCompletionOverlay = (): Promise<void> => {
    return new Promise((resolve) => {
      const scale = new Animated.Value(0);
      const messageOpacity = new Animated.Value(0);

      setIsAnyAnimationPlaying(true);
      setCompletionOverlay({
        visible: true,
        scale,
        messageOpacity,
      });

      // Create expanding circle animation
      const animation = Animated.sequence([
        Animated.timing(scale, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(messageOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(1500),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(messageOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ]);

      setCompletionOverlay(prev => prev ? { ...prev, animation } : null);

      animation.start(() => {
        setCompletionOverlay(null);
        setIsAnyAnimationPlaying(false);
        resolve();
      });
    });
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
        
        // Show popup with a different random good deed when navigating
        if (Math.random() < 0.3) { // 30% chance to show popup on navigation
          setTimeout(async () => {
            const availableDeeds = remindersData.filter((_, index) => index !== targetIndex);
            const randomDeed = availableDeeds[Math.floor(Math.random() * availableDeeds.length)];
            await showRightPopupNotification(randomDeed.reminder);
          }, 800);
        }
        
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
        id: `${Date.now()}_${Math.random()}_${i}`, // More unique IDs
        x: edgeX,
        y: edgeY,
        color,
        scale: new Animated.Value(0),
        opacity: new Animated.Value(1),
        translateX: new Animated.Value(0),
        translateY: new Animated.Value(0),
      };
    });

    // Add particles immediately without requestAnimationFrame to prevent timing issues
    setParticles(prev => [...prev, ...newParticles]);

    // Animate particles outward from edges
    newParticles.forEach((particle, i) => {
      const angle = (i / count) * 2 * Math.PI;
      const outwardX = Math.cos(angle) * 60;
      const outwardY = Math.sin(angle) * 60;
      
      // Start animation immediately
      const particleAnimation = Animated.parallel([
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
      ]);
      
      particleAnimation.start(({ finished }) => {
        // Only remove if animation completed normally
        if (finished) {
          setParticles(prev => prev.filter(p => p.id !== particle.id));
        }
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


  const handleCompletionSkip = () => {
    if (completionOverlay?.animation) {
      completionOverlay.animation.stop();
      
      // Quick shrink animation
      Animated.timing(completionOverlay.scale, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        requestAnimationFrame(() => {
          setCompletionOverlay(null);
          setIsAnyAnimationPlaying(false);
        });
      });
    }
  };

  const handleAchievementSkip = () => {
    if (achievementOverlay?.animation) {
      achievementOverlay.animation.stop();
      
      // Quick shrink animation for all elements
      const animations = [
        Animated.timing(achievementOverlay.scale, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(achievementOverlay.messageOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        })
      ];

      // Add icon and title animations if they exist
      if (achievementOverlay.iconScale) {
        animations.push(
          Animated.timing(achievementOverlay.iconScale, {
            toValue: 0,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          })
        );
      }

      if (achievementOverlay.titleScale) {
        animations.push(
          Animated.timing(achievementOverlay.titleScale, {
            toValue: 0,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          })
        );
      }

      Animated.parallel(animations).start(() => {
        requestAnimationFrame(() => {
          setAchievementOverlay(null);
          setIsAnyAnimationPlaying(false);
        });
      });
    }
  };

  const handleGlobalTapToSkip = () => {
    if (completionOverlay) {
      handleCompletionSkip();
    } else if (achievementOverlay) {
      handleAchievementSkip();
    }
  };

  // Helper function to unlock special achievements
  const unlockSpecialAchievement = async (achievementType: 'app_shared' | 'deed_shared' | 'app_reviewed') => {
    try {
      // Mark the achievement as triggered in storage
      await AsyncStorage.setItem(achievementType, 'true');
      
      // Load current achievements
      const savedAchievements = await AsyncStorage.getItem('achievements');
      const userAchievements: Achievement[] = savedAchievements ? JSON.parse(savedAchievements) : achievementsList;
      
      // Find and unlock the specific achievement
      const updatedAchievements = userAchievements.map(achievement => {
        if (achievement.condition.type === achievementType && !achievement.unlocked) {
          // Show the achievement animation
          showAchievementOverlay(achievement);
          return { ...achievement, unlocked: true };
        }
        return achievement;
      });
      
      // Save updated achievements
      await AsyncStorage.setItem('achievements', JSON.stringify(updatedAchievements));
      
    } catch (error) {
      console.log('Error unlocking special achievement:', error);
    }
  };

  const animateCard = (index: number, isFavoriteAction = false) => {
    const randomRotation = (Math.random() - 0.5) * 10;
    const cardAnim = cardAnimations[index];
    
    // Stop any existing animations for this card to prevent conflicts
    cardAnim.scale.stopAnimation();
    cardAnim.rotation.stopAnimation();
    
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
    <TouchableOpacity 
      style={[styles.container, { backgroundColor: theme.background }]}
      onPress={isAnyAnimationPlaying ? handleGlobalTapToSkip : undefined}
      activeOpacity={1}
      disabled={!isAnyAnimationPlaying}
    >
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
        {settings.notificationInterval > 0 && notificationPermission !== 'granted' && notificationPermission !== 'expo-go-limitation' && (
          <View style={[styles.permissionNotice, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.permissionContent}>
              <Ionicons 
                name="notifications-off"
                size={24} 
                color="#ff6b6b"
              />
              <View style={styles.permissionText}>
                <Text style={[styles.permissionTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
                  Notification Permission Required
                </Text>
                <Text style={[styles.permissionDescription, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                  Please enable notifications to receive reminders every {formatIntervalText(settings.notificationInterval).toLowerCase()}, even when the app is closed.
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.permissionButton, { backgroundColor: theme.accent }]}
              onPress={requestNotificationPermissions}
            >
              <Text style={[styles.permissionButtonText, { fontFamily: 'Poppins_500Medium' }]}>
                Enable
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
                          await createCompletionOverlay();
                          // Show a random good deed popup after completion
                          setTimeout(async () => {
                            const randomIndex = Math.floor(Math.random() * remindersData.length);
                            const randomGoodDeed = remindersData[randomIndex];
                            await showRightPopupNotification(randomGoodDeed.reminder);
                          }, 1000);
                          // Check for newly unlocked achievements
                          setTimeout(() => checkAndUnlockAchievements(), 500);
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

      {/* Custom Alert Modal */}
      {customAlert && (
        <Modal
          visible={customAlert.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={hideCustomAlert}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
                {customAlert.title}
              </Text>
              <Text style={[styles.modalMessage, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                {customAlert.message}
              </Text>
              <View style={styles.modalActions}>
                {customAlert.buttons.map((button, index) => (
                  <TouchableOpacity 
                    key={index}
                    style={[
                      styles.modalButton, 
                      button.style === 'cancel' ? styles.cancelModalButton : styles.primaryModalButton,
                      button.style === 'cancel' ? { borderColor: theme.border } : { backgroundColor: theme.accent }
                    ]}
                    onPress={() => {
                      hideCustomAlert();
                      button.onPress?.();
                    }}
                  >
                    <Text style={[
                      styles.modalButtonText, 
                      { 
                        color: button.style === 'cancel' ? theme.textSecondary : '#ffffff',
                        fontFamily: 'Poppins_500Medium'
                      }
                    ]}>
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Completion Overlay */}
      {completionOverlay && (
        <View style={styles.completionOverlay}>
          <Animated.View 
            style={[
              styles.completionCircle, 
              {
                transform: [{ scale: completionOverlay.scale }]
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.completionMessage,
              {
                opacity: completionOverlay.messageOpacity
              }
            ]}
          >
            <Ionicons name="checkmark-circle" size={48} color="#ffffff" />
            <Text style={[styles.completionText, { fontFamily: 'Poppins_700Bold' }]}>
              Well Done!
            </Text>
          </Animated.View>
        </View>
      )}

      {/* Achievement Overlay */}
      {achievementOverlay && (
        <TouchableOpacity 
          style={styles.achievementOverlay}
          onPress={handleAchievementSkip}
          activeOpacity={1}
        >
          <Animated.View 
            style={[
              styles.achievementCircle, 
              {
                backgroundColor: achievementOverlay.achievement.color,
                transform: [{ scale: achievementOverlay.scale }]
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.achievementMessage,
              {
                opacity: achievementOverlay.messageOpacity
              }
            ]}
          >
            <View style={[styles.achievementCategoryBadge, { backgroundColor: achievementOverlay.achievement.color + '20' }]}>
              <Text style={[styles.achievementCategoryText, { 
                color: achievementOverlay.achievement.color, 
                fontFamily: 'Poppins_600SemiBold' 
              }]}>
                {achievementOverlay.achievement.category}
              </Text>
            </View>
            <Animated.View
              style={[
                styles.achievementIconContainer,
                {
                  transform: [{ scale: achievementOverlay.iconScale || new Animated.Value(1) }]
                }
              ]}
            >
              <Ionicons 
                name={achievementOverlay.achievement.icon as any} 
                size={60} 
                color="#ffffff" 
                style={styles.achievementIcon}
              />
            </Animated.View>
            <Animated.View
              style={[
                styles.achievementTitleContainer,
                {
                  transform: [{ scale: achievementOverlay.titleScale || new Animated.Value(1) }]
                }
              ]}
            >
              <Text style={[styles.achievementTitle, { fontFamily: 'Poppins_700Bold' }]}>
                Achievement Unlocked!
              </Text>
              <Text style={[styles.achievementName, { fontFamily: 'Poppins_600SemiBold' }]}>
                {achievementOverlay.achievement.title}
              </Text>
            </Animated.View>
            <Text style={[styles.achievementDescription, { fontFamily: 'Poppins_400Regular' }]}>
              {achievementOverlay.achievement.message}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* Right-side Popup Notification */}
      {rightPopup && (
        <Animated.View
          style={[
            styles.rightPopupContainer,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
              transform: [{ translateX: rightPopup.translateX }],
              opacity: rightPopup.opacity,
            }
          ]}
          pointerEvents="none"
        >
          <View style={styles.rightPopupContent}>
            <Ionicons 
              name="bulb" 
              size={20} 
              color={theme.accent} 
              style={styles.rightPopupIcon}
            />
            <Text style={[
              styles.rightPopupText, 
              { 
                color: theme.textPrimary,
                fontFamily: 'Poppins_500Medium'
              }
            ]}>
              {rightPopup.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </TouchableOpacity>
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
  // Custom Alert Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'left',
    flexShrink: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelModalButton: {
    borderWidth: 1,
  },
  primaryModalButton: {
    // backgroundColor will be set dynamically
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    flexShrink: 1,
  },
  // Completion Overlay Styles
  completionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completionCircle: {
    position: 'absolute',
    width: Math.max(width, height) * 2,
    height: Math.max(width, height) * 2,
    borderRadius: Math.max(width, height),
    backgroundColor: '#2fcc35',
  },
  completionMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2001,
  },
  completionText: {
    color: '#ffffff',
    fontSize: 24,
    textAlign: 'center',
    marginTop: 8,
  },
  // Achievement Overlay Styles
  achievementOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementCircle: {
    position: 'absolute',
    width: Math.max(width, height) * 2,
    height: Math.max(width, height) * 2,
    borderRadius: Math.max(width, height),
  },
  achievementMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3001,
    paddingHorizontal: 40,
  },
  achievementCategoryBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  achievementCategoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  achievementIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  achievementIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  achievementTitleContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  achievementTitle: {
    color: '#ffffff',
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  achievementName: {
    color: '#ffffff',
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  achievementDescription: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  // Right popup notification styles
  rightPopupContainer: {
    position: 'absolute',
    top: 120,
    right: 20,
    maxWidth: width * 0.8,
    minWidth: 200,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 4000,
  },
  rightPopupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rightPopupIcon: {
    flexShrink: 0,
  },
  rightPopupText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
});
