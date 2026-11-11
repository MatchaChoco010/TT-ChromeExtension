import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ignoreMissingTabOrWindow,
  isMissingTabOrWindowError,
  isNoMessageReceiverError,
  sendMessageToExtensionPages,
} from './chrome-errors';
import { chromeMock } from '@/test/chrome-mock';

describe('isMissingTabOrWindowError', () => {
  it('タブまたはウィンドウが存在しないエラーを判定する', () => {
    expect(isMissingTabOrWindowError(new Error('No tab with id: 123.'))).toBe(true);
    expect(isMissingTabOrWindowError(new Error('No window with id: 45.'))).toBe(true);
  });

  it('それ以外のエラーや値は判定しない', () => {
    expect(isMissingTabOrWindowError(new Error('Tabs cannot be edited right now (user may be dragging a tab).'))).toBe(false);
    expect(isMissingTabOrWindowError('No tab with id: 123.')).toBe(false);
    expect(isMissingTabOrWindowError(undefined)).toBe(false);
  });
});

describe('isNoMessageReceiverError', () => {
  it('受信側がいないエラーだけを判定する', () => {
    expect(isNoMessageReceiverError(new Error('Could not establish connection. Receiving end does not exist.'))).toBe(true);
    expect(isNoMessageReceiverError(new Error('The message port closed before a response was received.'))).toBe(false);
  });
});

describe('ignoreMissingTabOrWindow', () => {
  it('成功した場合は結果を返す', async () => {
    await expect(ignoreMissingTabOrWindow(Promise.resolve(42))).resolves.toBe(42);
  });

  it('対象が存在しない場合はundefinedを返す', async () => {
    await expect(ignoreMissingTabOrWindow(Promise.reject(new Error('No tab with id: 1.')))).resolves.toBeUndefined();
  });

  it('それ以外のエラーは再送出する', async () => {
    const error = new Error('Tabs cannot be edited right now (user may be dragging a tab).');
    await expect(ignoreMissingTabOrWindow(Promise.reject(error))).rejects.toBe(error);
  });
});

describe('sendMessageToExtensionPages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('受信側がいない場合は何もしない', async () => {
    chromeMock.runtime.sendMessage.mockRejectedValueOnce(
      new Error('Could not establish connection. Receiving end does not exist.'),
    );
    await expect(sendMessageToExtensionPages({ type: 'STATE_UPDATED' })).resolves.toBeUndefined();
  });

  it('それ以外のエラーは再送出する', async () => {
    const error = new Error('Extension context invalidated.');
    chromeMock.runtime.sendMessage.mockRejectedValueOnce(error);
    await expect(sendMessageToExtensionPages({ type: 'STATE_UPDATED' })).rejects.toBe(error);
  });
});
