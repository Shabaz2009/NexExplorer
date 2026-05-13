# NexExplorer Build Script — retries on Avast interference
# Run from: nexexplorer/src-tauri

$maxRetries = 5
$targetDir = "D:\nex_build"

Write-Host "=== NexExplorer Build (with AV retry) ===" -ForegroundColor Cyan

for ($i = 1; $i -le $maxRetries; $i++) {
    Write-Host "`n--- Attempt $i of $maxRetries ---" -ForegroundColor Yellow
    
    $env:CARGO_BUILD_JOBS = "2"
    
    $process = Start-Process -FilePath "cargo" -ArgumentList "build","--release" -NoNewWindow -PassThru -Wait
    
    if ($process.ExitCode -eq 0) {
        Write-Host "`n=== BUILD SUCCEEDED on attempt $i ===" -ForegroundColor Green
        exit 0
    }
    
    Write-Host "Build failed (attempt $i), waiting 3 seconds before retry..." -ForegroundColor Red
    Start-Sleep -Seconds 3
}

Write-Host "`n=== BUILD FAILED after $maxRetries attempts ===" -ForegroundColor Red
Write-Host "Avast is still interfering. Please fully disable Avast:" -ForegroundColor Red
Write-Host "  1. Open Avast -> Menu -> Settings -> Protection -> File Shield -> TURN OFF" -ForegroundColor Yellow
Write-Host "  2. Or uninstall Avast temporarily" -ForegroundColor Yellow
exit 1
