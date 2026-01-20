/**
 * E2Eテスト用ダウンロードユーティリティ
 *
 * chrome.downloads APIの呼び出し結果を検証するためのユーティリティ関数
 */

import type { Worker } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * 指定されたディレクトリ内のファイルを一覧取得
 *
 * @param downloadDir - ダウンロードディレクトリのパス
 * @returns ファイル名の配列
 */
export function listDownloadedFiles(downloadDir: string): string[] {
  if (!fs.existsSync(downloadDir)) {
    return [];
  }

  const files: string[] = [];
  const entries = fs.readdirSync(downloadDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      files.push(entry.name);
    } else if (entry.isDirectory()) {
      const subDir = path.join(downloadDir, entry.name);
      const subFiles = fs.readdirSync(subDir, { withFileTypes: true });
      for (const subEntry of subFiles) {
        if (subEntry.isFile()) {
          files.push(path.join(entry.name, subEntry.name));
        }
      }
    }
  }

  return files;
}

/**
 * 指定されたパターンにマッチするダウンロードファイルを検索
 *
 * @param downloadDir - ダウンロードディレクトリのパス
 * @param pattern - ファイル名のパターン（正規表現）
 * @returns マッチしたファイルのフルパス配列
 */
export function findDownloadedFiles(
  downloadDir: string,
  pattern: RegExp
): string[] {
  const files = listDownloadedFiles(downloadDir);
  return files
    .filter((file) => pattern.test(file))
    .map((file) => path.join(downloadDir, file));
}

/**
 * スナップショットファイルが存在することを確認
 *
 * PlaywrightはダウンロードファイルにランダムなGUID名を付与する設計のため
 * （参照: https://github.com/microsoft/playwright/issues/24048）、
 * ファイル名パターンまたはファイル内容で検索する
 *
 * @param downloadDir - ダウンロードディレクトリのパス
 * @param timeout - タイムアウト（ミリ秒）
 * @returns スナップショットファイルのパス（見つかった場合）
 */
export async function waitForSnapshotFile(
  downloadDir: string,
  timeout: number = 5000
): Promise<string | null> {
  const pattern = /vivaldi-tt-snapshot-.*\.json$/;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // まずファイル名パターンで検索
    const files = findDownloadedFiles(downloadDir, pattern);
    if (files.length > 0) {
      return files[files.length - 1];
    }

    // ファイル名パターンで見つからない場合、内容で検索
    const snapshotByContent = findSnapshotFileByContent(downloadDir);
    if (snapshotByContent) {
      return snapshotByContent;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

/**
 * ファイル内容からスナップショットファイルを検索
 *
 * PlaywrightはダウンロードファイルにランダムなGUID名を付与するため、
 * JSONの内容でスナップショットファイルを特定する
 *
 * @param downloadDir - ダウンロードディレクトリのパス
 * @returns スナップショットファイルのパス（見つかった場合）
 */
export function findSnapshotFileByContent(downloadDir: string): string | null {
  if (!fs.existsSync(downloadDir)) {
    return null;
  }

  const entries = fs.readdirSync(downloadDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      const filePath = path.join(downloadDir, entry.name);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (
          parsed.id &&
          typeof parsed.id === 'string' &&
          parsed.id.startsWith('snapshot-') &&
          parsed.createdAt &&
          parsed.name &&
          typeof parsed.isAutoSave === 'boolean' &&
          parsed.data &&
          Array.isArray(parsed.data.views) &&
          Array.isArray(parsed.data.tabs)
        ) {
          return filePath;
        }
      } catch {
        // JSONパースに失敗した場合は無視
      }
    }
  }

  return null;
}

/**
 * ダウンロードディレクトリをクリーンアップ
 *
 * @param downloadDir - ダウンロードディレクトリのパス
 */
export function cleanupDownloadDir(downloadDir: string): void {
  if (!fs.existsSync(downloadDir)) {
    return;
  }

  const entries = fs.readdirSync(downloadDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(downloadDir, entry.name);
    if (entry.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
  }
}

/**
 * スナップショットファイルの内容を読み取り
 *
 * @param filePath - スナップショットファイルのパス
 * @returns パースされたスナップショットデータ
 */
export function readSnapshotFile(filePath: string): {
  id: string;
  createdAt: string;
  name: string;
  isAutoSave: boolean;
  data: {
    views: Array<{ id: string; name: string; color: string }>;
    tabs: Array<{
      index: number;
      url: string;
      title: string;
      parentIndex: number | null;
      viewId: string;
      isExpanded: boolean;
      pinned: boolean;
    }>;
  };
} {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * chrome.downloads.search()でダウンロード履歴を取得
 *
 * @param serviceWorker - Service Worker
 * @param query - 検索クエリ
 * @returns ダウンロードアイテムの配列
 */
export async function getDownloadHistory(
  serviceWorker: Worker,
  query: { filenameRegex?: string; limit?: number } = {}
): Promise<chrome.downloads.DownloadItem[]> {
  return await serviceWorker.evaluate(
    async (searchQuery: { filenameRegex?: string; limit?: number }) => {
      const results = await chrome.downloads.search({
        filenameRegex: searchQuery.filenameRegex,
        limit: searchQuery.limit,
      });
      return results;
    },
    query
  );
}

/**
 * スナップショットのダウンロードがトリガーされたことを確認
 *
 * @param serviceWorker - Service Worker
 * @param expectedFilenamePattern - 期待されるファイル名のパターン
 * @returns ダウンロードが見つかった場合はtrue
 */
export async function assertDownloadTriggered(
  serviceWorker: Worker,
  expectedFilenamePattern: string
): Promise<boolean> {
  const downloads = await getDownloadHistory(serviceWorker, {
    filenameRegex: expectedFilenamePattern,
    limit: 1,
  });
  return downloads.length > 0;
}
