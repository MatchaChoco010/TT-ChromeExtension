/**
 * この拡張機能自身のページURLの判定
 */

function isOwnExtensionPageUrl(url: string | undefined, path: string): boolean {
  if (!url) return false;
  const pageUrl = `chrome-extension://${chrome.runtime.id}/${path}`;
  return url === pageUrl || url.startsWith(`${pageUrl}?`);
}

export function isGroupTabUrl(url: string | undefined): boolean {
  return isOwnExtensionPageUrl(url, 'group.html');
}

/**
 * サイドパネルのページURLかを判定する
 * E2Eテストではサイドパネルを通常のタブとして開くため、そのタブをツリーから除外するために使う
 */
export function isSidePanelUrl(url: string | undefined): boolean {
  return isOwnExtensionPageUrl(url, 'sidepanel.html');
}
