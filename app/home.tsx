import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Dimensions,
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
import { Link } from 'expo-router';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import PagerView from 'react-native-pager-view';
import { Reminder, remindersData } from '../assets/Reminders';
// import * as Notifications from 'expo-notifications'; // Commented out for Expo Go compatibility


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

// Alternative notification system for Expo Go
// When ready for development build, uncomment the expo-notifications code below
/*
// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
*/

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
  const [notificationPermission, setNotificationPermission] = useState<string>('granted'); // For Expo Go compatibility
  
  // Load fonts
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pagerRef = useRef<PagerView>(null);
  const appState = useRef(AppState.currentState);
  const reminderInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadProgress();
    loadSettings();
    loadThemePreference();
    setCurrentReminder(remindersData[currentIndex]);
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
    } else {
      stopReminderSystem();
    }
  }, [settings.notificationInterval]);

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

  // For development build, uncomment this function:
  /*
  const requestNotificationPermissions = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: false,
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
        return;
      }
      
      console.log('Local notification permissions granted');
    } catch (error) {
      console.log('Error requesting notification permissions:', error);
    }
  };
  */

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

  // For development build, uncomment these functions:
  /*
  const scheduleRandomReminderNotifications = async () => {
    try {
      await cancelAllRandomReminderNotifications();
      
      if (settings.notificationInterval === 0) {
        console.log('Notifications disabled, not scheduling any');
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
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      for (const notification of scheduledNotifications) {
        if (notification.content.data?.type === 'random_reminder') {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
      
      console.log('Cancelled all random reminder notifications');
    } catch (error) {
      console.log('Error cancelling random reminder notifications:', error);
    }
  };
  */

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

  const saveProgress = async () => {
    try {
      const today = new Date().toDateString();
      const progress: DailyProgress = {
        date: today,
        completedDeeds: completedToday,
        favorites: favorites,
        currentStreak: streak
      };
      
      await AsyncStorage.setItem('dailyProgress', JSON.stringify(progress));
      await AsyncStorage.setItem('favorites', JSON.stringify(favorites));
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


  // Carousel navigation helper
  const navigateToCard = (targetIndex: number) => {
    if (targetIndex >= 0 && targetIndex < remindersData.length) {
      pagerRef.current?.setPage(targetIndex);
      setCurrentIndex(targetIndex);
      setCurrentReminder(remindersData[targetIndex]);
    }
  };

  // Handle page changes from swipe gestures
  const handlePageSelected = (event: any) => {
    const newIndex = event.nativeEvent.position;
    setCurrentIndex(newIndex);
    setCurrentReminder(remindersData[newIndex]);
  };

  // Gesture handler for better touch detection
  const onPanGestureEvent = (event: any) => {
    const { translationX, translationY, velocityX, velocityY } = event.nativeEvent;
    
    // Determine if this is primarily a horizontal gesture
    const isHorizontalGesture = Math.abs(translationX) > Math.abs(translationY) * 1.5;
    const hasHorizontalVelocity = Math.abs(velocityX) > Math.abs(velocityY);
    
    if (isHorizontalGesture || hasHorizontalVelocity) {
      // Allow PagerView to handle this gesture
      return;
    }
  };

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      const threshold = width * 0.2;
      
      // Only navigate if it's clearly a horizontal swipe
      if (Math.abs(translationX) > threshold) {
        if (translationX > 0 && currentIndex > 0) {
          navigateToCard(currentIndex - 1);
        } else if (translationX < 0 && currentIndex < remindersData.length - 1) {
          navigateToCard(currentIndex + 1);
        }
      }
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

  const toggleFavorite = () => {
    let newFavorites;
    if (favorites.includes(currentIndex)) {
      newFavorites = favorites.filter(fav => fav !== currentIndex);
    } else {
      newFavorites = [...favorites, currentIndex];
    }
    setFavorites(newFavorites);
    saveProgress();
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
        <TouchableOpacity style={[styles.profileButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <View style={[styles.profileAvatar, { backgroundColor: theme.border }]}>
            <Ionicons name="person" size={20} color="#9ca1ab" />
          </View>
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
          Daily Deeds
        </Text>
        
        <Link href="/settings" asChild>
          <TouchableOpacity style={[styles.settingsButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                          <Ionicons name="settings" size={24} color="#9ca1ab" style={styles.settingsIcon} />
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
              <Ionicons name="notifications-off" size={24} color="#ff6b6b" />
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
              onPress={() => Alert.alert('Enable Notifications', 'Please enable notifications in your device settings.', [{ text: 'OK' }])}
            >
              <Text style={[styles.permissionButtonText, { fontFamily: 'Poppins_500Medium' }]}>
                Enable
              </Text>
            </TouchableOpacity>
          </View>
        )}

       

        {/* PagerView Carousel */}
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
              activeOffsetY={[-50, 50]}
              failOffsetY={[-50, 50]}
            >
              <PagerView
                ref={pagerRef}
                style={styles.pagerView}
                initialPage={currentIndex}
                onPageSelected={handlePageSelected}
                orientation="horizontal"
                scrollEnabled={true}
                overdrag={true}
                pageMargin={0}
              >
            {remindersData.map((item, index) => (
              <View key={index} style={styles.pagerPage}>
                <View
                  style={[
                    styles.carouselCard,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                    }
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                      <View style={[styles.categoryBadge, { backgroundColor: theme.border }]}> 
                        <Text style={[styles.categoryText, { color: '#6f7781', fontFamily: 'Poppins_500Medium' }]}> 
                          {item.category}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => {
                      const newFavorites = favorites.includes(index) 
                        ? favorites.filter(fav => fav !== index)
                        : [...favorites, index];
                      setFavorites(newFavorites);
                      saveProgress();
                    }} style={styles.favoriteButton}>
                      <Ionicons name={favorites.includes(index) ? "heart" : "heart-outline"} size={24} color="#9ca1ab" style={styles.favoriteIcon} />
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
                      {item.reminder}
                    </Text>
                    
                    <View style={[styles.sourceSection, { borderTopColor: theme.border }]}> 
                      <Text style={[styles.hadithText, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}> 
                        {item.hadith}
                      </Text>
                      <Text style={[styles.sourceText, { color: theme.accent, fontFamily: 'Poppins_500Medium' }]}> 
                        {item.source}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity 
                      style={[
                        styles.actionButton, 
                        { 
                          backgroundColor: completedToday.includes(index) ? '#95d5a0' : theme.accent,
                          marginBottom: 0
                        }
                      ]} 
                      onPress={() => {
                        if (!completedToday.includes(index)) {
                          const newCompleted = [...completedToday, index];
                          setCompletedToday(newCompleted);
                          setTotalCompleted(newCompleted.length);
                          if (newCompleted.length === 1) {
                            setStreak(streak + 1);
                          }
                          saveProgress();
                        }
                      }}
                      disabled={completedToday.includes(index)}
                    >
                      <Text style={[styles.buttonText, { fontFamily: 'Poppins_600SemiBold' }]}> 
                        {completedToday.includes(index) ? "✓ Completed!" : "I Did It!"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
              </PagerView>
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
        <TouchableOpacity style={styles.navItem} onPress={onRefresh} disabled={refreshing}>
          <Ionicons name={refreshing ? "refresh" : "shuffle"} size={24} color="#9ca1ab" style={styles.navIcon} />
          <Text style={[styles.navText, { color: '#9ca1ab', fontFamily: 'Poppins_600SemiBold' }]}>
            {refreshing ? 'Loading' : 'Random'}
          </Text>
        </TouchableOpacity>
        <Link href="/settings" asChild>
          <TouchableOpacity style={styles.navItem}>
                         <Ionicons name="settings" size={24} color="#9ca1ab" style={styles.navIcon} />
                          <Text style={[styles.navText, { color: '#9ca1ab', fontFamily: 'Poppins_600SemiBold' }]}>Settings</Text>
          </TouchableOpacity>
        </Link>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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

  pagerView: {
    height: 500,
    flex: 0,
  },
  
  pagerPage: {
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
});
