use serde::{Deserialize, Serialize};
use std::thread;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct CursorPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MouseActionResult {
    pub success: bool,
    pub x: i32,
    pub y: i32,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyboardActionResult {
    pub success: bool,
    pub characters_sent: usize,
    pub message: String,
}

pub struct NativeInputEngine;

impl NativeInputEngine {
    pub fn new() -> Self {
        Self
    }

    /// Query current cursor position
    pub fn get_cursor_pos() -> CursorPosition {
        #[cfg(target_os = "windows")]
        {
            use windows::Win32::Foundation::POINT;
            use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
            let mut point = POINT { x: 0, y: 0 };
            unsafe {
                let _ = GetCursorPos(&mut point);
            }
            CursorPosition { x: point.x, y: point.y }
        }
        #[cfg(not(target_os = "windows"))]
        {
            CursorPosition { x: 0, y: 0 }
        }
    }

    /// Move mouse cursor smoothly or instantly to target coordinates
    pub fn move_cursor(target_x: i32, target_y: i32, smooth: bool) -> MouseActionResult {
        let current = Self::get_cursor_pos();

        if smooth {
            // Cubic Bezier interpolation for human-like movement trajectory
            let steps = 25;
            for i in 1..=steps {
                let t = i as f64 / steps as f64;
                // Ease out cubic: 1 - (1 - t)^3
                let ease = 1.0 - (1.0 - t).powi(3);
                let cur_x = current.x as f64 + (target_x as f64 - current.x as f64) * ease;
                let cur_y = current.y as f64 + (target_y as f64 - current.y as f64) * ease;

                Self::set_cursor_raw(cur_x as i32, cur_y as i32);
                thread::sleep(Duration::from_millis(4));
            }
        } else {
            Self::set_cursor_raw(target_x, target_y);
        }

        MouseActionResult {
            success: true,
            x: target_x,
            y: target_y,
            message: format!("Moved mouse to ({}, {})", target_x, target_y),
        }
    }

    #[inline]
    fn set_cursor_raw(x: i32, y: i32) {
        #[cfg(target_os = "windows")]
        {
            use windows::Win32::UI::WindowsAndMessaging::SetCursorPos;
            unsafe {
                let _ = SetCursorPos(x, y);
            }
        }
    }

    /// Dispatch real OS mouse click (left, right, middle, or double click)
    pub fn click(button: &str, double_click: bool) -> MouseActionResult {
        let pos = Self::get_cursor_pos();

        #[cfg(target_os = "windows")]
        {
            use windows::Win32::UI::WindowsAndMessaging::{
                mouse_event, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
                MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP,
            };

            let (down_flag, up_flag) = match button.to_lowercase().as_str() {
                "right" => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
                "middle" => (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
                _ => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
            };

            unsafe {
                mouse_event(down_flag, 0, 0, 0, 0);
                thread::sleep(Duration::from_millis(30));
                mouse_event(up_flag, 0, 0, 0, 0);

                if double_click {
                    thread::sleep(Duration::from_millis(100));
                    mouse_event(down_flag, 0, 0, 0, 0);
                    thread::sleep(Duration::from_millis(30));
                    mouse_event(up_flag, 0, 0, 0, 0);
                }
            }
        }

        MouseActionResult {
            success: true,
            x: pos.x,
            y: pos.y,
            message: format!("Performed {} click at ({}, {})", button, pos.x, pos.y),
        }
    }

    /// Drag from source coordinate to destination coordinate
    pub fn drag(from_x: i32, from_y: i32, to_x: i32, to_y: i32, duration_ms: u64) -> MouseActionResult {
        Self::move_cursor(from_x, from_y, false);
        thread::sleep(Duration::from_millis(50));

        #[cfg(target_os = "windows")]
        {
            use windows::Win32::UI::WindowsAndMessaging::{mouse_event, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP};
            unsafe {
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
            }

            let steps = 40;
            let step_delay = Duration::from_millis(duration_ms / steps);
            for i in 1..=steps {
                let t = i as f64 / steps as f64;
                let cur_x = from_x as f64 + (to_x as f64 - from_x as f64) * t;
                let cur_y = from_y as f64 + (to_y as f64 - from_y as f64) * t;
                Self::set_cursor_raw(cur_x as i32, cur_y as i32);
                thread::sleep(step_delay);
            }

            unsafe {
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
            }
        }

        MouseActionResult {
            success: true,
            x: to_x,
            y: to_y,
            message: format!("Dragged from ({}, {}) to ({}, {})", from_x, from_y, to_x, to_y),
        }
    }

    /// Native mouse wheel scroll
    pub fn scroll(delta_y: i32) -> MouseActionResult {
        let pos = Self::get_cursor_pos();

        #[cfg(target_os = "windows")]
        {
            use windows::Win32::UI::WindowsAndMessaging::{mouse_event, MOUSEEVENTF_WHEEL};
            unsafe {
                // delta_y > 0 scrolls up, delta_y < 0 scrolls down
                mouse_event(MOUSEEVENTF_WHEEL, 0, 0, delta_y as u32 * 120, 0);
            }
        }

        MouseActionResult {
            success: true,
            x: pos.x,
            y: pos.y,
            message: format!("Scrolled wheel delta {}", delta_y),
        }
    }

    /// Type unicode text natively into the currently focused window
    pub fn type_text(text: &str) -> KeyboardActionResult {
        #[cfg(target_os = "windows")]
        {
            use windows::Win32::UI::Input::KeyboardAndMouse::{
                SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
            };

            for ch in text.encode_utf16() {
                let down = INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY(0),
                            wScan: ch,
                            dwFlags: KEYEVENTF_UNICODE,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                };

                let up = INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY(0),
                            wScan: ch,
                            dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                };

                unsafe {
                    SendInput(&[down, up], std::mem::size_of::<INPUT>() as i32);
                }
                thread::sleep(Duration::from_millis(5));
            }
        }

        KeyboardActionResult {
            success: true,
            characters_sent: text.len(),
            message: format!("Typed {} characters natively", text.len()),
        }
    }

    /// Send special key combinations (e.g. ["ctrl", "c"], ["alt", "tab"], ["win", "r"])
    pub fn hotkey(keys: &[String]) -> KeyboardActionResult {
        #[cfg(target_os = "windows")]
        {
            use windows::Win32::UI::Input::KeyboardAndMouse::{
                SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VIRTUAL_KEY,
                VK_CONTROL, VK_MENU, VK_SHIFT, VK_LWIN, VK_RETURN, VK_ESCAPE, VK_TAB,
                VK_BACK, VK_DELETE, VK_UP, VK_DOWN, VK_LEFT, VK_RIGHT, VK_SPACE,
            };

            let to_vk = |k: &str| -> Option<VIRTUAL_KEY> {
                match k.to_lowercase().as_str() {
                    "ctrl" | "control" => Some(VK_CONTROL),
                    "alt" => Some(VK_MENU),
                    "shift" => Some(VK_SHIFT),
                    "win" | "super" | "cmd" => Some(VK_LWIN),
                    "enter" | "return" => Some(VK_RETURN),
                    "esc" | "escape" => Some(VK_ESCAPE),
                    "tab" => Some(VK_TAB),
                    "backspace" => Some(VK_BACK),
                    "delete" => Some(VK_DELETE),
                    "up" => Some(VK_UP),
                    "down" => Some(VK_DOWN),
                    "left" => Some(VK_LEFT),
                    "right" => Some(VK_RIGHT),
                    "space" => Some(VK_SPACE),
                    s if s.len() == 1 => {
                        let c = s.chars().next().unwrap().to_ascii_uppercase();
                        Some(VIRTUAL_KEY(c as u16))
                    }
                    _ => None,
                }
            };

            let vks: Vec<VIRTUAL_KEY> = keys.iter().filter_map(|k| to_vk(k)).collect();

            // Press all down in order
            for &vk in &vks {
                let down = INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: vk,
                            wScan: 0,
                            dwFlags: windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0),
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                };
                unsafe {
                    SendInput(&[down], std::mem::size_of::<INPUT>() as i32);
                }
                thread::sleep(Duration::from_millis(15));
            }

            // Release all up in reverse order
            for &vk in vks.iter().rev() {
                let up = INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: vk,
                            wScan: 0,
                            dwFlags: KEYEVENTF_KEYUP,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                };
                unsafe {
                    SendInput(&[up], std::mem::size_of::<INPUT>() as i32);
                }
                thread::sleep(Duration::from_millis(15));
            }
        }

        KeyboardActionResult {
            success: true,
            characters_sent: keys.len(),
            message: format!("Sent hotkey combination: {}", keys.join("+")),
        }
    }
}
