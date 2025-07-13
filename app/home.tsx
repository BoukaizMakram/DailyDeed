import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
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

// Import data from separate file
import { Reminder, remindersData } from '../assets/Reminders';

const { width, height } = Dimensions.get('window');

interface DailyProgress {
  date: string;
  completedDeeds: number[];
  favorites: number[];
  currentStreak: number;
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

  useEffect(() => {
    loadProgress();
    loadThemePreference();
    setCurrentReminder(remindersData[currentIndex]);
    startAnimations();
  }, []);

  useEffect(() => {
    setCurrentReminder(remindersData[currentIndex]);
  }, [currentIndex]);

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
                      Today's Good Deed
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
                        {completedToday.includes(index) ? '✓ Completed!' : 'I Did It!'}
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
