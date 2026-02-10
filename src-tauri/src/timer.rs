use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::time::{interval, MissedTickBehavior};

pub struct TimerState {
    pub start_time: Option<Instant>,
    pub duration_at_start: i64,
    pub remaining_seconds: i64,
    pub is_running: bool,
    pub session_id: u64,
}

impl Default for TimerState {
    fn default() -> Self {
        Self {
            start_time: None,
            duration_at_start: 0,
            remaining_seconds: 0,
            is_running: false,
            session_id: 0,
        }
    }
}

pub async fn run_timer_loop(app_handle: AppHandle, state: Arc<Mutex<TimerState>>, current_session_id: u64) {
    let mut interval = interval(Duration::from_millis(200)); // 0.2秒ごとにチェック（精度向上のため）
    interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

    loop {
        interval.tick().await;

        let current_remaining;
        let mut finished_now = false;
        
        {
            let mut locked_state = state.lock().unwrap();
            
            if !locked_state.is_running || locked_state.session_id != current_session_id {
                break;
            }

            if let Some(start_instant) = locked_state.start_time {
                let elapsed = start_instant.elapsed().as_secs() as i64;
                let new_remaining = locked_state.duration_at_start - elapsed;
                
                // 1秒変わったときだけイベントを送る（無駄な通信を減らす）
                if new_remaining != locked_state.remaining_seconds {
                    locked_state.remaining_seconds = new_remaining;
                    current_remaining = new_remaining;
                    
                    if current_remaining == 0 {
                        finished_now = true;
                    }
                } else {
                    continue; // 秒数が変わっていなければ次へ
                }
            } else {
                break;
            }
        }

        // フロントエンドに通知
        let _ = app_handle.emit("timer-update", current_remaining);

        if finished_now {
            let _ = app_handle.emit("timer-finished", ());
        }
    }
}
