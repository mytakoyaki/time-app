use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::time::sleep;

pub struct TimerState {
    pub remaining_seconds: i64,
    pub is_running: bool,
    pub initial_duration: i64,
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

pub async fn run_timer_loop(app_handle: AppHandle, state: Arc<Mutex<TimerState>>) {
    loop {
        let current_remaining;
        
        {
            let mut locked_state = state.lock().unwrap();
            if !locked_state.is_running {
                break;
            }
            // 0になっても止まらず減算し続ける（時間超過）
            locked_state.remaining_seconds -= 1;
            current_remaining = locked_state.remaining_seconds;
        }

        // Emit update event
        let _ = app_handle.emit("timer-update", current_remaining);

        // 0になった瞬間にイベントを送るが、ループは止めない
        if current_remaining == 0 {
            let _ = app_handle.emit("timer-finished", ());
        }

        sleep(Duration::from_secs(1)).await;
    }
}
