use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::time::{interval, MissedTickBehavior};

pub struct TimerState {
    pub remaining_seconds: i64,
    pub is_running: bool,
    pub session_id: u64, // 新しく追加：タイマーセッションを識別するID
}

impl Default for TimerState {
    fn default() -> Self {
        Self {
            remaining_seconds: 0,
            is_running: false,
            session_id: 0,
        }
    }
}

pub async fn run_timer_loop(app_handle: AppHandle, state: Arc<Mutex<TimerState>>, current_session_id: u64) {
    let mut interval = interval(Duration::from_secs(1));
    interval.set_missed_tick_behavior(MissedTickBehavior::Delay);

    // 最初の1回分のティック（即座に発生する）を消費
    interval.tick().await;

    loop {
        // 1秒待機
        interval.tick().await;

        let current_remaining;
        
        {
            let mut locked_state = state.lock().unwrap();
            
            // 状態チェック:
            // 1. 停止フラグが立っている場合
            // 2. セッションIDが更新されている場合（＝新しいタイマーが開始された場合）
            // 上記のいずれかなら、この古いループを終了する
            if !locked_state.is_running || locked_state.session_id != current_session_id {
                break;
            }
            
            locked_state.remaining_seconds -= 1;
            current_remaining = locked_state.remaining_seconds;
        }

        // フロントエンドに通知
        let _ = app_handle.emit("timer-update", current_remaining);

        if current_remaining == 0 {
            let _ = app_handle.emit("timer-finished", ());
        }
    }
}