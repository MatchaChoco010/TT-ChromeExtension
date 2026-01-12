import React, { useEffect, useState } from 'react';
import SettingsPanel from '@/sidepanel/components/SettingsPanel';
import { storageService } from '@/storage/StorageService';
import type { UserSettings } from '@/types';

const defaultSettings: UserSettings = {
  fontSize: 14,
  fontFamily: 'system-ui, sans-serif',
  customCSS: '',
  newTabPosition: 'child',
  closeWarningThreshold: 10,
  showUnreadIndicator: true,
  autoSnapshotInterval: 0,
  childTabBehavior: 'promote',
  snapshotSubfolder: 'TT-Snapshots',
};

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await storageService.get('user_settings');
        if (storedSettings) {
          setSettings(storedSettings);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    const unsubscribe = storageService.onChange((changes) => {
      if (changes.user_settings?.newValue) {
        setSettings(changes.user_settings.newValue as UserSettings);
      }
    });

    return unsubscribe;
  }, []);

  const handleSettingsChange = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    try {
      await storageService.set('user_settings', newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="settings-page-container min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="settings-page-container min-h-screen bg-gray-900">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <SettingsPanel
          settings={settings}
          onSettingsChange={handleSettingsChange}
        />
      </div>
    </div>
  );
};

export default SettingsPage;
