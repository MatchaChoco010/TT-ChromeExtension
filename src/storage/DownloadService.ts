import type { IDownloadService } from '@/types';

/**
 * chrome.downloads APIを使用したスナップショットダウンロードサービス
 */
export class DownloadService implements IDownloadService {
  /**
   * スナップショットをJSONファイルとしてダウンロード
   *
   * Service Workerでは URL.createObjectURL が使えないため、data URL を使用
   *
   * @param jsonContent - JSON文字列
   * @param filename - ファイル名
   * @param subfolder - サブフォルダ名（省略時はダウンロードフォルダ直下）
   * @returns ダウンロードID
   */
  async downloadSnapshot(
    jsonContent: string,
    filename: string,
    subfolder?: string,
  ): Promise<number> {
    // Service Workerでは URL.createObjectURL が使えないため、data URL を使用
    const base64Content = btoa(unescape(encodeURIComponent(jsonContent)));
    const dataUrl = `data:application/json;base64,${base64Content}`;

    const path = subfolder ? `${subfolder}/${filename}` : filename;

    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: path,
      saveAs: false,
      conflictAction: 'uniquify',
    });

    await this.waitForDownloadComplete(downloadId);

    return downloadId;
  }

  /**
   * ダウンロードが完了するまで待機
   */
  private waitForDownloadComplete(downloadId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const listener = (
        delta: chrome.downloads.DownloadDelta,
      ) => {
        if (delta.id !== downloadId) return;

        if (delta.state?.current === 'complete') {
          chrome.downloads.onChanged.removeListener(listener);
          resolve();
        } else if (delta.state?.current === 'interrupted') {
          chrome.downloads.onChanged.removeListener(listener);
          reject(new Error(`Download interrupted: ${delta.error?.current || 'Unknown error'}`));
        }
      };

      chrome.downloads.onChanged.addListener(listener);

      // タイムアウト設定（30秒）
      setTimeout(() => {
        chrome.downloads.onChanged.removeListener(listener);
        reject(new Error('Download timed out'));
      }, 30000);
    });
  }
}

export const downloadService = new DownloadService();
