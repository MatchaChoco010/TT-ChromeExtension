import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@/sidepanel/providers/ThemeProvider';
import SettingsPanel from './SettingsPanel';
import TreeNode from './TreeNode';
import type { UserSettings, TabNode, TabInfo, StorageChanges } from '@/types';
import type { StorageChangeListener } from '@/test/test-types';

describe('UI/UXカスタマイズのインテグレーションテスト', () => {
  let mockGet: ReturnType<typeof vi.fn>;
  let mockSet: ReturnType<typeof vi.fn>;
  let onChangedListeners: StorageChangeListener[] = [];

  beforeEach(() => {
    onChangedListeners = [];

    mockGet = vi.fn();
    mockSet = vi.fn();

    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: mockGet,
          set: mockSet,
        },
        onChanged: {
          addListener: vi.fn((listener: StorageChangeListener) => {
            onChangedListeners.push(listener);
          }),
          removeListener: vi.fn((listener: StorageChangeListener) => {
            onChangedListeners = onChangedListeners.filter((l) => l !== listener);
          }),
        },
      },
    });

    mockSet.mockImplementation(async (items: Record<string, unknown>) => {
      const changes: StorageChanges = {};
      for (const key in items) {
        changes[key] = { oldValue: undefined, newValue: items[key] };
      }
      onChangedListeners.forEach((listener) => listener(changes, 'local'));
      return Promise.resolve();
    });

    const existingStyle = document.getElementById('vivaldi-tt-theme');
    if (existingStyle) {
      existingStyle.remove();
    }

    const existingError = document.getElementById('vivaldi-tt-css-error');
    if (existingError) {
      existingError.remove();
    }

    mockGet.mockClear();
    mockSet.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('フォントサイズ変更がすべてのタブアイテムに適用される', () => {
    it('should apply font size changes to all tab items in the side panel', async () => {
      const initialSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      mockGet.mockResolvedValue({
        user_settings: initialSettings,
      });

      const TestSidePanelWithTabs = () => {
        const { settings, updateSettings } = useTheme();

        const mockTabs: Array<{ node: TabNode; tab: TabInfo }> = [
          {
            node: {
              id: 'node-1',
              tabId: 1,
              parentId: null,
              children: [],
              isExpanded: true,
              depth: 0,
            },
            tab: {
              id: 1,
              title: 'タブアイテム1',
              url: 'https://example.com/1',
              favIconUrl: undefined,
              status: 'complete' as const,
            },
          },
          {
            node: {
              id: 'node-2',
              tabId: 2,
              parentId: null,
              children: [],
              isExpanded: true,
              depth: 0,
            },
            tab: {
              id: 2,
              title: 'タブアイテム2',
              url: 'https://example.com/2',
              favIconUrl: undefined,
              status: 'complete' as const,
            },
          },
          {
            node: {
              id: 'node-3',
              tabId: 3,
              parentId: null,
              children: [],
              isExpanded: true,
              depth: 0,
            },
            tab: {
              id: 3,
              title: 'タブアイテム3',
              url: 'https://example.com/3',
              favIconUrl: undefined,
              status: 'complete' as const,
            },
          },
        ];

        return (
          <div>
            {settings && (
              <>
                <SettingsPanel
                  settings={settings}
                  onSettingsChange={updateSettings}
                />
                <div className="tab-tree" data-testid="tab-tree">
                  {mockTabs.map(({ node, tab }) => (
                    <TreeNode
                      key={node.id}
                      node={node}
                      tab={tab}
                      isUnread={false}
                      isActive={false}
                      onClose={vi.fn()}
                      onActivate={vi.fn()}
                      onToggle={vi.fn()}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestSidePanelWithTabs />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/フォントサイズ/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        const styleElement = document.getElementById('vivaldi-tt-theme');
        expect(styleElement).toBeTruthy();
        expect(styleElement?.textContent).toContain('--font-size: 14px');
      });

      const fontSizeInput = screen.getByLabelText(/フォントサイズ/i);
      fireEvent.change(fontSizeInput, { target: { value: '18' } });

      await waitFor(
        () => {
          const styleElement = document.getElementById('vivaldi-tt-theme');
          expect(styleElement?.textContent).toContain('--font-size: 18px');
        },
        { timeout: 2000 }
      );

      expect(screen.getByText('タブアイテム1')).toBeInTheDocument();
      expect(screen.getByText('タブアイテム2')).toBeInTheDocument();
      expect(screen.getByText('タブアイテム3')).toBeInTheDocument();

      await waitFor(() => {
        const styleElement = document.getElementById('vivaldi-tt-theme');
        expect(styleElement?.textContent).toContain('font-size: var(--font-size)');
      });
    });

    it('should update font size for all tab items when using preset buttons', async () => {
      const initialSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      mockGet.mockResolvedValue({
        user_settings: initialSettings,
      });

      const TestComponent = () => {
        const { settings, updateSettings } = useTheme();

        return (
          <div>
            {settings && (
              <>
                <SettingsPanel
                  settings={settings}
                  onSettingsChange={updateSettings}
                />
                <div className="tab-items">
                  <div className="tab-item">タブ1</div>
                  <div className="tab-item">タブ2</div>
                  <div className="tab-item">タブ3</div>
                </div>
              </>
            )}
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('小')).toBeInTheDocument();
      });

      const largeButton = screen.getByText('大');
      fireEvent.click(largeButton);

      await waitFor(
        () => {
          const styleElement = document.getElementById('vivaldi-tt-theme');
          expect(styleElement?.textContent).toContain('--font-size: 16px');
        },
        { timeout: 2000 }
      );

      expect(screen.getByText('タブ1')).toBeInTheDocument();
      expect(screen.getByText('タブ2')).toBeInTheDocument();
      expect(screen.getByText('タブ3')).toBeInTheDocument();
    });
  });

  describe('カスタムCSSが適用されてスタイルがオーバーライドされる', () => {
    it('should apply custom CSS and override default styles', async () => {
      const customCSS = `
        .tab-item {
          background-color: lightblue;
          color: darkblue;
          padding: 10px;
        }
        .settings-panel {
          border: 2px solid red;
        }
      `;

      const settingsWithCustomCSS: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: customCSS,
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      mockGet.mockResolvedValue({
        user_settings: settingsWithCustomCSS,
      });

      const TestComponent = () => {
        const { settings } = useTheme();

        return (
          <div>
            {settings && (
              <>
                <div className="settings-panel">Settings</div>
                <div className="tab-item">Custom Styled Tab</div>
              </>
            )}
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(
        () => {
          const styleElement = document.getElementById('vivaldi-tt-theme');
          expect(styleElement).toBeTruthy();
          expect(styleElement?.textContent).toContain('.tab-item');
          expect(styleElement?.textContent).toContain('background-color: lightblue');
          expect(styleElement?.textContent).toContain('color: darkblue');
          expect(styleElement?.textContent).toContain('.settings-panel');
          expect(styleElement?.textContent).toContain('border: 2px solid red');
        },
        { timeout: 2000 }
      );

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Custom Styled Tab')).toBeInTheDocument();
    });

    it('should override default font styles with custom CSS', async () => {
      const customCSS = `
        body {
          font-size: 20px !important;
          font-family: 'Courier New', monospace !important;
        }
      `;

      const settingsWithCustomCSS: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: customCSS,
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      mockGet.mockResolvedValue({
        user_settings: settingsWithCustomCSS,
      });

      const TestComponent = () => {
        const { settings } = useTheme();

        return (
          <div>
            {settings && (
              <div className="content">
                <p>Test Content</p>
              </div>
            )}
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(
        () => {
          const styleElement = document.getElementById('vivaldi-tt-theme');
          expect(styleElement).toBeTruthy();
          expect(styleElement?.textContent).toContain('--font-size: 14px');
          expect(styleElement?.textContent).toContain('--font-family: system-ui');
          expect(styleElement?.textContent).toContain('font-size: 20px !important');
          expect(styleElement?.textContent).toContain(
            "font-family: 'Courier New', monospace !important"
          );
        },
        { timeout: 2000 }
      );
    });

    it('should allow complex custom CSS with multiple selectors and rules', async () => {
      const complexCustomCSS = `
        /* タブツリーのスタイル */
        .tab-tree {
          background: linear-gradient(to bottom, #f0f0f0, #e0e0e0);
          border-radius: 8px;
          padding: 16px;
        }

        /* アクティブなタブ */
        .tab-item.active {
          background-color: #007bff;
          color: white;
          font-weight: bold;
        }

        /* 未読タブ */
        .tab-item.unread::before {
          content: "●";
          color: red;
          margin-right: 5px;
        }

        /* ホバー時の効果 */
        .tab-item:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          transform: translateY(-2px);
          transition: all 0.2s ease;
        }
      `;

      const settingsWithComplexCSS: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: complexCustomCSS,
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      mockGet.mockResolvedValue({
        user_settings: settingsWithComplexCSS,
      });

      render(
        <ThemeProvider>
          <div>Test</div>
        </ThemeProvider>
      );

      await waitFor(
        () => {
          const styleElement = document.getElementById('vivaldi-tt-theme');
          expect(styleElement).toBeTruthy();
          expect(styleElement?.textContent).toContain('.tab-tree');
          expect(styleElement?.textContent).toContain('linear-gradient');
          expect(styleElement?.textContent).toContain('.tab-item.active');
          expect(styleElement?.textContent).toContain('.tab-item.unread::before');
          expect(styleElement?.textContent).toContain('.tab-item:hover');
          expect(styleElement?.textContent).toContain('transform: translateY(-2px)');
        },
        { timeout: 2000 }
      );
    });

    it('should update custom CSS dynamically when settings change', async () => {
      const initialSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '.old { color: red; }',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      mockGet.mockResolvedValue({
        user_settings: initialSettings,
      });

      const TestComponent = () => {
        const { settings, updateSettings } = useTheme();

        return (
          <div>
            {settings && (
              <>
                <SettingsPanel
                  settings={settings}
                  onSettingsChange={updateSettings}
                />
                <div className="content">Content</div>
              </>
            )}
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        const styleElement = document.getElementById('vivaldi-tt-theme');
        expect(styleElement?.textContent).toContain('.old { color: red; }');
      });

      const customCSSTextarea = screen.getByLabelText(/カスタムCSS/i);
      fireEvent.change(customCSSTextarea, {
        target: { value: '.new { color: blue; font-size: 18px; }' },
      });

      await waitFor(
        () => {
          const styleElement = document.getElementById('vivaldi-tt-theme');
          expect(styleElement?.textContent).toContain('.new { color: blue; font-size: 18px; }');
          expect(styleElement?.textContent).not.toContain('.old { color: red; }');
        },
        { timeout: 2000 }
      );
    });
  });

  describe('統合テスト: フォントサイズとカスタムCSSの同時適用', () => {
    it('should apply both font size settings and custom CSS simultaneously', async () => {
      const settingsWithBoth: UserSettings = {
        fontSize: 18,
        fontFamily: 'Georgia, serif',
        customCSS: '.custom { background: yellow; }',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      mockGet.mockResolvedValue({
        user_settings: settingsWithBoth,
      });

      const TestComponent = () => {
        const { settings } = useTheme();

        return (
          <div>
            {settings && (
              <>
                <div className="tab-item">Tab with custom styles</div>
                <div className="custom">Custom element</div>
              </>
            )}
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(
        () => {
          const styleElement = document.getElementById('vivaldi-tt-theme');
          expect(styleElement).toBeTruthy();
          expect(styleElement?.textContent).toContain('--font-size: 18px');
          expect(styleElement?.textContent).toContain('--font-family: Georgia, serif');
          expect(styleElement?.textContent).toContain('.custom { background: yellow; }');
        },
        { timeout: 2000 }
      );
    });
  });
});
