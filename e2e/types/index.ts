/**
 * E2Eテストがテスト対象のページに追加するグローバル変数の型
 */
export interface TestGlobals {
  receivedMessages?: Array<{ type: string; [key: string]: unknown }>;
  listenerReady?: boolean;
  stateUpdatedReceived?: boolean;
  stateUpdateCount?: number;
  testState?: { initialized: boolean; timestamp: number };
  messageLog?: Array<{ type: string; timestamp: number }>;
  receivedCount?: number;
}

declare global {
  interface Window extends TestGlobals {}

  var receivedMessages: TestGlobals['receivedMessages'];
  var listenerReady: TestGlobals['listenerReady'];
  var stateUpdatedReceived: TestGlobals['stateUpdatedReceived'];
  var stateUpdateCount: TestGlobals['stateUpdateCount'];
  var testState: TestGlobals['testState'];
  var messageLog: TestGlobals['messageLog'];
  var receivedCount: TestGlobals['receivedCount'];
}
