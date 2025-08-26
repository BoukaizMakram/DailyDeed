import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { Link } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';

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

export default function Settings() {
  const systemColorScheme = useColorScheme();
  const [settings, setSettings] = useState<Settings>({
    notifications: true,
    notificationInterval: 0, // disabled by default
    darkMode: systemColorScheme === 'dark',
    showHadith: true,
    dailyGoal: 5,
  });
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');
  const [isExpoGo, setIsExpoGo] = useState<boolean>(false);
  
  // Single source of truth for interval display
  const [currentInterval, setCurrentInterval] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [tempGoal, setTempGoal] = useState('5');
  
  // Stable refs for debouncing
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<Settings>(settings);

  // Dropdown options for reminder frequency
  const frequencyOptions = [
    { label: 'Off', value: 0, description: 'No reminders' },
    { label: 'Low', value: 180, description: 'Every 3 hours' },
    { label: 'Moderate', value: 60, description: 'Every hour' },
    { label: 'High', value: 30, description: 'Every 30 minutes' },
  ];

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
    loadSettings();
    // Check if running in Expo Go
    setIsExpoGo(Constants.appOwnership === 'expo');
    startAnimations();
    
    // Cleanup function to clear debounce timer
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Keep settingsRef updated
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Update current interval when settings change (but not during dropdown interaction)
  useEffect(() => {
    if (!isDropdownOpen) {
      setCurrentInterval(settings.notificationInterval);
    }
  }, [settings.notificationInterval, isDropdownOpen]);

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

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('appSettings');
      const savedTheme = await AsyncStorage.getItem('darkMode');
      
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
        setCurrentInterval(parsedSettings.notificationInterval || 0);
      }
      
      if (savedTheme !== null) {
        const darkMode = JSON.parse(savedTheme);
        setIsDarkMode(darkMode);
        setSettings(prev => ({ ...prev, darkMode }));
      }
    } catch (error) {
      console.log('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    try {
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
      await AsyncStorage.setItem('darkMode', JSON.stringify(newSettings.darkMode));
      // Don't update local state here - let the individual update functions handle it
      setSettings(newSettings);
      setIsDarkMode(newSettings.darkMode);
    } catch (error) {
      console.log('Error saving settings:', error);
    }
  };

  const updateSetting = useCallback((key: keyof Settings, value: any) => {
    // Immediately update the local state to prevent flicker
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      // Save to storage asynchronously without blocking UI
      setTimeout(() => saveSettingsAsync(newSettings), 0);
      return newSettings;
    });
    
    // Update dark mode immediately if it's the darkMode setting
    if (key === 'darkMode') {
      setIsDarkMode(value);
    }
  }, []);

  const saveSettingsAsync = useCallback(async (newSettings: Settings) => {
    try {
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
      await AsyncStorage.setItem('darkMode', JSON.stringify(newSettings.darkMode));
    } catch (error) {
      console.log('Error saving settings:', error);
    }
  }, []);

  // Memoized handlers for switches to prevent flicker
  const handleNotificationsChange = useCallback((value: boolean) => {
    updateSetting('notifications', value);
  }, [updateSetting]);

  const handleDarkModeChange = useCallback((value: boolean) => {
    updateSetting('darkMode', value);
  }, [updateSetting]);

  const handleShowHadithChange = useCallback((value: boolean) => {
    updateSetting('showHadith', value);
  }, [updateSetting]);

  const openGoalModal = () => {
    setTempGoal(settings.dailyGoal.toString());
    setIsGoalModalOpen(true);
  };

  const saveGoal = () => {
    const goalNumber = parseInt(tempGoal);
    if (goalNumber > 0 && goalNumber <= 50) {
      updateSetting('dailyGoal', goalNumber);
      setIsGoalModalOpen(false);
    } else {
      Alert.alert('Invalid Goal', 'Please enter a number between 1 and 50');
    }
  };

  const cancelGoal = () => {
    setTempGoal(settings.dailyGoal.toString());
    setIsGoalModalOpen(false);
  };

  // Handle dropdown selection
  const handleFrequencyChange = useCallback((value: number) => {
    console.log('handleFrequencyChange called with value:', value);
    setCurrentInterval(value);
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Update settings directly without relying on the effect
    const newSettings = { ...settings, notificationInterval: value };
    console.log('Saving new settings:', newSettings);
    saveSettings(newSettings);
    
    // Close dropdown with a small delay for smoother UX
    setTimeout(() => {
      setIsDropdownOpen(false);
    }, 150);
  }, [settings, saveSettings]);

  const clearData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your progress, achievements, favorites, settings, and profile data. This action cannot be undone.\n\nAre you sure you want to continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All Data',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get all storage keys used in the app
              const keysToRemove = [
                'dailyProgress',
                'favorites', 
                'streak',
                'bestStreak',
                'appSettings',
                'darkMode',
                'totalCompleted',
                'progressHistory',
                'achievements',
                'calendarProgress',
                'weeklyProgress',
                'userProfile',
                'lastActiveDate'
              ];
              
              // Remove all storage data
              await AsyncStorage.multiRemove(keysToRemove);
              
              // Clear any other remaining keys by getting all keys and removing them
              const allKeys = await AsyncStorage.getAllKeys();
              if (allKeys.length > 0) {
                await AsyncStorage.multiRemove(allKeys);
              }
              
              Alert.alert(
                'Data Cleared',
                'All app data has been successfully cleared. The app will restart to its initial state.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Reset local state to default values
                      setSettings({
                        notifications: true,
                        notificationInterval: 0,
                        darkMode: systemColorScheme === 'dark',
                        showHadith: true,
                        dailyGoal: 5,
                      });
                      setIsDarkMode(systemColorScheme === 'dark');
                      setCurrentInterval(0);
                    }
                  }
                ]
              );
            } catch (error) {
              console.log('Error clearing data:', error);
              Alert.alert(
                'Error',
                'There was an error clearing your data. Please try again or restart the app.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };

  const formatIntervalText = (minutes: number) => {
    if (minutes === 0) return 'Disabled';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
    return `${hours}h ${remainingMinutes}m`;
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

  // Use current interval for display - single source of truth
  const displayValue = currentInterval;

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
          Settings
        </Text>
        <View style={styles.placeholder} />
      </Animated.View>

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Link href="/profile" asChild>
            <TouchableOpacity style={[styles.profileCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <View style={styles.profileInfo}>
                <View style={[styles.avatar, { backgroundColor: theme.border }]}>
                  <Ionicons name="person-circle" size={24} color="#9ca1ab" style={styles.avatarText} />
                </View>
                <View style={styles.profileDetails}>
                  <Text style={[styles.profileName, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
                    Daily Deeds User
                  </Text>
                  <Text style={[styles.profileSubtitle, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                    Keep up the good work!
                  </Text>
                </View>
              </View>
              <View style={styles.chevron}>
                <Ionicons name="chevron-forward" size={24} color="#9ca1ab" style={styles.chevronText} />
              </View>
            </TouchableOpacity>
          </Link>
        </Animated.View>

        {/* App Settings */}
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
            App Settings
          </Text>
          
          <View style={[styles.settingsCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                             <Ionicons name="notifications" size={24} color="#9ca1ab" style={styles.settingIcon} />
                <Text style={[styles.settingTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                  Notifications
                </Text>
              </View>
              <Switch
                value={settings.notifications}
                onValueChange={handleNotificationsChange}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor={'#ffffff'}
              />
            </View>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                             <Ionicons name="time" size={24} color="#9ca1ab" style={styles.settingIcon} />
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                    Random Reminders
                  </Text>
                  <Text style={[styles.settingSubtitle, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                    Debug: interval={settings.notificationInterval}, current={currentInterval}
                  </Text>
                </View>
              </View>
            </View>

            {/* Notification Frequency Dropdown */}
            <View style={[styles.dropdownContainer, { backgroundColor: theme.cardBackground }]}>
              <TouchableOpacity 
                style={[styles.dropdownButton, { borderColor: theme.border }]}
                onPress={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <View style={styles.dropdownButtonContent}>
                  <Text style={[styles.dropdownButtonText, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                    {frequencyOptions.find(option => option.value === currentInterval)?.label || 'Off'}
                  </Text>
                  <Text style={[styles.dropdownButtonDescription, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                    {frequencyOptions.find(option => option.value === currentInterval)?.description || 'No reminders'}
                  </Text>
                </View>
                <Ionicons 
                  name={isDropdownOpen ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={theme.textSecondary} 
                />
              </TouchableOpacity>
              
              {isDropdownOpen && (
                <View style={[styles.dropdownMenu, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                  {frequencyOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.dropdownMenuItem,
                        { backgroundColor: currentInterval === option.value ? theme.accent + '20' : 'transparent' }
                      ]}
                      onPress={() => handleFrequencyChange(option.value)}
                    >
                      <View style={styles.dropdownMenuItemContent}>
                        <Text style={[
                          styles.dropdownMenuItemText, 
                          { 
                            color: currentInterval === option.value ? theme.accent : theme.textPrimary,
                            fontFamily: 'Poppins_500Medium'
                          }
                        ]}>
                          {option.label}
                        </Text>
                        <Text style={[
                          styles.dropdownMenuItemDescription, 
                          { 
                            color: currentInterval === option.value ? theme.accent : theme.textSecondary,
                            fontFamily: 'Poppins_400Regular'
                          }
                        ]}>
                          {option.description}
                        </Text>
                      </View>
                      {currentInterval === option.value && (
                        <Ionicons name="checkmark" size={20} color={theme.accent} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Expo Go Warning for Notifications */}
            {isExpoGo && settings.notificationInterval > 0 && (
              <View style={[styles.warningContainer, { backgroundColor: '#ffa500' + '20', borderColor: '#ffa500' }]}>
                <View style={styles.warningContent}>
                  <Ionicons name="build-outline" size={20} color="#ffa500" />
                  <Text style={[styles.warningText, { color: theme.textPrimary, fontFamily: 'Poppins_400Regular' }]}>
                    Background notifications require a development build. In-app reminders will work when the app is open.
                  </Text>
                </View>
              </View>
            )}

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="moon" size={24} color="#9ca1ab" style={styles.settingIcon} />
                <Text style={[styles.settingTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                  Dark Mode
                </Text>
              </View>
              <Switch
                value={settings.darkMode}
                onValueChange={handleDarkModeChange}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor={'#ffffff'}
              />
            </View>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="book" size={24} color="#9ca1ab" style={styles.settingIcon} />
                <Text style={[styles.settingTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                  Show Hadith
                </Text>
              </View>
              <Switch
                value={settings.showHadith}
                onValueChange={handleShowHadithChange}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor={'#ffffff'}
              />
            </View>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <TouchableOpacity style={styles.settingItem} onPress={openGoalModal}>
              <View style={styles.settingLeft}>
                <Ionicons name="flag" size={24} color="#9ca1ab" style={styles.settingIcon} />
                <Text style={[styles.settingTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                  Daily Goal
                </Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={[styles.settingValue, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                  {settings.dailyGoal} deeds
                </Text>
                <Ionicons name="chevron-forward" size={24} color="#9ca1ab" style={styles.chevronText} />
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>


        {/* About */}
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
            About Daily Deeds
          </Text>
          <View style={[styles.aboutCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={[styles.heartIcon, { backgroundColor: theme.accent }]}>
              <Ionicons name="heart" size={24} color="#ffffff" />
            </View>
            <Text style={[styles.aboutTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
              Made with Love
            </Text>
            <Text style={[styles.aboutVersion, { color: theme.accent, fontFamily: 'Poppins_500Medium' }]}>
              Version 1.0.0
            </Text>
            <Text style={[styles.aboutDescription, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
              I created Daily Deeds for myself and my beloved Wiame, with the hope that every good deed you perform through this app will be written in both our scales of good deeds. 
            </Text>
            <Text style={[styles.aboutSubtext, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
              May Allah reward you for every act of kindness, and may we all benefit from the blessings of these shared good deeds. Together, we can make the world a better place, one deed at a time.
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
                                             <Ionicons name="settings" size={24} color="#0c0c0c" style={styles.navIcon} />
                       <Text style={[styles.navText, { color: '#0c0c0c', fontFamily: 'Poppins_500Medium' }]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Daily Goal Modal */}
      <Modal
        visible={isGoalModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelGoal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
              Set Daily Goal
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
              How many good deeds do you want to complete daily?
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.border, color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}
              value={tempGoal}
              onChangeText={setTempGoal}
              placeholder="Enter number (1-50)"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              maxLength={2}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelModalButton, { borderColor: theme.border }]}
                onPress={cancelGoal}
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary, fontFamily: 'Poppins_500Medium' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveModalButton, { backgroundColor: theme.accent }]}
                onPress={saveGoal}
              >
                <Text style={[styles.modalButtonText, { color: '#ffffff', fontFamily: 'Poppins_500Medium' }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
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
  profileCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileSubtitle: {
    fontSize: 14,
  },
  settingsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    fontSize: 20,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  dropdownContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 60,
  },
  dropdownButtonContent: {
    flex: 1,
  },
  dropdownButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  dropdownButtonDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  dropdownMenu: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
  },
  dropdownMenuItemContent: {
    flex: 1,
  },
  dropdownMenuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  dropdownMenuItemDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 16,
    marginRight: 8,
  },
  chevron: {
    padding: 4,
  },
  chevronText: {
    fontSize: 20,
    fontWeight: '300',
  },
  separator: {
    height: 1,
    marginLeft: 56,
  },
  dangerText: {
    color: '#ff6b6b',
  },
  aboutCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  heartIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  aboutTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  aboutVersion: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
  },
  aboutDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  aboutSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  aboutSignature: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
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
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: 'center',
    width: '100%',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelModalButton: {
    borderWidth: 1,
  },
  saveModalButton: {
    // backgroundColor set dynamically
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  warningContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginVertical: 8,
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
}); 