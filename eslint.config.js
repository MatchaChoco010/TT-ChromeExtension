import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist', 'node_modules'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        chrome: 'readonly',
        Worker: 'readonly',
        SharedWorker: 'readonly',
        ServiceWorker: 'readonly',
        ServiceWorkerRegistration: 'readonly',
        ServiceWorkerContainer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        EventTarget: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        HTMLImageElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        NodeList: 'readonly',
        DOMRect: 'readonly',
        DOMRectReadOnly: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        WheelEvent: 'readonly',
        TouchEvent: 'readonly',
        FocusEvent: 'readonly',
        DragEvent: 'readonly',
        ClipboardEvent: 'readonly',
        InputEvent: 'readonly',
        PointerEvent: 'readonly',
        getComputedStyle: 'readonly',
        // IndexedDB globals
        indexedDB: 'readonly',
        IDBDatabase: 'readonly',
        IDBTransaction: 'readonly',
        IDBRequest: 'readonly',
        IDBOpenDBRequest: 'readonly',
        IDBCursor: 'readonly',
        IDBKeyRange: 'readonly',
        IDBObjectStore: 'readonly',
        IDBIndex: 'readonly',
        // Node.js globals
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        global: 'readonly',
        Buffer: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        // Test globals (vitest)
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        jest: 'readonly',
        // Promise
        Promise: 'readonly',
        // Other Web APIs
        structuredClone: 'readonly',
        queueMicrotask: 'readonly',
        // CSS
        CSSStyleDeclaration: 'readonly',
        CSSStyleSheet: 'readonly',
        StyleSheet: 'readonly',
        // React (for JSX without import)
        React: 'readonly',
        // Node.js types
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react: react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  // CommonJS files (Node.js scripts)
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
  },
  // E2E tests - disable React hooks rules (Playwright fixtures use 'use' function)
  {
    files: ['e2e/**/*.ts', 'e2e/**/*.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/globals': 'off',
      'no-empty-pattern': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      // Type imports are not recognized by ESLint
      'no-undef': 'off',
    },
  },
  // Test files - disable strict React hooks rules
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/globals': 'off',
    },
  },
  // React 19 strict effect rules - allow setState in effects for prop syncing patterns
  {
    files: ['src/**/*.tsx'],
    rules: {
      // Allow setState within effects for prop-to-state synchronization
      'react-hooks/effect-deps': 'off',
    },
  },
  prettier,
];
