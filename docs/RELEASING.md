# リリース・配布ガイド

このドキュメントでは、本アプリケーションを外部へ配布するための手順（署名・ビルド・リリース）について説明します。

## 1. 生成されるインストーラー形式

GitHub Actions を通じて、以下の形式が自動生成されます。

- **Windows**: `.exe` (NSISインストーラー - 1クリックでインストール可能), `.msi`
- **macOS**: `.dmg`, `.app` (Intel/Apple Silicon 両対応)
- **Linux**: `.AppImage` (汎用実行ファイル), `.deb` (Debian/Ubuntu用)

## 2. コード署名 (重要)

警告なしでアプリを起動可能にするためには、各プラットフォームでの署名が必要です。

### macOS (公証対応)
1. Apple Developer Program に加入。
2. 証明書 (.p12) を書き出し、base64エンコードして GitHub Secrets に `APPLE_CERTIFICATE` として登録。
3. パスワードや Apple ID 情報を以下のキーで登録：
   - `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_ID`
   - `APPLE_PASSWORD` (App-specific password)
   - `APPLE_TEAM_ID`

### Windows
1. コード署名証明書を購入。
2. GitHub Secrets に `WIN_CERTIFICATE` (base64) と `WIN_CERTIFICATE_PASSWORD` を登録。

## 3. リリースの手順

1. `package.json` のバージョンを更新。
2. 以下のコマンドでタグを打ち、GitHubへプッシュ。
   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```
3. GitHub Actions が自動起動し、数分後に GitHub Releases にドラフト（下書き）が作成されます。
4. 内容を確認して公開します。

## 4. ストア配布への道

### Microsoft Store (Windows)
- `tauri-action` でビルドされたバイナリを MSIX 形式としてアップロード可能です。
- パートナーセンターでの登録が必要です。

## 5. OSごとの注意点

### Linux (Audio/Webview)
Linux環境では、Webviewや音声再生のために以下のパッケージが必要になる場合があります。配布時にユーザーへ通知することを推奨します。
```bash
sudo apt-get install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev
```

### Windows (DPI Awareness)
本アプリは高解像度ディスプレイに対応（DPI Aware）しています。4Kモニター等でも文字がボケることなく、鮮明に表示されます。

### 自動アップデート
Tauri Updater が有効になっています。新しいバージョンを GitHub Releases に公開すると、起動時にユーザーへ更新通知が表示されます。
※ `tauri.conf.json` の `pubkey` とエンドポイントURLを環境に合わせて変更してください。
