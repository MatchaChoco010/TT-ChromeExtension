/**
 * DragSessionManager Unit Tests
 *
 * DragSessionManagerのユニットテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DragSessionManager } from './drag-session-manager';
import type { TabNode } from '@/types';

// Mock chrome APIs
const mockChrome: {
  alarms: {
    create: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    onAlarm: {
      addListener: ReturnType<typeof vi.fn>;
    };
  };
  tabs: {
    move: ReturnType<typeof vi.fn>;
  };
  windows: {
    update: ReturnType<typeof vi.fn>;
  };
} = {
  alarms: {
    create: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    move: vi.fn(),
  },
  windows: {
    update: vi.fn().mockResolvedValue(undefined),
  },
};

vi.stubGlobal('chrome', mockChrome);

describe('DragSessionManager', () => {
  let manager: DragSessionManager;
  const mockTreeData: TabNode[] = [
    {
      id: 'node-1',
      tabId: 1,
      parentId: null,
      children: [],
      isExpanded: true,
      depth: 0,
      viewId: 'default',
    },
  ];

  beforeEach(() => {
    manager = new DragSessionManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    manager.stopTimeoutCheck();
  });

  describe('startSession', () => {
    it('should create a new drag session', async () => {
      const session = await manager.startSession(1, 100, mockTreeData);

      expect(session).toBeDefined();
      expect(session.tabId).toBe(1);
      expect(session.sourceWindowId).toBe(100);
      expect(session.currentWindowId).toBe(100);
      expect(session.state).toBe('dragging_local');
      expect(session.treeData).toEqual(mockTreeData);
      expect(session.isLocked).toBe(false);
      expect(session.sessionId).toBeDefined();
    });

    it('should end existing session when starting a new one', async () => {
      const session1 = await manager.startSession(1, 100, mockTreeData);
      const session2 = await manager.startSession(2, 200, mockTreeData);

      expect(session2.sessionId).not.toBe(session1.sessionId);
      expect(session2.tabId).toBe(2);
      expect(session2.sourceWindowId).toBe(200);
    });

    it('should create keep-alive alarm', async () => {
      await manager.startSession(1, 100, mockTreeData);

      expect(mockChrome.alarms.create).toHaveBeenCalledWith(
        'drag-session-keep-alive',
        { periodInMinutes: 0.4 },
      );
    });
  });

  describe('getSession', () => {
    it('should return null when no session exists', async () => {
      const session = await manager.getSession();
      expect(session).toBeNull();
    });

    it('should return current session', async () => {
      await manager.startSession(1, 100, mockTreeData);
      const session = await manager.getSession();

      expect(session).toBeDefined();
      expect(session?.tabId).toBe(1);
    });
  });

  describe('getSessionImmediate', () => {
    it('should return null when no session exists', () => {
      const session = manager.getSessionImmediate();
      expect(session).toBeNull();
    });

    it('should return current session immediately', async () => {
      await manager.startSession(1, 100, mockTreeData);
      const session = manager.getSessionImmediate();

      expect(session).toBeDefined();
      expect(session?.tabId).toBe(1);
    });
  });

  describe('endSession', () => {
    it('should clear the session', async () => {
      await manager.startSession(1, 100, mockTreeData);
      await manager.endSession('TEST_REASON');

      const session = await manager.getSession();
      expect(session).toBeNull();
    });

    it('should clear keep-alive alarm', async () => {
      await manager.startSession(1, 100, mockTreeData);
      await manager.endSession();

      expect(mockChrome.alarms.clear).toHaveBeenCalledWith(
        'drag-session-keep-alive',
      );
    });

    it('should do nothing if no session exists', async () => {
      await manager.endSession('TEST_REASON');
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('updateSessionState', () => {
    it('should update session state', async () => {
      await manager.startSession(1, 100, mockTreeData);
      manager.updateSessionState('dragging_cross_window');

      const session = await manager.getSession();
      expect(session?.state).toBe('dragging_cross_window');
    });

    it('should update timestamp when state changes', async () => {
      const session = await manager.startSession(1, 100, mockTreeData);
      const originalUpdatedAt = session.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      manager.updateSessionState('dragging_cross_window');

      const updatedSession = await manager.getSession();
      expect(updatedSession?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });

    it('should do nothing if no session exists', () => {
      manager.updateSessionState('dragging_cross_window');
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('beginCrossWindowMove', () => {
    beforeEach(() => {
      mockChrome.tabs.move.mockResolvedValue({});
    });

    it('should throw if no session exists', async () => {
      await expect(manager.beginCrossWindowMove(200)).rejects.toThrow(
        'SESSION_NOT_FOUND',
      );
    });

    it('should throw if session is locked', async () => {
      await manager.startSession(1, 100, mockTreeData);

      // Manually lock the session for testing
      const session = manager.getSessionImmediate();
      if (session) {
        session.isLocked = true;
      }

      await expect(manager.beginCrossWindowMove(200)).rejects.toThrow(
        'SESSION_LOCKED',
      );
    });

    it('should throw if state transition is invalid', async () => {
      await manager.startSession(1, 100, mockTreeData);
      manager.updateSessionState('dropped_local');

      await expect(manager.beginCrossWindowMove(200)).rejects.toThrow(
        'INVALID_STATE_TRANSITION',
      );
    });

    it('should move tab and update session state on success', async () => {
      await manager.startSession(1, 100, mockTreeData);
      await manager.beginCrossWindowMove(200);

      expect(mockChrome.tabs.move).toHaveBeenCalledWith(1, {
        windowId: 200,
        index: -1,
      });

      const session = await manager.getSession();
      expect(session?.currentWindowId).toBe(200);
      expect(session?.state).toBe('dragging_cross_window');
      expect(session?.isLocked).toBe(false);
    });

    it('should revert state on move failure', async () => {
      mockChrome.tabs.move.mockRejectedValue(new Error('Move failed'));

      await manager.startSession(1, 100, mockTreeData);

      await expect(manager.beginCrossWindowMove(200)).rejects.toThrow(
        'Move failed',
      );

      const session = await manager.getSession();
      expect(session?.state).toBe('dragging_local');
      expect(session?.currentWindowId).toBe(100);
      expect(session?.isLocked).toBe(false);
    });

    it('should allow cross-window move from dragging_cross_window state', async () => {
      await manager.startSession(1, 100, mockTreeData);
      await manager.beginCrossWindowMove(200);

      // Move to another window
      await manager.beginCrossWindowMove(300);

      const session = await manager.getSession();
      expect(session?.currentWindowId).toBe(300);
      expect(session?.state).toBe('dragging_cross_window');
    });
  });

  describe('handleWindowRemoved', () => {
    it('should end session if current window is removed', async () => {
      await manager.startSession(1, 100, mockTreeData);
      manager.handleWindowRemoved(100);

      // Wait for async endSession to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      const session = await manager.getSession();
      expect(session).toBeNull();
    });

    it('should not end session if different window is removed', async () => {
      await manager.startSession(1, 100, mockTreeData);
      manager.handleWindowRemoved(200);

      const session = await manager.getSession();
      expect(session).toBeDefined();
    });

    it('should do nothing if no session exists', () => {
      manager.handleWindowRemoved(100);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('handleTabRemoved', () => {
    it('should end session if dragged tab is removed', async () => {
      await manager.startSession(1, 100, mockTreeData);
      manager.handleTabRemoved(1);

      // Wait for async endSession to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      const session = await manager.getSession();
      expect(session).toBeNull();
    });

    it('should not end session if different tab is removed', async () => {
      await manager.startSession(1, 100, mockTreeData);
      manager.handleTabRemoved(2);

      const session = await manager.getSession();
      expect(session).toBeDefined();
    });

    it('should do nothing if no session exists', () => {
      manager.handleTabRemoved(1);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('handleAlarm', () => {
    it('should keep session alive on keep-alive alarm', async () => {
      await manager.startSession(1, 100, mockTreeData);

      manager.handleAlarm({ name: 'drag-session-keep-alive' } as chrome.alarms.Alarm);

      // Session should still exist
      const session = await manager.getSession();
      expect(session).toBeDefined();
    });

    it('should clear alarm if no session exists', () => {
      manager.handleAlarm({ name: 'drag-session-keep-alive' } as chrome.alarms.Alarm);

      expect(mockChrome.alarms.clear).toHaveBeenCalledWith(
        'drag-session-keep-alive',
      );
    });

    it('should ignore other alarms', async () => {
      await manager.startSession(1, 100, mockTreeData);

      manager.handleAlarm({ name: 'other-alarm' } as chrome.alarms.Alarm);

      // Should not throw or affect session
      const session = await manager.getSession();
      expect(session).toBeDefined();
    });
  });

  describe('timeout handling', () => {
    it('should start and stop timeout check', () => {
      manager.startTimeoutCheck();
      manager.stopTimeoutCheck();
      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle multiple start calls', () => {
      manager.startTimeoutCheck();
      manager.startTimeoutCheck();
      manager.stopTimeoutCheck();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('notifyDragOut', () => {
    it('should set isOutsideTree to true when called during active session', async () => {
      await manager.startSession(1, 100, mockTreeData);
      manager.notifyDragOut();

      const session = manager.getSessionImmediate();
      expect(session?.isOutsideTree).toBe(true);
    });

    it('should do nothing if no session exists', () => {
      manager.notifyDragOut();
      // Should not throw
      expect(true).toBe(true);
    });

    it('should update timestamp when called', async () => {
      const session = await manager.startSession(1, 100, mockTreeData);
      const originalUpdatedAt = session.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      manager.notifyDragOut();

      const updatedSession = manager.getSessionImmediate();
      expect(updatedSession?.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });
  });

  describe('notifyTreeViewHover', () => {
    it('should update currentHoverWindowId when hovering different window', async () => {
      await manager.startSession(1, 100, mockTreeData);
      await manager.notifyTreeViewHover(200);

      const session = manager.getSessionImmediate();
      expect(session?.currentHoverWindowId).toBe(200);
    });

    it('should call chrome.windows.update to focus the target window', async () => {
      await manager.startSession(1, 100, mockTreeData);
      await manager.notifyTreeViewHover(200);

      expect(mockChrome.windows.update).toHaveBeenCalledWith(200, { focused: true });
    });

    it('should not call chrome.windows.update if same window is already recorded', async () => {
      await manager.startSession(1, 100, mockTreeData);
      await manager.notifyTreeViewHover(200);
      vi.clearAllMocks();

      await manager.notifyTreeViewHover(200);

      expect(mockChrome.windows.update).not.toHaveBeenCalled();
    });

    it('should set isOutsideTree to false when hovering tree view', async () => {
      await manager.startSession(1, 100, mockTreeData);
      manager.notifyDragOut(); // First, mark as outside
      expect(manager.getSessionImmediate()?.isOutsideTree).toBe(true);

      await manager.notifyTreeViewHover(200);

      expect(manager.getSessionImmediate()?.isOutsideTree).toBe(false);
    });

    it('should do nothing if no session exists', async () => {
      await manager.notifyTreeViewHover(200);
      // Should not throw
      expect(mockChrome.windows.update).not.toHaveBeenCalled();
    });

    it('should allow hovering source window without focus change', async () => {
      await manager.startSession(1, 100, mockTreeData);
      await manager.notifyTreeViewHover(100); // Same as source window

      // Should still update hover window ID
      expect(manager.getSessionImmediate()?.currentHoverWindowId).toBe(100);
    });
  });

  describe('getSession with lock waiting', () => {
    it('should wait for lock to be released', async () => {
      await manager.startSession(1, 100, mockTreeData);

      // Lock the session
      const session = manager.getSessionImmediate();
      if (session) {
        session.isLocked = true;
      }

      // Start a getSession call that will wait
      const getSessionPromise = manager.getSession(200);

      // Release the lock after 50ms
      setTimeout(() => {
        const s = manager.getSessionImmediate();
        if (s) {
          s.isLocked = false;
        }
      }, 50);

      const result = await getSessionPromise;
      expect(result).toBeDefined();
      expect(result?.tabId).toBe(1);
    });

    it('should return null on wait timeout', async () => {
      await manager.startSession(1, 100, mockTreeData);

      // Lock the session
      const session = manager.getSessionImmediate();
      if (session) {
        session.isLocked = true;
      }

      // getSession with short timeout
      const result = await manager.getSession(50);
      expect(result).toBeNull();

      // Cleanup: unlock for afterEach
      if (session) {
        session.isLocked = false;
      }
    });
  });
});
