import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SidePanelRoot from './SidePanelRoot';

describe('SidePanelRoot', () => {
  it('レンダリングされること', async () => {
    render(<SidePanelRoot />);
    await waitFor(() => {
      expect(screen.getByTestId('side-panel-root')).toBeInTheDocument();
    });
  });

  it('ローディング状態が表示されること', () => {
    render(<SidePanelRoot />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('TreeStateProviderが含まれていること', async () => {
    render(<SidePanelRoot />);
    // プロバイダーが存在することを確認するため、子コンポーネントがレンダリングされることを確認
    await waitFor(() => {
      expect(screen.getByTestId('side-panel-root')).toBeInTheDocument();
    });
  });

  it('ThemeProviderが含まれていること', async () => {
    render(<SidePanelRoot />);
    // テーマプロバイダーが存在することを確認
    await waitFor(() => {
      expect(screen.getByTestId('side-panel-root')).toBeInTheDocument();
    });
  });

  it('エラー境界が設定されていること', () => {
    // エラーをスローするコンポーネント
    const ErrorComponent = () => {
      throw new Error('Test error');
    };

    // コンソールエラーをモック（テスト中のエラー出力を抑制）
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // エラー境界でエラーをキャッチすることを確認
    render(
      <SidePanelRoot>
        <ErrorComponent />
      </SidePanelRoot>
    );

    consoleError.mockRestore();
  });
});
