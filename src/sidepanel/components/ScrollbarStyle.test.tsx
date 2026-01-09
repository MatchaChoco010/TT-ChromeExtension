import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SidePanelRoot from './SidePanelRoot';
import { chromeMock } from '@/test/chrome-mock';

beforeEach(() => {
  vi.clearAllMocks();
  chromeMock.clearAllListeners();

  chromeMock.runtime.sendMessage.mockImplementation(() => {
    return Promise.resolve({
      state: {
        nodes: {},
        views: [{ id: 'default', name: 'Default View', iconUrl: null }],
        currentViewId: 'default',
        windowId: 1,
      },
    });
  });
});

describe('スクロールバースタイル改善', () => {
  describe('スクロールバーのスタイルが適用されること', () => {
    it('SidePanelRootコンテナにカスタムスクロールバークラスが適用されること', async () => {
      render(<SidePanelRoot />);

      await waitFor(() => {
        const sidePanelRoot = screen.getByTestId('side-panel-root');
        expect(sidePanelRoot.classList.contains('custom-scrollbar')).toBe(true);
      });
    });

    it('タブツリーコンテナにカスタムスクロールバークラスが適用されること', async () => {
      render(<SidePanelRoot />);

      await waitFor(() => {
        const tabTreeRoot = screen.getByTestId('tab-tree-root');
        expect(tabTreeRoot.classList.contains('custom-scrollbar')).toBe(true);
      }, { timeout: 3000 });
    });
  });
});
