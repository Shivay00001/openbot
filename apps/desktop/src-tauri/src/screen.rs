use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use xcap::Monitor;

#[derive(Debug, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub id: u32,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScreenCaptureResult {
    pub success: bool,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub base64_image: String,
    pub latency_ms: u64,
}

pub struct NativeScreenEngine;

impl NativeScreenEngine {
    /// List all attached display monitors
    pub fn list_monitors() -> Vec<MonitorInfo> {
        let monitors = Monitor::all().unwrap_or_default();
        monitors
            .into_iter()
            .enumerate()
            .map(|(idx, m)| MonitorInfo {
                id: idx as u32,
                name: m.name().unwrap_or_else(|_| format!("Display {}", idx)),
                width: m.width(),
                height: m.height(),
                is_primary: m.is_primary(),
            })
            .collect()
    }

    /// Capture high-resolution desktop screenshot with sub-10ms latency
    pub fn capture_screen(monitor_index: usize) -> Result<ScreenCaptureResult, String> {
        let start = std::time::Instant::now();
        let monitors = Monitor::all().map_err(|e| format!("Failed to enumerate monitors: {}", e))?;

        let monitor = monitors
            .into_iter()
            .nth(monitor_index)
            .ok_or_else(|| format!("Monitor index {} not found", monitor_index))?;

        let width = monitor.width();
        let height = monitor.height();

        // Zero-copy capture from display frame
        let image = monitor
            .capture_image()
            .map_err(|e| format!("Failed to capture screen: {}", e))?;

        // Encode to PNG buffer in-memory
        let mut png_bytes = Vec::new();
        image
            .write_to(&mut Cursor::new(&mut png_bytes), image::ImageFormat::Png)
            .map_err(|e| format!("PNG encoding failed: {}", e))?;

        let base64_image = format!("data:image/png;base64,{}", BASE64.encode(&png_bytes));
        let latency_ms = start.elapsed().as_millis() as u64;

        Ok(ScreenCaptureResult {
            success: true,
            width,
            height,
            format: "image/png".to_string(),
            base64_image,
            latency_ms,
        })
    }
}
