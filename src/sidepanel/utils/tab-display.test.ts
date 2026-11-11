import { describe, it, expect } from 'vitest';
import { getDisplayFavicon, getDisplayTitle } from './tab-display';

describe('getDisplayTitle', () => {
  it('読み込み中のタブは「Loading...」と表示する', () => {
    expect(getDisplayTitle({ title: 'Example', url: 'https://example.com', status: 'loading' })).toBe('Loading...');
  });

  it('スタートページは「スタートページ」と表示する', () => {
    expect(getDisplayTitle({ title: '', url: 'chrome://vivaldi-webui/startpage', status: 'complete' })).toBe('スタートページ');
  });

  it('スタートページのセクションページはスタートページとして扱わない', () => {
    expect(
      getDisplayTitle({ title: 'カレンダー', url: 'chrome://vivaldi-webui/startpage?section=calendar', status: 'complete' }),
    ).not.toBe('スタートページ');
  });

  it('新しいタブのページは「新しいタブ」と表示する', () => {
    expect(getDisplayTitle({ title: '', url: 'chrome://newtab/', status: 'complete' })).toBe('新しいタブ');
    expect(getDisplayTitle({ title: '', url: 'about:blank', status: 'complete' })).toBe('新しいタブ');
  });

  it('通常のページはタブのタイトルを表示する', () => {
    expect(getDisplayTitle({ title: 'Example Domain', url: 'https://example.com', status: 'complete' })).toBe('Example Domain');
  });
});

describe('getDisplayFavicon', () => {
  it('タブのファビコンがあればそれを使う', () => {
    expect(getDisplayFavicon({ favIconUrl: 'https://example.com/favicon.ico', url: 'https://example.com' })).toBe(
      'https://example.com/favicon.ico',
    );
  });

  it('ファビコンがなければ拡張機能のファビコンAPIのURLを使う', () => {
    expect(getDisplayFavicon({ url: 'https://example.com' })).toBe(
      'chrome-extension://test-extension-id/_favicon/?pageUrl=https%3A%2F%2Fexample.com&size=32',
    );
  });

  it('URLもファビコンもなければnullを返す', () => {
    expect(getDisplayFavicon({})).toBeNull();
  });
});
