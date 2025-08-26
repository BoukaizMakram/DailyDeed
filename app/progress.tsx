import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { Achievement, achievementsList } from '../assets/Achievements';

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
  const [achievements, setAchievements] = useState<Achievement[]>(achievementsList);
  const [goalDaysCount, setGoalDaysCount] = useState(0);
  const [calendarData, setCalendarData] = useState<Record<string, {
    completed: number[];
    completedCount: number;
    goalMet: boolean;
    streak: number;
  }>>({});
  const [currentWeekData, setCurrentWeekData] = useState<{
    days: Record<string, number>;
    totalCompleted: number;
    daysActive: number;
  } | null>(null);

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

  // Reload data when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadProgressData();
    }, [todayCompleted, currentStreak, bestStreak, dailyGoal])
  );

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
      const savedTotalCompleted = await AsyncStorage.getItem('totalCompleted');
      const savedHistoryData = await AsyncStorage.getItem('progressHistory');

      // Load today's progress
      if (savedProgress) {
        const progress: DailyProgress = JSON.parse(savedProgress);
        if (progress.date === today) {
          setTodayCompleted(progress.completedDeeds.length);
        }
      }

      // Load total completed from dedicated storage
      if (savedTotalCompleted) {
        setTotalCompleted(parseInt(savedTotalCompleted));
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

      // Generate weekly data using historical data
      await generateWeeklyData(savedHistoryData);
      
      // Calculate total active days from historical data
      await calculateTotalDays(savedHistoryData);
      
      // Calculate goal achievement days
      await calculateGoalDays(savedHistoryData);
      
      // Load calendar and weekly data
      await loadCalendarData();
      
      // Load and update achievements
      await loadAchievements();
    } catch (error) {
      console.log('Error loading progress data:', error);
    }
  };

  const generateWeeklyData = async (savedHistoryData: string | null) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weekData: WeeklyData[] = [];
    
    // Use calendar data primarily, fallback to history data
    const historyData: Record<string, number> = savedHistoryData ? JSON.parse(savedHistoryData) : {};

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dayName = days[date.getDay()];
      const dateKey = date.toDateString();
      
      // Get actual completed count for this date, or 0 if no data
      let completed = 0;
      if (i === 0) {
        // Today's data
        completed = todayCompleted;
      } else {
        // Try calendar data first, then historical data
        const calendarDayData = calendarData[dateKey];
        if (calendarDayData) {
          completed = calendarDayData.completedCount;
        } else {
          completed = historyData[dateKey] || 0;
        }
      }
      
      weekData.push({
        day: dayName,
        completed,
        goal: dailyGoal,
      });
    }

    setWeeklyData(weekData);
  };

  const calculateTotalDays = async (savedHistoryData: string | null) => {
    try {
      // Parse historical data
      const historyData: Record<string, number> = savedHistoryData ? JSON.parse(savedHistoryData) : {};
      
      // Count days where user completed at least one deed
      let activeDays = 0;
      const today = new Date().toDateString();
      
      // Count from historical data
      Object.keys(historyData).forEach(date => {
        if (historyData[date] > 0) {
          activeDays++;
        }
      });
      
      // Add today if user has completed deeds
      if (todayCompleted > 0 && !historyData[today]) {
        activeDays++;
      }
      
      setTotalDays(activeDays);
    } catch (error) {
      console.log('Error calculating total days:', error);
      setTotalDays(0);
    }
  };

  const calculateGoalDays = async (savedHistoryData: string | null) => {
    try {
      const historyData: Record<string, number> = savedHistoryData ? JSON.parse(savedHistoryData) : {};
      const today = new Date().toDateString();
      
      let goalDays = 0;
      
      // Count from historical data
      Object.keys(historyData).forEach(date => {
        if (historyData[date] >= dailyGoal) {
          goalDays++;
        }
      });
      
      // Add today if goal is reached
      if (todayCompleted >= dailyGoal && (!historyData[today] || historyData[today] < dailyGoal)) {
        goalDays++;
      }
      
      setGoalDaysCount(goalDays);
    } catch (error) {
      console.log('Error calculating goal days:', error);
      setGoalDaysCount(0);
    }
  };

  const loadAchievements = async () => {
    try {
      const savedAchievements = await AsyncStorage.getItem('achievements');
      let userAchievements: Achievement[] = savedAchievements ? JSON.parse(savedAchievements) : achievementsList;
      
      // Update achievements based on current progress
      const updatedAchievements = await Promise.all(userAchievements.map(async achievement => {
        let shouldUnlock = false;
        
        switch (achievement.condition.type) {
          case 'total_completed':
            shouldUnlock = totalCompleted >= achievement.condition.value;
            break;
          case 'streak':
            shouldUnlock = currentStreak >= achievement.condition.value || bestStreak >= achievement.condition.value;
            break;
          case 'daily_goal':
            shouldUnlock = goalDaysCount >= achievement.condition.value;
            break;
          case 'app_shared':
            // Check if app has been shared
            const appShared = await AsyncStorage.getItem('appShared');
            shouldUnlock = appShared === 'true';
            break;
          case 'deed_shared':
            // Check if deed has been shared
            const deedShared = await AsyncStorage.getItem('deedShared');
            shouldUnlock = deedShared === 'true';
            break;
          case 'app_reviewed':
            // Check if app has been reviewed
            const appReviewed = await AsyncStorage.getItem('appReviewed');
            shouldUnlock = appReviewed === 'true';
            break;
        }
        
        return { ...achievement, unlocked: shouldUnlock };
      }));
      
      setAchievements(updatedAchievements);
      
      // Save updated achievements
      await AsyncStorage.setItem('achievements', JSON.stringify(updatedAchievements));
    } catch (error) {
      console.log('Error loading achievements:', error);
    }
  };

  const loadCalendarData = async () => {
    try {
      // Load calendar progress
      const savedCalendar = await AsyncStorage.getItem('calendarProgress');
      if (savedCalendar) {
        setCalendarData(JSON.parse(savedCalendar));
      }

      // Load current week data
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekKey = weekStart.toDateString();
      
      const savedWeekly = await AsyncStorage.getItem('weeklyProgress');
      if (savedWeekly) {
        const weeklyProgress = JSON.parse(savedWeekly);
        if (weeklyProgress[weekKey]) {
          setCurrentWeekData(weeklyProgress[weekKey]);
        }
      }
    } catch (error) {
      console.log('Error loading calendar data:', error);
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

  const renderCalendarGrid = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Day headers
    const dayHeaders = dayNames.map(day => (
      <Text key={day} style={[styles.calendarDayHeader, { color: theme.textSecondary, fontFamily: 'Poppins_500Medium' }]}>
        {day}
      </Text>
    ));

    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = new Date(currentYear, currentMonth, day).toDateString();
      const dayData = calendarData[dateString];
      const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
      
      let dayStyle = styles.calendarDay;
      let textStyle = [styles.calendarDayText, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }];
      let backgroundStyle = {};
      
      if (isToday) {
        backgroundStyle = { backgroundColor: theme.accent };
        textStyle = [styles.calendarDayText, { color: '#ffffff', fontFamily: 'Poppins_500Medium' }];
      } else if (dayData?.goalMet) {
        backgroundStyle = { backgroundColor: theme.accent + '40' };
      } else if (dayData?.completedCount > 0) {
        backgroundStyle = { backgroundColor: theme.accent + '20' };
      }

      days.push(
        <View key={day} style={[dayStyle, backgroundStyle]}>
          <Text style={textStyle}>{day}</Text>
          {dayData?.completedCount > 0 && (
            <View style={[styles.calendarDayDot, { backgroundColor: dayData.goalMet ? theme.accent : '#ffa500' }]} />
          )}
        </View>
      );
    }

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          {dayHeaders}
        </View>
        <View style={styles.calendarGrid}>
          {days}
        </View>
      </View>
    );
  };

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
        {/* Total Deeds Performed */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={[styles.totalDeedsCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={[styles.totalDeedsIcon, { backgroundColor: theme.accent + '20' }]}>
              <Ionicons name="checkmark-circle" size={48} color={theme.accent} />
            </View>
            <Text style={[styles.totalDeedsNumber, { color: theme.textPrimary, fontFamily: 'Poppins_700Bold' }]}>
              {todayCompleted}
            </Text>
            <Text style={[styles.totalDeedsLabel, { color: theme.textSecondary, fontFamily: 'Poppins_500Medium' }]}>
              Daily Deeds Done Today
            </Text>
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
  // Calendar styles
  calendarCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  calendarContainer: {
    width: '100%',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  calendarDayHeader: {
    fontSize: 12,
    textAlign: 'center',
    width: 40,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  calendarDay: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 20,
    position: 'relative',
  },
  calendarDayText: {
    fontSize: 14,
    textAlign: 'center',
  },
  calendarDayDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  weekSummaryCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  weekSummaryTitle: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  weekSummaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weekStat: {
    alignItems: 'center',
  },
  weekStatNumber: {
    fontSize: 20,
    marginBottom: 4,
  },
  weekStatLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  achievementCategoryBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  achievementCategoryTextSmall: {
    fontSize: 10,
    fontWeight: '500',
  },
  totalDeedsCard: {
    borderRadius: 20,
    padding: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  totalDeedsIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  totalDeedsNumber: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 8,
  },
  totalDeedsLabel: {
    fontSize: 18,
    textAlign: 'center',
  },
});