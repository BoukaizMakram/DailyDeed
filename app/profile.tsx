import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';

// Dynamic import to handle expo-image-picker availability
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (error) {
  console.log('expo-image-picker not available:', error);
}

interface Settings {
  notifications: boolean;
  notificationInterval: number;
  darkMode: boolean;
  showHadith: boolean;
  dailyGoal: number;
}

interface ProfileData {
  name: string;
  email: string;
  joinedDate: string;
  totalCompleted: number;
  currentStreak: number;
  bestStreak: number;
  profileImage?: string;
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

export default function Profile() {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');
  const [profileData, setProfileData] = useState<ProfileData>({
    name: 'Daily Deeds User',
    email: 'user@dailydeeds.com',
    joinedDate: new Date().toLocaleDateString(),
    totalCompleted: 0,
    currentStreak: 0,
    bestStreak: 0,
    profileImage: undefined,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(profileData.name);
  const [editedEmail, setEditedEmail] = useState(profileData.email);

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
    loadProfile();
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

  const loadProfile = async () => {
    try {
      const savedProfile = await AsyncStorage.getItem('userProfile');
      const savedProgress = await AsyncStorage.getItem('dailyProgress');
      const savedStreak = await AsyncStorage.getItem('streak');
      const savedBestStreak = await AsyncStorage.getItem('bestStreak');

      if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        setProfileData(prev => ({ ...prev, ...profile }));
        setEditedName(profile.name || 'Daily Deeds User');
        setEditedEmail(profile.email || 'user@dailydeeds.com');
      }

      if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        setProfileData(prev => ({ ...prev, totalCompleted: progress.completedDeeds?.length || 0 }));
      }

      if (savedStreak) {
        setProfileData(prev => ({ ...prev, currentStreak: parseInt(savedStreak) }));
      }

      if (savedBestStreak) {
        setProfileData(prev => ({ ...prev, bestStreak: parseInt(savedBestStreak) }));
      } else {
        // If no best streak saved, use current streak as best
        const currentStreak = savedStreak ? parseInt(savedStreak) : 0;
        setProfileData(prev => ({ ...prev, bestStreak: currentStreak }));
        await AsyncStorage.setItem('bestStreak', currentStreak.toString());
      }
    } catch (error) {
      console.log('Error loading profile:', error);
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

  const saveProfile = async () => {
    try {
      const updatedProfile = {
        ...profileData,
        name: editedName,
        email: editedEmail,
      };
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      setProfileData(updatedProfile);
      setIsEditing(false);
    } catch (error) {
      console.log('Error saving profile:', error);
    }
  };

  const cancelEdit = () => {
    setEditedName(profileData.name);
    setEditedEmail(profileData.email);
    setIsEditing(false);
  };

  const pickImage = async () => {
    if (!ImagePicker) {
      Alert.alert('Feature Unavailable', 'Image picker is not available in this environment. Please use a development build.');
      return;
    }

    // Request permission to access media library
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera roll permissions to change your profile picture.');
      return;
    }

    Alert.alert(
      'Select Image',
      'Choose how you want to select your profile picture',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Camera', onPress: takePicture },
        { text: 'Gallery', onPress: selectFromGallery },
      ]
    );
  };

  const takePicture = async () => {
    if (!ImagePicker) return;
    
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera permissions to take a picture.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const updatedProfile = { ...profileData, profileImage: result.assets[0].uri };
      setProfileData(updatedProfile);
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
    }
  };

