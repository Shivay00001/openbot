use serde::{Deserialize, Serialize};
use std::process::Command;
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub total_memory_mb: u64,
    pub used_memory_mb: u64,
    pub cpu_usage_percent: f32,
    pub os_name: String,
    pub os_version: String,
    pub host_name: String,
    pub cpu_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessExecutionResult {
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u64,
}

pub struct NativeProcessEngine;

impl NativeProcessEngine {
    /// Get host hardware CPU, RAM, and OS telemetry
    pub fn get_metrics() -> SystemMetrics {
        let mut sys = System::new_with_specifics(
            RefreshKind::new()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything()),
        );
        sys.refresh_all();

        let total_memory_mb = sys.total_memory() / (1024 * 1024);
        let used_memory_mb = sys.used_memory() / (1024 * 1024);
        let cpu_usage_percent = sys.global_cpu_info().cpu_usage();

        SystemMetrics {
            total_memory_mb,
            used_memory_mb,
            cpu_usage_percent,
            os_name: System::name().unwrap_or_else(|| "Unknown".to_string()),
            os_version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
            host_name: System::host_name().unwrap_or_else(|| "localhost".to_string()),
            cpu_count: sys.cpus().len(),
        }
    }

    /// Execute command in native OS shell with millisecond timing
    pub fn execute_command(cmd_str: &str, cwd: Option<&str>) -> Result<ProcessExecutionResult, String> {
        let start = std::time::Instant::now();

        #[cfg(target_os = "windows")]
        let mut cmd = Command::new("powershell.exe");
        #[cfg(target_os = "windows")]
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", cmd_str]);

        #[cfg(not(target_os = "windows"))]
        let mut cmd = Command::new("bash");
        #[cfg(not(target_os = "windows"))]
        cmd.args(["-c", cmd_str]);

        if let Some(dir) = cwd {
            cmd.current_dir(dir);
        }

        let output = cmd.output().map_err(|e| format!("Failed to spawn process: {}", e))?;
        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(ProcessExecutionResult {
            command: cmd_str.to_string(),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code().unwrap_or(-1),
            duration_ms,
        })
    }
}
