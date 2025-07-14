import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';

const { width } = Dimensions.get('window');

interface DailyProgress {
  date: string;
  completedDeeds: number[];
  favorites: number[];
  currentStreak: number;
}

interface WeeklyData {
  day: string;
  completed: number;
  goal: number;
}

interface Settings {
  notifications: boolean;
  notificationInterval: number;
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

export default function Progress() {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(5);
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [totalDays, setTotalDays] = useState(0);

  // Load fonts
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Animations
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadProgressData();
    loadThemePreference();
    startAnimations();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadProgressData = async () => {
    try {
      const today = new Date().toDateString();
      const savedProgress = await AsyncStorage.getItem('dailyProgress');
      const savedStreak = await AsyncStorage.getItem('streak');
      const savedBestStreak = await AsyncStorage.getItem('bestStreak');
      const savedSettings = await AsyncStorage.getItem('appSettings');

      // Load today's progress
      if (savedProgress) {
        const progress: DailyProgress = JSON.parse(savedProgress);
        if (progress.date === today) {
          setTodayCompleted(progress.completedDeeds.length);
          setTotalCompleted(progress.completedDeeds.length);
        }
      }

      // Load streak data
      if (savedStreak) {
        setCurrentStreak(parseInt(savedStreak));
      }
      if (savedBestStreak) {
        setBestStreak(parseInt(savedBestStreak));
      }

      // Load settings for daily goal
      if (savedSettings) {
        const settings: Settings = JSON.parse(savedSettings);
        setDailyGoal(settings.dailyGoal);
      }

      // Generate weekly data (last 7 days)
      generateWeeklyData();
      
      // Calculate total active days
      calculateTotalDays();
    } catch (error) {
      console.log('Error loading progress data:', error);
    }
  };

  const generateWeeklyData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weekData: WeeklyData[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dayName = days[date.getDay()];
      
      // For demo purposes, generate some random data
      // In a real app, you'd load this from storage
      const completed = i === 0 ? todayCompleted : Math.floor(Math.random() * 8);
      
      weekData.push({
        day: dayName,
        completed,
        goal: dailyGoal,
      });
    }

    setWeeklyData(weekData);
  };