  const selectFromGallery = async () => {
    if (!ImagePicker) return;
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const updatedProfile = { ...profileData, profileImage: result.assets[0].uri };
      setProfileData(updatedProfile);
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
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
          Profile
        </Text>
        <TouchableOpacity 
          style={[styles.editButton, { backgroundColor: '#9ca2ac' }]}
          onPress={() => isEditing ? saveProfile() : setIsEditing(true)}
        >
          <Text style={[styles.editButtonText, { color: '#ffffff', fontFamily: 'Poppins_500Medium' }]}>
            {isEditing ? "Done" : "Edit"}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
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
            <TouchableOpacity 
              style={[styles.avatarLarge, { backgroundColor: theme.border }]}
              onPress={pickImage}
            >
              {profileData.profileImage ? (
                <Image 
                  source={{ uri: profileData.profileImage }} 
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons name="person" size={40} color="#9ca1ab" />
              )}
              <View style={[styles.cameraIconOverlay, { backgroundColor: theme.accent }]}>
                <Ionicons name="camera" size={16} color="#ffffff" />
              </View>
            </TouchableOpacity>
            
            {isEditing ? (
              <View style={styles.editForm}>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.border, color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}
                  value={editedName}
                  onChangeText={setEditedName}
                  placeholder="Your name"
                  placeholderTextColor={theme.textSecondary}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: theme.border, color: theme.textPrimary, fontFamily: 'Poppins_400Regular' }]}
                  value={editedEmail}
                  onChangeText={setEditedEmail}
                  placeholder="Your email"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                />
                <View style={styles.editActions}>
                  <TouchableOpacity 
                    style={[styles.button, styles.cancelButton, { borderColor: theme.border }]}
                    onPress={cancelEdit}
                  >
                    <Text style={[styles.buttonText, { color: theme.textSecondary, fontFamily: 'Poppins_500Medium' }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.button, styles.saveButton, { backgroundColor: theme.accent }]}
                    onPress={saveProfile}
                  >
                    <Text style={[styles.buttonText, { color: '#ffffff', fontFamily: 'Poppins_500Medium' }]}>
                      Save
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: theme.textPrimary, fontFamily: 'Poppins_600SemiBold' }]}>
                  {profileData.name}
                </Text>
                <Text style={[styles.profileEmail, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                  {profileData.email}
                </Text>
                <Text style={[styles.joinedDate, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                  Joined {profileData.joinedDate}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Stats Section */}
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
            Your Progress
          </Text>
          
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <View style={[styles.statIcon, { backgroundColor: theme.accent + '20' }]}>
                <Ionicons name="checkmark-circle" size={24} color={theme.accent} />
              </View>
              <Text style={[styles.statNumber, { color: theme.textPrimary, fontFamily: 'Poppins_700Bold' }]}>
                {profileData.totalCompleted}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                Total Deeds
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <View style={[styles.statIcon, { backgroundColor: '#ff9500' + '20' }]}>
                <Ionicons name="flame" size={24} color="#ff9500" />
              </View>
              <Text style={[styles.statNumber, { color: theme.textPrimary, fontFamily: 'Poppins_700Bold' }]}>
                {profileData.currentStreak}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                Current Streak
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <View style={[styles.statIcon, { backgroundColor: '#007AFF' + '20' }]}>
                <Ionicons name="trophy" size={24} color="#007AFF" />
              </View>
              <Text style={[styles.statNumber, { color: theme.textPrimary, fontFamily: 'Poppins_700Bold' }]}>
                {profileData.bestStreak}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary, fontFamily: 'Poppins_400Regular' }]}>
                Best Streak
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Actions Section */}
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
            Quick Actions
          </Text>
          
          <View style={[styles.actionsCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <Link href="/settings" asChild>
              <TouchableOpacity style={styles.actionItem}>
                <View style={styles.actionLeft}>
                  <Ionicons name="settings" size={24} color="#9ca1ab" style={styles.actionIcon} />
                  <Text style={[styles.actionTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                    Settings
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca1ab" />
              </TouchableOpacity>
            </Link>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <TouchableOpacity style={styles.actionItem}>
              <View style={styles.actionLeft}>
                <Ionicons name="share" size={24} color="#9ca1ab" style={styles.actionIcon} />
                <Text style={[styles.actionTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                  Share Progress
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca1ab" />
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <TouchableOpacity style={styles.actionItem}>
              <View style={styles.actionLeft}>
                <Ionicons name="download" size={24} color="#9ca1ab" style={styles.actionIcon} />
                <Text style={[styles.actionTitle, { color: theme.textPrimary, fontFamily: 'Poppins_500Medium' }]}>
                  Export Data
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca1ab" />
            </TouchableOpacity>
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
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person" size={24} color="#0c0c0c" style={styles.navIcon} />
          <Text style={[styles.navText, { color: '#0c0c0c', fontFamily: 'Poppins_500Medium' }]}>Profile</Text>
        </TouchableOpacity>
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
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
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
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  cameraIconOverlay: {
    position: 'absolute',
    bottom: 4,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    marginBottom: 4,
  },
  joinedDate: {
    fontSize: 14,
  },
  editForm: {
    width: '100%',
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
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
  actionsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 16,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    marginLeft: 56,
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