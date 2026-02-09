# 発表時間管理アプリ (Time App)

Tauri + React + Rust で構築された、プレゼンテーションや質疑応答の時間を管理するためのデスクトップアプリケーションです。

## 機能

*   **発表時間と質疑応答時間の設定**: 分・秒単位で設定可能。
*   **タイマー機能**: 設定した時間に基づいてカウントダウンを行います。
*   **自動ステージ遷移**: 発表時間が終了すると、自動的に（または操作により）質疑応答モードへ移行します。
*   **状態管理**: タイマーの進行状況をRustバックエンドと同期し、正確な時間を刻みます。

## 技術スタック

*   **Frontend**: React, TypeScript, Vite
*   **Backend**: Rust (Tauri)
*   **Styling**: CSS (Standard)

## 開発環境のセットアップ

### 前提条件

*   Node.js (npm)
*   Rust (Cargo)
*   Linuxの場合: システム依存ライブラリ（`libgtk-3-dev`, `libwebkit2gtk-4.0-dev` など）

### インストール

```bash
npm install
```

### 開発モードでの実行

```bash
npm run tauri dev
```

### ビルド

```bash
npm run tauri build
```

## プロジェクト構造

*   `src/`: Reactフロントエンドのソースコード
    *   `App.tsx`: メインのアプリケーションロジックとUI
    *   `main.tsx`: エントリポイント
*   `src-tauri/`: Rustバックエンドのソースコード
    *   `src/lib.rs`: Tauriコマンドの定義
    *   `src/timer.rs`: タイマーのロジックと状態管理