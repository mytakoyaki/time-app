use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::time::sleep;
use tauri::Emitter;

// タイマーの状態を保持する構造体
struct TimerState {
    remaining_seconds: u64,
    is_running: bool,
    initial_duration: u64, // リセット用
}

impl Default for TimerState {
    fn default() -> Self {
        Self {
            remaining_seconds: 0,
            is_running: false,
            initial_duration: 0,
        }
    }
}

// 既存のgreetコマンド
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// タイマーを開始するコマンド
#[tauri::command]
async fn start_timer(app_handle: tauri::AppHandle, state: tauri::State<'_, Arc<Mutex<TimerState>>>, duration_seconds: u64) -> Result<(), String> {
    // ロックを取得
    let mut timer_state = state.lock().map_err(|e| e.to_string())?;

    if timer_state.is_running {
        return Err("Timer is already running".to_string());
    }

    timer_state.initial_duration = duration_seconds;
    timer_state.remaining_seconds = duration_seconds;
    timer_state.is_running = true;

    // 非同期タスクでタイマーを動かす
    let app_handle_clone = app_handle.clone();
    let state_clone = state.inner().clone(); // Arc<Mutex<TimerState>> をクローン
    tokio::spawn(async move {
        loop {
            // 現在の状態を取得
            let current_remaining;
            let running_status;
            {
                let mut locked_state = state_clone.lock().unwrap(); // ロック取得
                if !locked_state.is_running { // 停止信号を受けたらループを抜ける
                    break;
                }
                locked_state.remaining_seconds = locked_state.remaining_seconds.saturating_sub(1);
                current_remaining = locked_state.remaining_seconds;
                running_status = locked_state.is_running; // 再度is_runningをチェック
            } // ロック解放

            // フロントエンドに残り時間を通知
            let _ = app_handle_clone.emit("timer-update", current_remaining);

            if current_remaining == 0 {
                let _ = app_handle_clone.emit("timer-finished", ());
                // 終了処理
                let mut locked_state = state_clone.lock().unwrap();
                locked_state.is_running = false;
                break;
            }

            sleep(Duration::from_secs(1)).await;
        }
    });

    Ok(())
}

// タイマーを停止するコマンド
#[tauri::command]
fn stop_timer(state: tauri::State<'_, Arc<Mutex<TimerState>>>) -> Result<(), String> {
    let mut timer_state = state.lock().map_err(|e| e.to_string())?;
    timer_state.is_running = false; // 停止
    Ok(())
}

// タイマーをリセットするコマンド
#[tauri::command]
fn reset_timer(state: tauri::State<'_, Arc<Mutex<TimerState>>>) -> Result<(), String> {
    let mut timer_state = state.lock().map_err(|e| e.to_string())?;
    timer_state.is_running = false; // 停止
    timer_state.remaining_seconds = timer_state.initial_duration; // 初期値に戻す
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(Mutex::new(TimerState::default()))) // TimerStateを管理対象に追加
        .invoke_handler(tauri::generate_handler![greet, start_timer, stop_timer, reset_timer]) // 新しいコマンドを登録
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
