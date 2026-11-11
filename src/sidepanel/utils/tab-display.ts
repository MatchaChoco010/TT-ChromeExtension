/**
 * サイドパネルでのタブのタイトル・ファビコンの表示内容の決定
 */
import { getVivaldiInternalPageTitle } from '@/utils/vivaldi-internal-pages';

/**
 * 注意: chrome://vivaldi-webui/startpage?section=XXX はセクションページなので
 * スタートページとは判定しない（カレンダー、メールなど個別の機能ページ）
 */
const isStartPageUrl = (url: string): boolean => {
  if (!url) return false;

  if (url.includes('?section=')) return false;

  const startPageUrlPatterns = [
    /^chrome:\/\/vivaldi-webui\/startpage/,
    /^vivaldi:\/\/startpage/,
  ];

  return startPageUrlPatterns.some(pattern => pattern.test(url));
};

/**
 * chrome-extension://URLは新しいタブと判定しない
 * 拡張機能ページ（settings.html, group.html等）は独自のタイトルを持つため
 */
const isNewTabUrl = (url: string): boolean => {
  if (!url) return false;

  const newTabUrlPatterns = [
    /^chrome:\/\/newtab/,
    /^vivaldi:\/\/newtab/,
    /^about:blank$/,
  ];

  return newTabUrlPatterns.some(pattern => pattern.test(url));
};

/**
 * Vivaldi専用URL（chrome://vivaldi-webui/startpage）の場合、
 * 拡張機能にはURLが公開されないことがあるため、タイトルもチェックする
 */
export const getDisplayTitle = (tab: { title: string; url: string; status?: 'loading' | 'complete' }): string => {
  if (tab.status === 'loading') {
    return 'Loading...';
  }

  if (isStartPageUrl(tab.url) || isStartPageUrl(tab.title)) {
    return 'スタートページ';
  }

  if (isNewTabUrl(tab.url) || isNewTabUrl(tab.title)) {
    return '新しいタブ';
  }

  const vivaldiTitle = getVivaldiInternalPageTitle(tab.url);
  if (vivaldiTitle) {
    return vivaldiTitle;
  }

  return tab.title;
};

// https://developer.chrome.com/docs/extensions/how-to/ui/favicons
const getFaviconUrl = (url: string): string | null => {
  if (!url) return null;

  const faviconApiUrl = new URL(chrome.runtime.getURL('/_favicon/'));
  faviconApiUrl.searchParams.set('pageUrl', url);
  faviconApiUrl.searchParams.set('size', '32');
  return faviconApiUrl.toString();
};

export const getDisplayFavicon = (tabInfo: { favIconUrl?: string; url?: string }): string | null => {
  if (tabInfo.favIconUrl) {
    return tabInfo.favIconUrl;
  }

  if (tabInfo.url) {
    return getFaviconUrl(tabInfo.url);
  }

  return null;
};
