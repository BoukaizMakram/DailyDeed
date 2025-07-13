import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, useColorScheme, Animated } from 'react-native';
import { Link } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';

interface Settings {
  notifications: boolean;
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
    darkMode: systemColorScheme === 'dark',
    showHadith: true,
    dailyGoal: 5,
  });
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');

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

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('appSettings');
      const savedTheme = await AsyncStorage.getItem('darkMode');
      
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
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
      setSettings(newSettings);
      setIsDarkMode(newSettings.darkMode);
    } catch (error) {
      console.log('Error saving settings:', error);
    }
  };

  const updateSetting = (key: keyof Settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  const clearData = async () => {
    try {
      await AsyncStorage.multiRemove(['dailyProgress', 'favorites', 'streak']);
      alert('All data cleared successfully!');
    } catch (error) {
      console.log('Error clearing data:', error);
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
          <View style={[styles.profileCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
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
            <TouchableOpacity style={styles.chevron}>
              <Ionicons name="chevron-forward" size={24} color="#9ca1ab" style={styles.chevronText} />
            </TouchableOpacity>
          </View>
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
                onValueChange={(value) => updateSetting('notifications', value)}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor={'#ffffff'}
              />
            </View>

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
                onValueChange={(value) => updateSetting('darkMode', value)}
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
                onValueChange={(value) => updateSetting('showHadith', value)}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor={'#ffffff'}
              />
            </View>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <TouchableOpacity style={styles.settingItem}>
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

        {/* Data & Privacy */}
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
            Data & Privacy
          </Text>
          
          <View style={[styles.settingsCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                                 <Ionicons name="analytics" size={24} color="#9ca1ab" style={styles.settingIcon} />
                <Text style={[styles.settingTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                  View Progress
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#9ca1ab" style={styles.chevronText} />
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                                 <Ionicons name="download" size={24} color="#9ca1ab" style={styles.settingIcon} />
                <Text style={[styles.settingTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                  Export Data
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#9ca1ab" style={styles.chevronText} />
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <TouchableOpacity style={styles.settingItem} onPress={clearData}>
              <View style={styles.settingLeft}>
                                 <Ionicons name="trash" size={24} color="#9ca1ab" style={styles.settingIcon} />
                <Text style={[styles.settingTitle, styles.dangerText, { fontFamily: 'Poppins_500Medium' }]}>
                  Clear All Data
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#9ca1ab" style={styles.chevronText} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Support */}
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
            Support
          </Text>
          
          <View style={[styles.settingsCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                                 <Ionicons name="help-circle" size={24} color="#9ca1ab" style={styles.settingIcon} />
                <Text style={[styles.settingTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                  Help & FAQ
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#9ca1ab" style={styles.chevronText} />
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                                 <Ionicons name="mail" size={24} color="#9ca1ab" style={styles.settingIcon} />
                <Text style={[styles.settingTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                  Contact Us
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#9ca1ab" style={styles.chevronText} />
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                                 <Ionicons name="star" size={24} color="#9ca1ab" style={styles.settingIcon} />
                <Text style={[styles.settingTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                  Rate App
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#9ca1ab" style={styles.chevronText} />
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
        <Link href="/home" asChild>
          <TouchableOpacity style={styles.navItem}>
                         <Ionicons name="shuffle" size={24} color="#9ca1ab" style={styles.navIcon} />
                          <Text style={[styles.navText, { color: '#9ca1ab', fontFamily: 'Poppins_500Medium' }]}>Random</Text>
          </TouchableOpacity>
        </Link>
        <TouchableOpacity style={styles.navItem}>
                                             <Ionicons name="settings" size={24} color="#0c0c0c" style={styles.navIcon} />
                       <Text style={[styles.navText, { color: '#0c0c0c', fontFamily: 'Poppins_500Medium' }]}>Settings</Text>
        </TouchableOpacity>
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
}); 