  const calculateTotalDays = () => {
    // For demo purposes, let's say user has been active for some days
    // In a real app, you'd calculate this based on actual data
    setTotalDays(Math.floor(Math.random() * 30) + 15);
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

  if (!fontsLoaded) {
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

  const progressPercentage = Math.min((todayCompleted / dailyGoal) * 100, 100);
  const completionRate = totalDays > 0 ? Math.round((currentStreak / totalDays) * 100) : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <Animated.View 
        style={[
          styles.header, 
          { backgroundColor: theme.background },
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Link href="/home" asChild>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <Ionicons name="arrow-back" size={24} color="#9ca1ab" style={styles.backIcon} />
          </TouchableOpacity>
        </Link>
        <Text style={[styles.headerTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
          Progress Tracker
        </Text>
        <View style={styles.placeholder} />
      </Animated.View>

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Today's Progress */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
            Today's Progress
          </Text>
          
          <View style={[styles.progressCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
                Daily Goal
              </Text>
              <Text style={[styles.progressCount, { color: theme.accent, fontFamily: 'Poppins_700Bold' }]}>
                {todayCompleted}/{dailyGoal}
              </Text>
            </View>
            
            <View style={[styles.progressBarContainer, { backgroundColor: theme.border }]}>
              <View 
                style={[
                  styles.progressBar, 
                  { 
                    backgroundColor: theme.accent,
                    width: `${progressPercentage}%`
                  }
                ]} 
              />
            </View>
            
            <Text style={[styles.progressPercentage, { color: theme.textSecondary, fontFamily: 'Poppins_500Medium' }]}>
              {Math.round(progressPercentage)}% Complete
            </Text>
          </View>
        </Animated.View>

        {/* Stats Overview */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
            Overview
          </Text>
          
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <View style={[styles.statIcon, { backgroundColor: theme.accent + '20' }]}>
                <Ionicons name="flame" size={24} color={theme.accent} />
              </View>
              <Text style={[styles.statNumber, { color: theme.textPrimary, fontFamily: 'Poppins_700Bold' }]}>
                {currentStreak}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                Current Streak
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <View style={[styles.statIcon, { backgroundColor: '#ff9500' + '20' }]}>
                <Ionicons name="trophy" size={24} color="#ff9500" />
              </View>
              <Text style={[styles.statNumber, { color: theme.textPrimary, fontFamily: 'Poppins_700Bold' }]}>
                {bestStreak}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                Best Streak
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <View style={[styles.statIcon, { backgroundColor: '#007AFF' + '20' }]}>
                <Ionicons name="calendar" size={24} color="#007AFF" />
              </View>
              <Text style={[styles.statNumber, { color: theme.textPrimary, fontFamily: 'Poppins_700Bold' }]}>
                {totalDays}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                Active Days
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Weekly Chart */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
            This Week
          </Text>
          
          <View style={[styles.chartCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.chartContainer}>
              {weeklyData.map((data, index) => {
                const height = Math.max((data.completed / Math.max(data.goal, 1)) * 100, 5);
                const isToday = index === weeklyData.length - 1;
                
                return (
                  <View key={data.day} style={styles.chartColumn}>
                    <View style={styles.chartBarContainer}>
                      <View 
                        style={[
                          styles.chartBar,
                          {
                            height: `${height}%`,
                            backgroundColor: isToday ? theme.accent : theme.border,
                          }
                        ]}
                      />
                    </View>
                    <Text style={[styles.chartLabel, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                      {data.day}
                    </Text>
                    <Text style={[styles.chartValue, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                      {data.completed}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* Achievements */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
            Achievements
          </Text>
          
          <View style={[styles.achievementCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.achievementItem}>
              <View style={[styles.achievementIcon, { backgroundColor: currentStreak >= 7 ? theme.accent + '20' : theme.border }]}>
                <Ionicons name="medal" size={24} color={currentStreak >= 7 ? theme.accent : theme.textSecondary} />
              </View>
              <View style={styles.achievementText}>
                <Text style={[styles.achievementTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                  Week Warrior
                </Text>
                <Text style={[styles.achievementDescription, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                  Complete 7 days in a row
                </Text>
              </View>
              {currentStreak >= 7 && (
                <Ionicons name="checkmark-circle" size={24} color={theme.accent} />
              )}
            </View>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <View style={styles.achievementItem}>
              <View style={[styles.achievementIcon, { backgroundColor: bestStreak >= 30 ? theme.accent + '20' : theme.border }]}>
                <Ionicons name="star" size={24} color={bestStreak >= 30 ? theme.accent : theme.textSecondary} />
              </View>
              <View style={styles.achievementText}>
                <Text style={[styles.achievementTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                  Monthly Master
                </Text>
                <Text style={[styles.achievementDescription, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                  Complete 30 days in a row
                </Text>
              </View>
              {bestStreak >= 30 && (
                <Ionicons name="checkmark-circle" size={24} color={theme.accent} />
              )}
            </View>
          </View>
        </Animated.View>

        {/* Bottom padding for navbar */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { backgroundColor: '#ffffff' }]}>
        <Link href="/home" asChild>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="home" size={24} color="#9ca1ab" style={styles.navIcon} />
            <Text style={[styles.navText, { color: '#9ca1ab', fontFamily: 'Poppins_500Medium' }]}>Home</Text>
          </TouchableOpacity>
        </Link>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="analytics" size={24} color="#0c0c0c" style={styles.navIcon} />
          <Text style={[styles.navText, { color: '#0c0c0c', fontFamily: 'Poppins_500Medium' }]}>Progress</Text>
        </TouchableOpacity>
        <Link href="/profile" asChild>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="person" size={24} color="#9ca1ab" style={styles.navIcon} />
            <Text style={[styles.navText, { color: '#9ca1ab', fontFamily: 'Poppins_500Medium' }]}>Profile</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/favorites" asChild>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="heart" size={24} color="#9ca1ab" style={styles.navIcon} />
            <Text style={[styles.navText, { color: '#9ca1ab', fontFamily: 'Poppins_500Medium' }]}>Favorites</Text>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  backIcon: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 4,
  },
  progressCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  progressCount: {
    fontSize: 24,
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 12,
    borderRadius: 6,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  progressPercentage: {
    fontSize: 14,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  chartCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
  },
  chartBarContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    width: 20,
    marginBottom: 8,
  },
  chartBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  chartValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  achievementCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  achievementText: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
  },
  separator: {
    height: 1,
    marginLeft: 64,
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