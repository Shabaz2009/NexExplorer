# NexExplorer Bug Fixes Summary

## Overview
A comprehensive bug audit and remediation was performed on NexExplorer, focusing on UI selection logic, LocalSend (Phase 6) integration security, and core performance issues.

## Resolutions

### 1. FileGrid Selection Logic
- **Issue**: `FileGrid.tsx` was not integrated with `selectionStore.ts`, rendering the file manager incapable of selecting files for operations.
- **Fix**: Implemented complete click handlers supporting standard OS paradigms:
  - `Ctrl/Cmd + Click` for multi-selection.
  - `Shift + Click` for range selection.
  - Clicking empty space to clear selection.
  - Context menu now properly scopes to selected items.

### 2. LocalSend Security & Auto-Overwrite
- **Issue**: The Node.js LocalSend server (`electron/localsend.cjs`) allowed path traversal via malformed filenames and silently overwrote existing files in the Downloads folder.
- **Fix**: 
  - Added robust filename sanitization to strip dangerous characters.
  - Implemented `getUniqueFileName` to automatically append sequential numbers (e.g., `image (1).png`) to prevent accidental data loss.

### 3. Thumbnail Memory Leak
- **Issue**: `electron/main.cjs` imported the `electron` module on every single `localthumb://` request, causing rapid memory allocation spikes (V8 heap bloat) when browsing folders with many media files.
- **Fix**: Elevated the `nativeImage` import to the top-level module scope, resolving the resource leak.

### 4. Path Navigation Crashes
- **Issue**: `Toolbar.tsx` and `explorerStore.ts` incorrectly constructed parent paths, sometimes generating invalid strings like `C:\\Users\\` ending with trailing backslashes, breaking Rust FS commands.
- **Fix**: Standardized the `goUp` logic to cleanly handle drive roots vs standard directories, preventing API crashes.

## Logo Update
- The application logo was updated across the React `TitleBar` and all OS-specific assets (ICO, ICNS, PNG) were regenerated using the Tauri CLI.

## LocalShare Feature Expansion (Phase 6 Parity)
The LocalShare (LocalSend protocol) integration was upgraded to achieve feature parity with the official app, while maintaining the connection-loss resume logic:
- **Folder Support**: Updated the backend to recursively scan and send entire directories.
- **Text Payloads**: Added IPC logic to receive and emit `text-received` events for clipboard-style text sharing.
- **Manual Accept/Reject**: Implemented a "Pending Transfers" UI in React, backed by new IPC commands (`localsend_accept`, `localsend_reject`), allowing users to manually approve incoming files when auto-accept is disabled.
- **Official App Launcher**: Added a button to execute the official `localsend_app` directly from the NexExplorer UI using the Tauri shell plugin.
- **Manual IP Connection**: Added a UI prompt to manually connect to a target device by IP address.
- **Configuration Settings**: Mapped LocalShare settings (Alias, Port, Save Directory, Auto-Accept) to the global `settingsStore.ts` and UI.