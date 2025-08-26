import AsyncStorage from '@react-native-async-storage/async-storage';
import { Reminder } from '../assets/Reminders';

export interface RemoteRemindersData {
  version: string;
  lastUpdated: string;
  reminders: Reminder[];
}

export class RemoteDataService {
  // GitHub raw file URL - you'll need to update this with your actual repository URL
  private static readonly REMOTE_URL = 'https://raw.githubusercontent.com/YOUR_USERNAME/dailydeeds-data/main/reminders.json';
  private static readonly LOCAL_VERSION_KEY = 'reminders_version';
  private static readonly LOCAL_DATA_KEY = 'reminders_data';
  private static readonly LAST_CHECK_KEY = 'last_remote_check';
  private static readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  /**
   * Check if we should fetch remote data
   */
  private static async shouldCheckForUpdates(): Promise<boolean> {
    try {
      const lastCheck = await AsyncStorage.getItem(this.LAST_CHECK_KEY);
      if (!lastCheck) return true;
      
      const lastCheckTime = parseInt(lastCheck);
      const now = Date.now();
      return (now - lastCheckTime) > this.CHECK_INTERVAL;
    } catch (error) {
      console.log('Error checking last update time:', error);
      return true; // Default to checking if there's an error
    }
  }

  /**
   * Fetch remote reminders data from GitHub
   */
  private static async fetchRemoteData(): Promise<RemoteRemindersData | null> {
    try {
      console.log('Fetching remote reminders data...');
      const response = await fetch(this.REMOTE_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
        },
        // Add timeout
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        console.log('Failed to fetch remote data:', response.status);
        return null;
      }

      const data: RemoteRemindersData = await response.json();
      
      // Validate the data structure
      if (!data.version || !data.reminders || !Array.isArray(data.reminders)) {
        console.log('Invalid remote data structure');
        return null;
      }

      console.log('Successfully fetched remote data, version:', data.version);
      return data;
    } catch (error) {
      console.log('Error fetching remote data:', error);
      return null;
    }
  }

  /**
   * Get the current local version
   */
  private static async getLocalVersion(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.LOCAL_VERSION_KEY);
    } catch (error) {
      console.log('Error getting local version:', error);
      return null;
    }
  }

  /**
   * Save remote data locally
   */
  private static async saveLocalData(data: RemoteRemindersData): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(this.LOCAL_VERSION_KEY, data.version),
        AsyncStorage.setItem(this.LOCAL_DATA_KEY, JSON.stringify(data.reminders)),
        AsyncStorage.setItem(this.LAST_CHECK_KEY, Date.now().toString()),
      ]);
      console.log('Saved remote data locally, version:', data.version);
    } catch (error) {
      console.log('Error saving local data:', error);
      throw error;
    }
  }

  /**
   * Get locally stored reminders data
   */
  public static async getLocalReminders(): Promise<Reminder[] | null> {
    try {
      const data = await AsyncStorage.getItem(this.LOCAL_DATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.log('Error getting local reminders:', error);
      return null;
    }
  }

  /**
   * Main method to check for and apply updates
   */
  public static async checkForUpdates(): Promise<{
    updated: boolean;
    reminders: Reminder[] | null;
    error?: string;
  }> {
    try {
      // Check if we should even try to fetch updates
      if (!(await this.shouldCheckForUpdates())) {
        console.log('Skipping remote check - too soon since last check');
        return { updated: false, reminders: null };
      }

      // Fetch remote data
      const remoteData = await this.fetchRemoteData();
      if (!remoteData) {
        // Update last check time even if fetch failed to avoid hammering the server
        await AsyncStorage.setItem(this.LAST_CHECK_KEY, Date.now().toString());
        return { 
          updated: false, 
          reminders: null, 
          error: 'Failed to fetch remote data' 
        };
      }

      // Check if we have a newer version
      const localVersion = await this.getLocalVersion();
      if (localVersion && localVersion === remoteData.version) {
        console.log('Local version is up to date:', localVersion);
        await AsyncStorage.setItem(this.LAST_CHECK_KEY, Date.now().toString());
        return { updated: false, reminders: null };
      }

      // Save the new data
      await this.saveLocalData(remoteData);
      
      console.log('Updated reminders from version', localVersion, 'to', remoteData.version);
      return { 
        updated: true, 
        reminders: remoteData.reminders 
      };

    } catch (error) {
      console.log('Error in checkForUpdates:', error);
      return { 
        updated: false, 
        reminders: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Force update from remote (ignores timing checks)
   */
  public static async forceUpdate(): Promise<{
    updated: boolean;
    reminders: Reminder[] | null;
    error?: string;
  }> {
    try {
      const remoteData = await this.fetchRemoteData();
      if (!remoteData) {
        return { 
          updated: false, 
          reminders: null, 
          error: 'Failed to fetch remote data' 
        };
      }

      await this.saveLocalData(remoteData);
      
      return { 
        updated: true, 
        reminders: remoteData.reminders 
      };
    } catch (error) {
      console.log('Error in forceUpdate:', error);
      return { 
        updated: false, 
        reminders: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Clear all local data (for testing or reset)
   */
  public static async clearLocalData(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.LOCAL_VERSION_KEY),
        AsyncStorage.removeItem(this.LOCAL_DATA_KEY),
        AsyncStorage.removeItem(this.LAST_CHECK_KEY),
      ]);
      console.log('Cleared local reminders data');
    } catch (error) {
      console.log('Error clearing local data:', error);
    }
  }
}