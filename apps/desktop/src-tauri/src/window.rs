use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowInfo {
    pub handle: isize,
    pub title: String,
    pub class_name: String,
    pub pid: u32,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub is_active: bool,
}

pub struct NativeWindowEngine;

impl NativeWindowEngine {
    /// List all visible top-level application windows on the desktop
    pub fn list_windows() -> Vec<WindowInfo> {
        #[cfg(target_os = "windows")]
        {
            use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
            use windows::Win32::UI::WindowsAndMessaging::{
                EnumWindows, GetForegroundWindow, GetWindowRect, GetWindowTextW, GetClassNameW,
                IsWindowVisible, GetWindowThreadProcessId,
            };

            let mut windows_list: Vec<WindowInfo> = Vec::new();
            let active_hwnd = unsafe { GetForegroundWindow() };

            unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
                let list = &mut *(lparam.0 as *mut Vec<WindowInfo>);
                let active = GetForegroundWindow();

                if IsWindowVisible(hwnd).as_bool() {
                    let mut text_buf = [0u16; 512];
                    let text_len = GetWindowTextW(hwnd, &mut text_buf);
                    let title = String::from_utf16_lossy(&text_buf[..text_len as usize]);

                    let mut class_buf = [0u16; 256];
                    let class_len = GetClassNameW(hwnd, &mut class_buf);
                    let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);

                    if !title.trim().is_empty() && class_name != "Progman" && class_name != "Shell_TrayWnd" {
                        let mut rect = RECT::default();
                        let _ = GetWindowRect(hwnd, &mut rect);
                        let mut pid = 0u32;
                        GetWindowThreadProcessId(hwnd, Some(&mut pid));

                        list.push(WindowInfo {
                            handle: hwnd.0 as isize,
                            title,
                            class_name,
                            pid,
                            x: rect.left,
                            y: rect.top,
                            width: rect.right - rect.left,
                            height: rect.bottom - rect.top,
                            is_active: hwnd == active,
                        });
                    }
                }
                BOOL(1)
            }

            unsafe {
                let lparam = LPARAM(&mut windows_list as *mut _ as isize);
                let _ = EnumWindows(Some(enum_proc), lparam);
            }

            windows_list
        }
        #[cfg(not(target_os = "windows"))]
        {
            Vec::new()
        }
    }

    /// Bring a target window to front and focus it
    pub fn focus_window(title_query: &str) -> bool {
        #[cfg(target_os = "windows")]
        {
            use windows::Win32::Foundation::HWND;
            use windows::Win32::UI::WindowsAndMessaging::{SetForegroundWindow, ShowWindow, SW_RESTORE};

            let windows = Self::list_windows();
            if let Some(target) = windows.iter().find(|w| w.title.to_lowercase().contains(&title_query.to_lowercase())) {
                let hwnd = HWND(target.handle as *mut _);
                unsafe {
                    let _ = ShowWindow(hwnd, SW_RESTORE);
                    return SetForegroundWindow(hwnd).as_bool();
                }
            }
        }
        false
    }
}
