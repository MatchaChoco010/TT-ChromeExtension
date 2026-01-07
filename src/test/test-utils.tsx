import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import type { UserSettings } from '@/types';

const defaultSettings: UserSettings = {
  fontSize: 14,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  customCSS: '',
  newTabPosition: 'child',
  closeWarningThreshold: 10,
  showUnreadIndicator: true,
  autoSnapshotInterval: 0,
  childTabBehavior: 'promote',
};

vi.mock('@/sidepanel/providers/ThemeProvider', () => ({
  useTheme: () => ({
    settings: defaultSettings,
    updateSettings: vi.fn(),
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, options);

export * from '@testing-library/react';
export { customRender as render };
