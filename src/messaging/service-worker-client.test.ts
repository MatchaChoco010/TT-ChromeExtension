import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '@/test/chrome-mock';
import { dispatchServiceWorkerRequest, sendServiceWorkerRequest } from './service-worker-client';

describe('sendServiceWorkerRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('成功した応答のデータを返す', async () => {
    chromeMock.runtime.sendMessage.mockResolvedValueOnce({ success: true, data: { windows: [] } });

    await expect(sendServiceWorkerRequest('GET_STATE')).resolves.toEqual({ windows: [] });
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_STATE' });
  });

  it('失敗した応答はエラーとして送出する', async () => {
    chromeMock.runtime.sendMessage.mockResolvedValueOnce({ success: false, error: 'Tab not found' });

    await expect(sendServiceWorkerRequest('CLOSE_SUBTREE', { tabId: 1 })).rejects.toThrow('Tab not found');
  });

  it('応答がない場合はエラーとして送出する', async () => {
    chromeMock.runtime.sendMessage.mockResolvedValueOnce(undefined);

    await expect(sendServiceWorkerRequest('CREATE_SNAPSHOT')).rejects.toThrow('No response');
  });
});

describe('dispatchServiceWorkerRequest', () => {
  it('失敗した要求をコンソールに記録する', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    chromeMock.runtime.sendMessage.mockResolvedValueOnce({ success: false, error: 'Tab not found' });

    dispatchServiceWorkerRequest('CLOSE_TAB', { tabId: 1 });

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('[CLOSE_TAB] Request failed:', new Error('Tab not found'));
    });
    consoleError.mockRestore();
  });
});
