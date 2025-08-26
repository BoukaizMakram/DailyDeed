import { Reminder, defaultRemindersData } from '../assets/Reminders';
import { RemoteDataService } from './RemoteDataService';

export class ReminderManager {
  private static currentReminders: Reminder[] = defaultRemindersData.reminders;
  private static isInitialized = false;

  /**
   * Initialize the reminder system - call this on app startup
   */
  public static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing ReminderManager...');
      
      // First, try to load any locally stored reminders from previous updates
      const localReminders = await RemoteDataService.getLocalReminders();
      if (localReminders && localReminders.length > 0) {
        console.log('Using locally stored reminders from previous update');
        this.currentReminders = localReminders;
      } else {
        console.log('Using default reminders');
        this.currentReminders = defaultRemindersData.reminders;
      }

      // Then check for updates in the background (non-blocking)
      this.checkForUpdatesInBackground();
      
      this.isInitialized = true;
    } catch (error) {
      console.log('Error initializing ReminderManager:', error);
      // Fallback to default reminders if anything goes wrong
      this.currentReminders = defaultRemindersData.reminders;
      this.isInitialized = true;
    }
  }

  /**
   * Check for updates in the background without blocking the UI
   */
  private static async checkForUpdatesInBackground(): Promise<void> {
    try {
      console.log('Checking for remote updates...');
      const updateResult = await RemoteDataService.checkForUpdates();
      
      if (updateResult.updated && updateResult.reminders) {
        console.log('Successfully updated reminders from remote source');
        this.currentReminders = updateResult.reminders;
      } else if (updateResult.error) {
        console.log('Remote update failed, continuing with current reminders:', updateResult.error);
      } else {
        console.log('No updates available, continuing with current reminders');
      }
    } catch (error) {
      console.log('Background update check failed:', error);
      // Continue with current reminders - no action needed
    }
  }

  /**
   * Get current reminders (with fallback to default if needed)
   */
  public static async getReminders(): Promise<Reminder[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Always ensure we have some reminders
    if (!this.currentReminders || this.currentReminders.length === 0) {
      console.log('No current reminders found, falling back to defaults');
      this.currentReminders = defaultRemindersData.reminders;
    }

    return this.currentReminders;
  }

  /**
   * Get a random reminder from the current set
   */
  public static async getRandomReminder(): Promise<Reminder> {
    const reminders = await this.getReminders();
    const randomIndex = Math.floor(Math.random() * reminders.length);
    return reminders[randomIndex];
  }

  /**
   * Get reminders by category
   */
  public static async getRemindersByCategory(category: string): Promise<Reminder[]> {
    const reminders = await this.getReminders();
    return reminders.filter(reminder => 
      reminder.category.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Get all available categories
   */
  public static async getCategories(): Promise<string[]> {
    const reminders = await this.getReminders();
    const categories = [...new Set(reminders.map(r => r.category))];
    return categories.sort();
  }

  /**
   * Force check for updates (for manual refresh)
   */
  public static async forceUpdate(): Promise<{
    success: boolean;
    message: string;
    newCount?: number;
  }> {
    try {
      console.log('Forcing remote update check...');
      const updateResult = await RemoteDataService.forceUpdate();
      
      if (updateResult.updated && updateResult.reminders) {
        const oldCount = this.currentReminders.length;
        this.currentReminders = updateResult.reminders;
        return {
          success: true,
          message: 'Successfully updated reminders!',
          newCount: updateResult.reminders.length
        };
      } else if (updateResult.error) {
        return {
          success: false,
          message: `Update failed: ${updateResult.error}`
        };
      } else {
        return {
          success: true,
          message: 'Your reminders are already up to date!'
        };
      }
    } catch (error) {
      console.log('Force update failed:', error);
      return {
        success: false,
        message: 'Failed to check for updates. Please try again later.'
      };
    }
  }

  /**
   * Reset to default reminders (for testing or reset)
   */
  public static async resetToDefaults(): Promise<void> {
    try {
      await RemoteDataService.clearLocalData();
      this.currentReminders = defaultRemindersData.reminders;
      console.log('Reset reminders to defaults');
    } catch (error) {
      console.log('Error resetting reminders:', error);
    }
  }

  /**
   * Get current reminders count and version info
   */
  public static async getStatus(): Promise<{
    count: number;
    version: string;
    source: 'local' | 'remote' | 'default';
  }> {
    await this.initialize();
    
    const localReminders = await RemoteDataService.getLocalReminders();
    
    return {
      count: this.currentReminders.length,
      version: defaultRemindersData.version, // This would need to be updated for remote versions
      source: localReminders ? 'remote' : 'default'
    };
  }
}