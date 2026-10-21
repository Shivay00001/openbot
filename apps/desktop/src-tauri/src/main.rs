// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod input;
mod screen;
mod window;
mod process;

use input::{CursorPosition, KeyboardActionResult, MouseActionResult, NativeInputEngine};
use screen::{MonitorInfo, NativeScreenEngine, ScreenCaptureResult};
use window::{NativeWindowEngine, WindowInfo};
use process::{NativeProcessEngine, ProcessExecutionResult, SystemMetrics};

// ─── Tauri Native Commands ──────────────────────────────────────

#[tauri::command]
fn get_cursor_position() -> CursorPosition {
    NativeInputEngine::get_cursor_pos()
}

#[tauri::command]
fn mouse_move(x: i32, y: i32, smooth: Option<bool>) -> MouseActionResult {
    NativeInputEngine::move_cursor(x, y, smooth.unwrap_or(true))
}

#[tauri::command]
fn mouse_click(button: Option<String>, double: Option<bool>) -> MouseActionResult {
    NativeInputEngine::click(&button.unwrap_or_else(|| "left".to_string()), double.unwrap_or(false))
}

#[tauri::command]
fn mouse_drag(from_x: i32, from_y: i32, to_x: i32, to_y: i32, duration_ms: Option<u64>) -> MouseActionResult {
    NativeInputEngine::drag(from_x, from_y, to_x, to_y, duration_ms.unwrap_or(300))
}

#[tauri::command]
fn mouse_scroll(delta_y: i32) -> MouseActionResult {
    NativeInputEngine::scroll(delta_y)
}

#[tauri::command]
fn type_text(text: String) -> KeyboardActionResult {
    NativeInputEngine::type_text(&text)
}

#[tauri::command]
fn send_hotkey(keys: Vec<String>) -> KeyboardActionResult {
    NativeInputEngine::hotkey(&keys)
}

#[tauri::command]
fn list_monitors() -> Vec<MonitorInfo> {
    NativeScreenEngine::list_monitors()
}

#[tauri::command]
fn capture_screen(monitor_index: Option<usize>) -> Result<ScreenCaptureResult, String> {
    NativeScreenEngine::capture_screen(monitor_index.unwrap_or(0))
}

#[tauri::command]
fn list_windows() -> Vec<WindowInfo> {
    NativeWindowEngine::list_windows()
}

#[tauri::command]
fn focus_window(title: String) -> bool {
    NativeWindowEngine::focus_window(&title)
}

#[tauri::command]
fn get_system_metrics() -> SystemMetrics {
    NativeProcessEngine::get_metrics()
}

#[tauri::command]
fn execute_shell(command: String, cwd: Option<String>) -> Result<ProcessExecutionResult, String> {
    NativeProcessEngine::execute_command(&command, cwd.as_deref())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_cursor_position,
            mouse_move,
            mouse_click,
            mouse_drag,
            mouse_scroll,
            type_text,
            send_hotkey,
            list_monitors,
            capture_screen,
            list_windows,
            focus_window,
            get_system_metrics,
            execute_shell,
        ])
        .run(tauri::generate_context!())
        .expect("error while running openbot desktop engine");
}
