import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { Reminder, remindersData } from '../assets/Reminders';

const { width } = Dimensions.get('window');

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

export default function Favorites() {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [completedToday, setCompletedToday] = useState<number[]>([]);
  const [showCompletedModal, setShowCompletedModal] = useState(false);

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
    loadFavorites();
    loadProgress();
    loadThemePreference();
    startAnimations();
  }, []);

  // Refresh data when page comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadFavorites();
      loadProgress();
    }, [])
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

  const loadFavorites = async () => {
    try {
      const savedFavorites = await AsyncStorage.getItem('favorites');
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites));
      }
    } catch (error) {
      console.log('Error loading favorites:', error);
    }
  };

  const loadProgress = async () => {
    try {
      const today = new Date().toDateString();
      const savedProgress = await AsyncStorage.getItem('dailyProgress');
      
      if (savedProgress) {
        const progress: DailyProgress = JSON.parse(savedProgress);
        if (progress.date === today) {
          setCompletedToday(progress.completedDeeds);
        }
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

  const toggleFavorite = async (index: number) => {
    const newFavorites = favorites.includes(index)
      ? favorites.filter(fav => fav !== index)
      : [...favorites, index];
    
    setFavorites(newFavorites);
    
    try {
      await AsyncStorage.setItem('favorites', JSON.stringify(newFavorites));
      
      // Also update the daily progress
      const today = new Date().toDateString();
      const savedProgress = await AsyncStorage.getItem('dailyProgress');
      
      if (savedProgress) {
        const progress: DailyProgress = JSON.parse(savedProgress);
        if (progress.date === today) {
          progress.favorites = newFavorites;
          await AsyncStorage.setItem('dailyProgress', JSON.stringify(progress));
        }
      }
    } catch (error) {
      console.log('Error saving favorites:', error);
    }
  };

  const markAsCompleted = async (index: number) => {
    if (!completedToday.includes(index)) {
      const newCompleted = [...completedToday, index];
      setCompletedToday(newCompleted);
      
      try {
        const today = new Date().toDateString();
        const progress: DailyProgress = {
          date: today,
          completedDeeds: newCompleted,
          favorites: favorites,
          currentStreak: 0 // This would be calculated properly in a real app
        };
        
        await AsyncStorage.setItem('dailyProgress', JSON.stringify(progress));
      } catch (error) {
        console.log('Error saving progress:', error);
      }
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

  const favoriteReminders = favorites.map(index => ({
    ...remindersData[index],
    originalIndex: index
  }));

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
          Favorite Deeds
        </Text>
        <Link href="/settings" asChild>
          <TouchableOpacity style={[styles.settingsButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <Ionicons name="settings" size={20} color="#9ca1ab" />
          </TouchableOpacity>
        </Link>
      </Animated.View>

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.statsContainer}>
            <Link href="/favorites" asChild>
              <TouchableOpacity style={[styles.fullWidthCard, styles.favoriteCard]}>
                <Text style={[styles.statNumber, { color: '#ffffff', fontFamily: 'Poppins_700Bold' }]}>
                  {favorites.length}
                </Text>
                <Text style={[styles.statLabel, { color: '#ffffff', fontFamily: 'Poppins_400Regular' }]}>
                  Favorites
                </Text>
              </TouchableOpacity>
            </Link>
            
            <TouchableOpacity 
              style={[styles.fullWidthCard, styles.completedCard]}
              onPress={() => setShowCompletedModal(true)}
            >
              <Text style={[styles.statNumber, { color: '#ffffff', fontFamily: 'Poppins_700Bold' }]}>
                {favorites.filter(fav => completedToday.includes(fav)).length}
              </Text>
              <Text style={[styles.statLabel, { color: '#ffffff', fontFamily: 'Poppins_400Regular' }]}>
                Completed
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Favorites List */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {favoriteReminders.length > 0 ? (
            favoriteReminders.map((reminder, index) => (
              <View 
                key={reminder.originalIndex} 
                style={[
                  styles.reminderCard, 
                  { 
                    backgroundColor: theme.cardBackground, 
                    borderColor: theme.border,
                    marginBottom: 16
                  }
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.headerLeft}>
                    <View style={[styles.categoryBadge, { backgroundColor: theme.border }]}> 
                      <Text style={[styles.categoryText, { color: '#6f7781', fontFamily: 'Poppins_500Medium' }]}> 
                        {reminder.category}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => toggleFavorite(reminder.originalIndex)} 
                    style={styles.favoriteButton}
                  >
                    <Ionicons 
                      name="heart" 
                      size={24} 
                      color={theme.accent} 
                      style={styles.favoriteIcon} 
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.cardContent}>
                  <Text style={[
                    styles.quoteText, 
                    { 
                      color: theme.textPrimary, 
                      fontFamily: 'Poppins_500Medium'
                    }
                  ]}> 
                    {reminder.reminder}
                  </Text>
                  
                  <View style={[styles.sourceSection, { borderTopColor: theme.border }]}> 
                    <Text style={[styles.hadithText, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}> 
                      {reminder.hadith}
                    </Text>
                    <Text style={[styles.sourceText, { color: theme.accent, fontFamily: 'Poppins_500Medium' }]}> 
                      {reminder.source}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity 
                    style={[
                      styles.actionButton, 
                      { 
                        backgroundColor: completedToday.includes(reminder.originalIndex) 
                          ? '#95d5a0' 
                          : theme.accent
                      }
                    ]} 
                    onPress={() => markAsCompleted(reminder.originalIndex)}
                    disabled={completedToday.includes(reminder.originalIndex)}
                  >
                    <Text style={[styles.buttonText, { fontFamily: 'Poppins_600SemiBold' }]}> 
                      {completedToday.includes(reminder.originalIndex) ? "✓ Completed!" : "I Did It!"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={[styles.emptyState, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.border }]}>
                <Ionicons name="heart-outline" size={48} color={theme.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
                No Favorites Yet
              </Text>
              <Text style={[styles.emptyDescription, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                Tap the heart icon on any deed to add it to your favorites
              </Text>
              <Link href="/home" asChild>
                <TouchableOpacity style={[styles.emptyButton, { backgroundColor: theme.accent }]}>
                  <Text style={[styles.emptyButtonText, { fontFamily: 'Poppins_500Medium' }]}>
                    Explore Deeds
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          )}
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
        <Link href="/progress" asChild>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="analytics" size={24} color="#9ca1ab" style={styles.navIcon} />
            <Text style={[styles.navText, { color: '#9ca1ab', fontFamily: 'Poppins_500Medium' }]}>Progress</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/profile" asChild>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="person" size={24} color="#9ca1ab" style={styles.navIcon} />
            <Text style={[styles.navText, { color: '#9ca1ab', fontFamily: 'Poppins_500Medium' }]}>Profile</Text>
          </TouchableOpacity>
        </Link>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="heart" size={24} color="#0c0c0c" style={styles.navIcon} />
          <Text style={[styles.navText, { color: '#0c0c0c', fontFamily: 'Poppins_500Medium' }]}>Favorites</Text>
        </TouchableOpacity>
      </View>

      {/* Completed Today Modal */}
      <Modal
        visible={showCompletedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCompletedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
                Completed Today
              </Text>
              <TouchableOpacity 
                onPress={() => setShowCompletedModal(false)}
                style={[styles.closeButton, { backgroundColor: theme.border }]}
              >
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {favorites.filter(fav => completedToday.includes(fav)).length > 0 ? (
                favorites.filter(fav => completedToday.includes(fav)).map((favoriteIndex) => {
                  const reminder = remindersData[favoriteIndex];
                  return (
                    <View key={favoriteIndex} style={[styles.modalItem, { borderColor: theme.border }]}>
                      <View style={[styles.modalItemCategory, { backgroundColor: theme.border }]}>
                        <Text style={[styles.modalItemCategoryText, { color: '#6f7781', fontFamily: 'Poppins_500Medium' }]}>
                          {reminder.category}
                        </Text>
                      </View>
                      <Text style={[styles.modalItemText, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                        {reminder.reminder}
                      </Text>
                      <View style={[styles.completedBadge, { backgroundColor: '#2fcc35' }]}>
                        <Ionicons name="checkmark" size={16} color="#ffffff" />
                        <Text style={[styles.completedBadgeText, { fontFamily: 'Poppins_500Medium' }]}>
                          Completed
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.modalEmptyState}>
                  <Ionicons name="checkmark-circle-outline" size={48} color={theme.textSecondary} />
                  <Text style={[styles.modalEmptyText, { color: theme.textSecondary, fontFamily: 'Poppins_500Medium' }]}>
                    No favorite deeds completed today
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
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
  statsContainer: {
    gap: 12,
  },
  fullWidthCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
    width: '100%',
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  favoriteCard: {
    backgroundColor: '#ff6b6b',
  },
  completedCard: {
    backgroundColor: '#2fcc35',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
  reminderCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    marginBottom: 16,
  },
  quoteText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  sourceSection: {
    paddingTop: 16,
    borderTopWidth: 1,
  },
  hadithText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  sourceText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cardActions: {
    alignItems: 'center',
  },
  actionButton: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 150,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    borderRadius: 20,
    padding: 40,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 0,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalItem: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  modalItemCategory: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  modalItemCategoryText: {
    fontSize: 10,
    fontWeight: '600',
  },
  modalItemText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 4,
  },
  completedBadgeText: {
    color: '#ffffff',
    fontSize: 12,
  },
  modalEmptyState: {
    alignItems: 'center',
    padding: 40,
  },
  modalEmptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
});