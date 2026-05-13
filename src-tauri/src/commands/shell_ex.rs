use std::process::Command;

#[tauri::command]
pub async fn register_shell_extension() -> Result<(), String> {
    // This implements logic similar to PeaZip.ShellEx to register the app in Windows Explorer Context Menu
    // We add "Open with NexExplorer" to directories and all files
    
    #[cfg(target_os = "windows")]
    {
        let app_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get executable path: {}", e))?
            .to_string_lossy()
            .to_string();

        let command_str = format!("\"{}\" \"%1\"", app_path);
        
        // Add for directories
        let status1 = Command::new("reg")
            .args(&[
                "add",
                "HKCU\\Software\\Classes\\Directory\\shell\\NexExplorer",
                "/ve",
                "/d",
                "Open with NexExplorer",
                "/f",
            ])
            .status()
            .map_err(|e| e.to_string())?;

        let status2 = Command::new("reg")
            .args(&[
                "add",
                "HKCU\\Software\\Classes\\Directory\\shell\\NexExplorer\\command",
                "/ve",
                "/d",
                &command_str,
                "/f",
            ])
            .status()
            .map_err(|e| e.to_string())?;

        // Add for all files (*)
        let status3 = Command::new("reg")
            .args(&[
                "add",
                "HKCU\\Software\\Classes\\*\\shell\\NexExplorer",
                "/ve",
                "/d",
                "Open with NexExplorer",
                "/f",
            ])
            .status()
            .map_err(|e| e.to_string())?;

        let status4 = Command::new("reg")
            .args(&[
                "add",
                "HKCU\\Software\\Classes\\*\\shell\\NexExplorer\\command",
                "/ve",
                "/d",
                &command_str,
                "/f",
            ])
            .status()
            .map_err(|e| e.to_string())?;

        if status1.success() && status2.success() && status3.success() && status4.success() {
            Ok(())
        } else {
            Err("Failed to execute one or more registry commands".to_string())
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Shell extension registration is only supported on Windows".to_string())
    }
}

#[tauri::command]
pub async fn unregister_shell_extension() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("reg")
            .args(&[
                "delete",
                "HKCU\\Software\\Classes\\Directory\\shell\\NexExplorer",
                "/f",
            ])
            .status();

        let _ = Command::new("reg")
            .args(&[
                "delete",
                "HKCU\\Software\\Classes\\*\\shell\\NexExplorer",
                "/f",
            ])
            .status();

        Ok(())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Shell extension unregistration is only supported on Windows".to_string())
    }
}
