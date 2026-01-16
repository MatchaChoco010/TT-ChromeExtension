import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import type { UserSettings } from '@/types';

interface ThemeContextType {
  settings: UserSettings | null;
  updateSettings: (settings: UserSettings) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const result = await chrome.storage.local.get('user_settings');
      if (result.user_settings) {
        setSettings(result.user_settings as UserSettings);
      } else {
        const defaultSettings: UserSettings = {
          fontSize: 14,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          customCSS: '',
          newTabPosition: 'child',
          closeWarningThreshold: 10,
          showUnreadIndicator: true,
          autoSnapshotInterval: 0,
          childTabBehavior: 'promote',
          snapshotSubfolder: 'TT-Snapshots',
        };
        setSettings(defaultSettings);
        await chrome.runtime.sendMessage({
          type: 'SAVE_USER_SETTINGS',
          payload: { settings: defaultSettings },
        });
      }
    };

    loadSettings();

    const handleStorageChange = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes.user_settings && changes.user_settings.newValue) {
        setSettings(changes.user_settings.newValue as UserSettings);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const updateSettings = useCallback((newSettings: UserSettings) => {
    setSettings(newSettings);
    chrome.runtime.sendMessage({
      type: 'SAVE_USER_SETTINGS',
      payload: { settings: newSettings },
    });
  }, []);

  useEffect(() => {
    if (!settings) return;

    const style = document.createElement('style');
    style.id = 'vivaldi-tt-theme';

    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const vivaldiTheme = isDarkMode
      ? `
        :root {
          --vivaldi-bg-primary: #1e1e1e;
          --vivaldi-bg-secondary: #2d2d2d;
          --vivaldi-text-primary: #e0e0e0;
          --vivaldi-text-secondary: #a0a0a0;
          --vivaldi-border: #404040;
          --vivaldi-hover: #3a3a3a;
        }
        body {
          background-color: var(--vivaldi-bg-primary);
          color: var(--vivaldi-text-primary);
        }
      `
      : `
        :root {
          --vivaldi-bg-primary: #ffffff;
          --vivaldi-bg-secondary: #f5f5f5;
          --vivaldi-text-primary: #202020;
          --vivaldi-text-secondary: #606060;
          --vivaldi-border: #d0d0d0;
          --vivaldi-hover: #e8e8e8;
        }
        body {
          background-color: var(--vivaldi-bg-primary);
          color: var(--vivaldi-text-primary);
        }
      `;

    let css = `
      ${vivaldiTheme}
      :root {
        --font-size: ${settings.fontSize}px;
        --font-family: ${settings.fontFamily};
      }
      body {
        font-size: var(--font-size);
        font-family: var(--font-family);
      }
    `;

    let hasError = false;
    if (settings.customCSS) {
      try {
        const openBraces = (settings.customCSS.match(/\{/g) || []).length;
        const closeBraces = (settings.customCSS.match(/\}/g) || []).length;

        if (openBraces !== closeBraces) {
          hasError = true;
        }

        if (!hasError && /\{[^}]*[^;\s}][^}]*\}/.test(settings.customCSS)) {
          const tempStyle = document.createElement('style');
          tempStyle.textContent = settings.customCSS;
          document.head.appendChild(tempStyle);

          if (tempStyle.sheet && tempStyle.sheet.cssRules.length === 0 && settings.customCSS.trim() !== '') {
            hasError = true;
          }

          document.head.removeChild(tempStyle);
        }

        if (!hasError) {
          css += `\n${settings.customCSS}`;
        }
      } catch {
        hasError = true;
      }
    }

    style.textContent = css;

    const existingStyle = document.getElementById('vivaldi-tt-theme');
    if (existingStyle) {
      existingStyle.remove();
    }
    document.head.appendChild(style);

    const existingError = document.getElementById('vivaldi-tt-css-error');
    if (hasError) {
      if (!existingError) {
        const errorNotification = document.createElement('div');
        errorNotification.id = 'vivaldi-tt-css-error';
        errorNotification.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          background-color: #fee;
          border: 1px solid #fcc;
          padding: 10px 15px;
          border-radius: 4px;
          color: #c00;
          font-size: 12px;
          z-index: 10000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        `;
        errorNotification.textContent = 'カスタムCSSにエラーがあります。構文を確認してください。';
        document.body.appendChild(errorNotification);
      }
    } else {
      if (existingError) {
        existingError.remove();
      }
    }

    return () => {
      style.remove();
    };
  }, [settings]);

  const value = useMemo(
    () => ({ settings, updateSettings }),
    [settings, updateSettings]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export default ThemeProvider;
