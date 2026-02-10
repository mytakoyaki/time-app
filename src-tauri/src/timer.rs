use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::time::{interval, MissedTickBehavior};

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
    let mut interval = interval(Duration::from_secs(1));
    interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

    // Consume the immediate first tick
    interval.tick().await;

    loop {
        // Wait for the next tick (1 second)
        interval.tick().await;

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
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timer_state_default() {
        let state = TimerState::default();
        assert_eq!(state.remaining_seconds, 0);
        assert_eq!(state.is_running, false);
    }

    #[test]
    fn test_timer_decrement_logic() {
        let state = Arc::new(Mutex::new(TimerState {
            remaining_seconds: 5,
            is_running: true,
            initial_duration: 5,
        }));

        // Simulate one loop iteration logic manually
        {
            let mut locked_state = state.lock().unwrap();
            locked_state.remaining_seconds -= 1;
        }
        
        assert_eq!(state.lock().unwrap().remaining_seconds, 4);
    }

    #[test]
    fn test_timer_overtime_logic() {
        let state = Arc::new(Mutex::new(TimerState {
            remaining_seconds: 0,
            is_running: true,
            initial_duration: 5,
        }));

        // 0 -> -1 (Overtime start)
        {
            let mut locked_state = state.lock().unwrap();
            locked_state.remaining_seconds -= 1;
        }
        
        assert_eq!(state.lock().unwrap().remaining_seconds, -1);
    }
}
