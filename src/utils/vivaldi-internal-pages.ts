/**
 * Vivaldiの内部ページURLからフレンドリーなタイトルを抽出する
 *
 * Chrome APIはVivaldi内部ページの正しいタイトルを返さないため、
 * URLパターンから動的にタイトルを生成する
 *
 * @param url タブのURL
 * @returns フレンドリーなタイトル、または該当しない場合はnull
 */
export function getVivaldiInternalPageTitle(url: string): string | null {
  // パターン1: chrome-extension://mpognobbkildjkofajifpdfhcoklimli/components/XXX/
  // 例: chrome-extension://mpognobbkildjkofajifpdfhcoklimli/components/settings/settings.html?path=general
  // → "Settings"
  const extensionMatch = url.match(
    /chrome-extension:\/\/mpognobbkildjkofajifpdfhcoklimli\/components\/([^/]+)\//
  );
  if (extensionMatch) {
    return capitalizeFirst(extensionMatch[1]);
  }

  // パターン2: chrome://vivaldi-webui/startpage?section=XXX
  // 例: chrome://vivaldi-webui/startpage?section=calendar
  // → "Calendar"
  const webuiMatch = url.match(/chrome:\/\/vivaldi-webui\/startpage\?section=(\w+)/);
  if (webuiMatch) {
    return capitalizeFirst(webuiMatch[1]);
  }

  return null;
}

/**
 * 文字列の先頭を大文字にする
 */
function capitalizeFirst(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * URLがVivaldiの内部ページかどうかを判定する
 */
export function isVivaldiInternalPage(url: string): boolean {
  return (
    url.includes('mpognobbkildjkofajifpdfhcoklimli') ||
    url.includes('vivaldi-webui')
  );
}
