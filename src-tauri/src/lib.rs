mod timer;
use timer::{TimerState, run_timer_loop};

use std::sync::{Arc, Mutex};
use tauri::Manager;

// 既存のgreetコマンド
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// タイマーを開始するコマンド
#[tauri::command]
async fn start_timer(app_handle: tauri::AppHandle, state: tauri::State<'_, Arc<Mutex<TimerState>>>, duration_seconds: i64) -> Result<(), String> {
    let mut timer_state = state.lock().map_err(|e| e.to_string())?;

    if timer_state.is_running {
        return Err("Timer is already running".to_string());
    }

    timer_state.remaining_seconds = duration_seconds;
    timer_state.is_running = true;
    
    let app_handle_clone = app_handle.clone();
    let state_clone = state.inner().clone();

    tokio::spawn(async move {
        run_timer_loop(app_handle_clone, state_clone).await;
    });

    Ok(())
}

// タイマーを停止するコマンド
#[tauri::command]
fn stop_timer(state: tauri::State<'_, Arc<Mutex<TimerState>>>) -> Result<(), String> {
    let mut timer_state = state.lock().map_err(|e| e.to_string())?;
    timer_state.is_running = false; 
    Ok(())
}

// タイマーをリセットするコマンド
#[tauri::command]
fn reset_timer(state: tauri::State<'_, Arc<Mutex<TimerState>>>) -> Result<(), String> {
    let mut timer_state = state.lock().map_err(|e| e.to_string())?;
    timer_state.is_running = false; 
    timer_state.remaining_seconds = 0; 
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]

pub fn run() {

    tauri::Builder::default()

        .plugin(tauri_plugin_updater::Builder::new().build())

        .plugin(tauri_plugin_store::Builder::new().build())



        .plugin(tauri_plugin_opener::init())

        .manage(Arc::new(Mutex::new(TimerState::default())))

        .invoke_handler(tauri::generate_handler![greet, start_timer, stop_timer, reset_timer])

        .on_window_event(|window, event| {

            if let tauri::WindowEvent::CloseRequested { .. } = event {

                // メインウィンドウが閉じられたらアプリ全体を終了する

                if window.label() == "main" {

                    window.app_handle().exit(0);

                }

            }

        })

        .run(tauri::generate_context!())

        .expect("error while running tauri application");

}
