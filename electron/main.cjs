const { app, BrowserWindow, ipcMain, shell, protocol, net, nativeImage } = require('electron');

protocol.registerSchemesAsPrivileged([
  { scheme: 'nex', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true } }
]);
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const dgram = require('node:dgram');
const { execFile } = require('node:child_process');
const { startLocalSendServer, stopLocalSendServer } = require('./localsend.cjs');

// RAM Optimization: Limit V8 heap memory to reduce footprint
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

let mainWindow;
let discoverySocket;
let logFile;

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function log(message, error) {
  const line = `[${new Date().toISOString()}] ${message}${error ? `\n${error.stack || error}` : ''}\n`;
  console.log(line.trimEnd());
  if (!logFile) return;
  try {
    fs.appendFileSync(logFile, line);
  } catch {
    // Logging should never crash the app.
  }
}

function createWindow() {
  log(`Creating window. isDev=${isDev}`);
  const windowIcon = isDev
    ? path.join(__dirname, '..', 'build', 'icon.png')
    : path.join(__dirname, '..', 'build', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    center: true,
    show: false,
    frame: false,
    backgroundColor: '#1a1a1a',
    title: 'NexExplorer',
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    log('Window ready-to-show');
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    log('Renderer did-finish-load');
    if (!mainWindow.isVisible()) {
      log('Window was not visible after renderer load; forcing show');
      mainWindow.show();
      mainWindow.focus();
    }
  });

  if (isDev) {
    log(`Loading dev URL: ${process.env.VITE_DEV_SERVER_URL}`);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Open DevTools automatically in development to aid debugging invalid-hook errors
    try {
      mainWindow.webContents.openDevTools({ mode: 'right' });
    } catch (e) {
      // ignore if opening devtools fails
    }
  } else {
    log(`Loading nex:// protocol`);
    mainWindow.loadURL('nex://-/');
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log(`Renderer failed to load ${validatedURL}: ${errorCode} ${errorDescription}`);
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    log(`Renderer console [${level}] ${sourceId}:${line} ${message}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log(`Renderer process gone: ${JSON.stringify(details)}`);
  });

  mainWindow.on('unresponsive', () => {
    log('Main window became unresponsive');
  });

  mainWindow.on('closed', () => {
    log('Main window closed');
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  protocol.handle('nex', (request) => {
    let url = request.url.replace('nex://-/', '');
    if (!url) url = 'index.html';
    url = url.split('?')[0].split('#')[0];
    const decodedUrl = decodeURIComponent(url);
    const filePath = path.join(__dirname, '..', 'dist', decodedUrl);
    return net.fetch('file://' + filePath);
  });

  protocol.handle('localthumb', async (request) => {
    let url = request.url.replace('localthumb://', '');
    const decodedUrl = decodeURIComponent(url);
    try {
      const { nativeImage } = require('electron');
      // Windows native thumbnail extraction for images and videos
      const thumb = await nativeImage.createThumbnailFromPath(decodedUrl, { width: 256, height: 256 });
      return new Response(thumb.toPNG(), {
        headers: { 'Content-Type': 'image/png' }
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });

  logFile = path.join(app.getPath('userData'), 'main.log');
  log('App ready');
  registerIpcHandlers();
  createWindow();
  startLocalSendServer(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  log('All windows closed');
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (error) => {
  log('Uncaught exception', error);
});

process.on('unhandledRejection', (reason) => {
  log('Unhandled rejection', reason);
});

function toEpoch(statTime) {
  return statTime ? Math.floor(statTime.getTime() / 1000) : null;
}

function isHiddenEntry(entryPath, name) {
  // Spawning attrib.exe per file causes severe performance issues.
  // Instead, use basic naming conventions or skip hidden attribute check for now
  // to achieve Explorer-like performance.
  return name.startsWith('.') || name === '$RECYCLE.BIN' || name === 'System Volume Information';
}

async function readDir(dirPath) {
  const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });

  const entries = [];
  const BATCH_SIZE = 50; // Limit concurrent fs.stat calls for low-end device RAM optimization

  for (let i = 0; i < dirents.length; i += BATCH_SIZE) {
    const chunk = dirents.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(chunk.map(async (dirent) => {
      try {
        const entryPath = path.join(dirPath, dirent.name);
        const stats = await fs.promises.stat(entryPath);
        return {
          name: dirent.name,
          path: entryPath,
          is_dir: dirent.isDirectory(),
          size: stats.size,
          extension: path.extname(dirent.name).replace('.', ''),
          created_at: toEpoch(stats.birthtime),
          modified_at: toEpoch(stats.mtime),
          accessed_at: toEpoch(stats.atime),
          is_hidden: isHiddenEntry(entryPath, dirent.name),
        };
      } catch {
        return null;
      }
    }));
    entries.push(...results.filter(Boolean));
  }

  return entries;
}

function copyFileWithProgress(source, dest, onProgress) {
  return new Promise((resolve, reject) => {
    fs.stat(source, (err, stats) => {
      if (err) return reject(err);

      const totalBytes = stats.size;
      let copiedBytes = 0;
      let lastReportTime = Date.now();
      let lastReportBytes = 0;
      const startTime = Date.now();

      const readStream = fs.createReadStream(source);
      const writeStream = fs.createWriteStream(dest);

      readStream.on('error', reject);
      writeStream.on('error', reject);

      readStream.on('data', (chunk) => {
        copiedBytes += chunk.length;
        const now = Date.now();
        // Report progress every 300ms
        if (now - lastReportTime > 300) {
          const deltaSec = (now - lastReportTime) / 1000;
          const speed = (copiedBytes - lastReportBytes) / deltaSec;
          const elapsed = (now - startTime) / 1000;
          if (onProgress) onProgress({ copiedBytes, totalBytes, speed, elapsed });
          lastReportTime = now;
          lastReportBytes = copiedBytes;
        }
      });

      writeStream.on('finish', () => resolve());
      readStream.pipe(writeStream);
    });
  });
}

async function copyRecursive(source, dest, onProgress, globalStats = { copiedBytes: 0, totalBytes: 0, startTime: Date.now() }) {
  const stats = await fs.promises.stat(source);
  if (!stats.isDirectory()) {
    globalStats.totalBytes += stats.size; // Increment total bytes for directory copy roughly
    await copyFileWithProgress(source, dest, (progress) => {
      if (onProgress) {
        // Forward per-file progress up
        onProgress(progress);
      }
    });
    return;
  }

  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(source);
  for (const entry of entries) {
    await copyRecursive(path.join(source, entry), path.join(dest, entry), onProgress, globalStats);
  }
}

async function moveRecursiveFallback(source, dest, onProgress) {
  try {
    await fs.promises.rename(source, dest);
  } catch (err) {
    if (err.code === 'EXDEV') {
      // Cross-device link error, must copy and delete
      await copyRecursive(source, dest, onProgress);
      await deleteRecursive(source);
    } else {
      throw err;
    }
  }
}

async function deleteRecursive(targetPath) {
  await fs.promises.rm(targetPath, { recursive: true, force: true });
}

function find7z() {
  const candidates = [
    path.join(process.cwd(), '..', '7zip-26.01', 'x64', '7z.exe'),
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe',
    '7z',
  ];
  return candidates.find((candidate) => candidate === '7z' || fs.existsSync(candidate));
}

function run7z(args) {
  return new Promise((resolve, reject) => {
    const sevenZip = find7z();
    execFile(sevenZip, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

function parse7zList(stdout, archivePath) {
  const entries = [];
  for (const block of stdout.split(/\r?\n\r?\n/)) {
    const item = {};
    for (const line of block.split(/\r?\n/)) {
      const [key, ...rest] = line.split(' = ');
      if (rest.length) item[key.trim()] = rest.join(' = ').trim();
    }

    if (!item.Path || item.Path === archivePath) continue;
    const entryName = path.basename(item.Path);
    if (!entryName) continue;

    entries.push({
      name: entryName,
      path: `${archivePath}\\${item.Path}`,
      is_dir: item.Folder === '+',
      size: Number(item.Size || 0),
      extension: path.extname(entryName).replace('.', ''),
      created_at: null,
      modified_at: null,
      accessed_at: null,
      is_hidden: false,
    });
  }
  return entries;
}

async function getFileProperties(filePath) {
  const stats = await fs.promises.stat(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    size: stats.size,
    is_dir: stats.isDirectory(),
    is_readonly: false,
    is_hidden: isHiddenEntry(filePath, path.basename(filePath)),
    is_system: false,
    created_at: toEpoch(stats.birthtime),
    modified_at: toEpoch(stats.mtime),
    accessed_at: toEpoch(stats.atime),
  };
}

function getLocalAddress() {
  const interfaces = os.networkInterfaces();
  for (const values of Object.values(interfaces)) {
    for (const item of values || []) {
      if (item.family === 'IPv4' && !item.internal) return item.address;
    }
  }
  return '127.0.0.1';
}

function getShellFolders() {
  const home = os.homedir();
  return {
    home,
    homeLabel: path.basename(home) || 'User',
    desktop: path.join(home, 'Desktop'),
    documents: path.join(home, 'Documents'),
    downloads: path.join(home, 'Downloads'),
    pictures: path.join(home, 'Pictures'),
    music: path.join(home, 'Music'),
    videos: path.join(home, 'Videos'),
  };
}

async function sendLocalShareFiles(targets, filePaths) {
  const selectedTargets = Array.isArray(targets) ? targets.filter((target) => target && target.ip) : [];
  const selectedPaths = Array.isArray(filePaths) ? filePaths.filter(Boolean) : [];

  if (!selectedTargets.length) {
    throw new Error('Select at least one target device.');
  }

  if (!selectedPaths.length) {
    throw new Error('Select at least one file to send.');
  }

  const sourceFiles = [];

  async function addFilesRecursively(targetPath, rootDir = '') {
    const stats = await fs.promises.stat(targetPath);
    if (stats.isDirectory()) {
      const folderName = path.basename(targetPath);
      const newRoot = rootDir ? path.join(rootDir, folderName) : folderName;
      const entries = await fs.promises.readdir(targetPath);
      for (const entry of entries) {
        await addFilesRecursively(path.join(targetPath, entry), newRoot);
      }
    } else {
      sourceFiles.push({
        path: targetPath,
        name: rootDir ? path.join(rootDir, path.basename(targetPath)).replace(/\\/g, '/') : path.basename(targetPath),
        size: stats.size,
      });
    }
  }

  for (const sourcePath of selectedPaths) {
    await addFilesRecursively(sourcePath);
  }

  if (!sourceFiles.length) {
    throw new Error('No valid files found to send.');
  }

  const senderInfo = getDeviceInfo();

  const results = await Promise.all(selectedTargets.map(async (target) => {
    const port = target.port || 53317;
    const protocol = target.https ? 'https' : 'http';
    const baseUrl = `${protocol}://${target.ip}:${port}`;

    try {
      const files = {};
      const fileDefs = [];

      for (let index = 0; index < sourceFiles.length; index += 1) {
        const file = sourceFiles[index];
        const fileId = `file-${index + 1}`;
        files[fileId] = {
          fileName: file.name,
          size: file.size,
        };
        fileDefs.push({
          fileId,
          fileName: file.name,
          path: file.path,
          size: file.size
        });
      }

      const prepareResponse = await fetch(`${baseUrl}/api/localsend/v2/prepare-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ info: senderInfo, files }),
      });

      if (!prepareResponse.ok) {
        throw new Error(`Prepare upload failed (${prepareResponse.status})`);
      }

      const prepareData = await prepareResponse.json();
      const sessionId = prepareData.sessionId;
      const tokens = prepareData.files || {};
      const resumeOffsets = prepareData.resumeOffsets || {};

      if (!sessionId) {
        throw new Error('Missing LocalSend session id.');
      }

      for (const payload of fileDefs) {
        const token = tokens[payload.fileId];
        if (!token) {
          throw new Error(`Missing upload token for ${payload.fileName}`);
        }

        const offset = resumeOffsets[payload.fileId] || 0;
        const uploadUrl = `${baseUrl}/api/localsend/v2/upload?sessionId=${encodeURIComponent(sessionId)}&fileId=${encodeURIComponent(payload.fileId)}&token=${encodeURIComponent(token)}&offset=${offset}`;

        await new Promise((resolveUpload, rejectUpload) => {
          const reqModule = target.https ? require('node:https') : require('node:http');
          const parsedUrl = new URL(uploadUrl);

          const req = reqModule.request(parsedUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' }
          }, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolveUpload();
            } else {
              rejectUpload(new Error(`Upload failed for ${payload.fileName} (${res.statusCode})`));
            }
          });

          req.on('error', rejectUpload);

          const readStream = fs.createReadStream(payload.path, { start: offset });
          readStream.pipe(req);
        });
      }

      return {
        target: {
          ip: target.ip,
          port,
          alias: target.alias || target.ip,
        },
        ok: true,
        fileCount: sourceFiles.length,
      };
    } catch (error) {
      return {
        target: {
          ip: target.ip,
          port,
          alias: target.alias || target.ip,
        },
        ok: false,
        error: error.message || String(error),
      };
    }
  }));

  return { results };
}

function startDiscovery() {
  if (discoverySocket) return;
  discoverySocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  discoverySocket.on('message', (message, remote) => {
    try {
      const payload = JSON.parse(message.toString());
      mainWindow?.webContents.send('nex:event', {
        event: 'device-discovered',
        payload: { ip: remote.address, ...payload },
      });
    } catch {
      // Ignore non-NexExplorer multicast packets.
    }
  });
  discoverySocket.bind(53317, () => {
    discoverySocket.setBroadcast(true);
    try {
      discoverySocket.addMembership('224.0.0.167');
    } catch {
      // Some adapters reject multicast membership; broadcast still works.
    }
  });
}

function announceDevice() {
  startDiscovery();
  const payload = Buffer.from(JSON.stringify({
    version: '2.1',
    port: 53317,
    https: false,
    fingerprint: os.hostname(),
    alias: os.hostname(),
    device_model: os.type(),
    device_type: 'desktop',
    download: true,
  }));
  discoverySocket.send(payload, 53317, '255.255.255.255');
}

let currentWatcher = null;
let currentWatcherPath = null;

function registerIpcHandlers() {
  ipcMain.handle('nex:invoke', async (_event, command, args = {}) => {
    switch (command) {
      case 'watch_path': {
        const target = args.path;
        if (currentWatcher) {
          currentWatcher.close();
          currentWatcher = null;
        }
        try {
          if (target && fs.existsSync(target)) {
            const stats = fs.statSync(target);
            if (stats.isDirectory()) {
              currentWatcherPath = target;
              currentWatcher = fs.watch(target, { persistent: false }, (eventType, filename) => {
                mainWindow?.webContents.send('nex:event', {
                  event: 'directory_changed',
                  payload: { path: target, eventType, filename }
                });
              });
            }
          }
          return true;
        } catch (e) {
          return false;
        }
      }
      case 'unwatch_path': {
        if (currentWatcher) {
          currentWatcher.close();
          currentWatcher = null;
        }
        currentWatcherPath = null;
        return true;
      }
      case 'read_dir':
        return readDir(args.path);
      case 'copy_file':
        return copyRecursive(args.source, args.dest);
      case 'copy_files': {
        const { sources, destDir } = args;
        for (let i = 0; i < sources.length; i++) {
          const source = sources[i];
          const fileName = path.basename(source);
          await copyRecursive(source, path.join(destDir, fileName), (prog) => {
            mainWindow?.webContents.send('nex:event', {
              event: 'progress',
              payload: { type: 'copy', current: i + 1, total: sources.length, name: fileName, ...prog }
            });
          });
          mainWindow?.webContents.send('nex:event', { event: 'progress_complete', payload: { type: 'copy', current: i + 1, total: sources.length, name: fileName } });
        }
        return true;
      }
      case 'move_file':
        return moveRecursiveFallback(args.source, args.dest);
      case 'move_files': {
        const { sources, destDir } = args;
        for (let i = 0; i < sources.length; i++) {
          const source = sources[i];
          const fileName = path.basename(source);
          await moveRecursiveFallback(source, path.join(destDir, fileName), (prog) => {
            mainWindow?.webContents.send('nex:event', {
              event: 'progress',
              payload: { type: 'move', current: i + 1, total: sources.length, name: fileName, ...prog }
            });
          });
          mainWindow?.webContents.send('nex:event', { event: 'progress_complete', payload: { type: 'move', current: i + 1, total: sources.length, name: fileName } });
        }
        return true;
      }
      case 'delete_file':
        return deleteRecursive(args.path);
      case 'trash_items': {
        // B7/B8 fix: move files to recycle bin instead of permanent deletion.
        const { paths } = args;
        const results = [];
        for (let i = 0; i < paths.length; i++) {
          const target = paths[i];
          try {
            await shell.trashItem(target);
            results.push({ path: target, ok: true });
          } catch (e) {
            results.push({ path: target, ok: false, error: e.message || String(e) });
          }
          mainWindow?.webContents.send('nex:event', { event: 'progress', payload: { type: 'trash', current: i + 1, total: paths.length, name: path.basename(target) } });
        }
        return results;
      }
      case 'delete_files': {
        const { paths } = args;
        for (let i = 0; i < paths.length; i++) {
          const target = paths[i];
          await deleteRecursive(target);
          mainWindow?.webContents.send('nex:event', { event: 'progress', payload: { type: 'delete', current: i + 1, total: paths.length, name: path.basename(target) } });
        }
        return true;
      }
      case 'rename_file':
        return fs.promises.rename(args.path, path.join(path.dirname(args.path), args.newName));
      case 'create_folder':
        return fs.promises.mkdir(args.path, { recursive: true });
      case 'get_file_properties':
        return getFileProperties(args.path);
      case 'list_archive':
        return parse7zList(await run7z(['l', '-slt', args.path]), args.path);
      case 'extract_archive':
        return run7z(['x', args.archivePath, `-o${args.destDir}`, '-y']);
      case 'create_archive':
        return run7z(['a', args.archivePath, ...(args.sourcePaths || [])]);
      case 'start_discovery':
        return startDiscovery();
      case 'send_multicast_announcement':
        return announceDevice();
      case 'get_local_device':
        return { ip: getLocalAddress(), port: 53317, alias: os.hostname() };
      case 'get_shell_folders':
        return getShellFolders();
      case 'get_drives': {
        // Return basic drive info: letter, path, label, drive_type, total_space, free_space
        // Use WMIC on Windows to get accurate size data; fallback to detecting roots.
        try {
          const stdout = require('child_process').execFileSync('wmic', ['logicaldisk', 'get', 'DeviceID,VolumeName,DriveType,FreeSpace,Size', '/format:csv'], { windowsHide: true, encoding: 'utf8' });
          const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          // CSV header present; parse rows
          const results = [];
          for (const line of lines.slice(1)) {
            const parts = line.split(',');
            if (parts.length < 6) continue;
            // WMIC CSV: Node,DeviceID,DriveType,FreeSpace,Size,VolumeName
            const device = parts[1];
            const driveType = parts[2];
            const free = Number(parts[3] || 0);
            const size = Number(parts[4] || 0);
            const label = parts[5] || '';
            if (!device) continue;
            results.push({
              letter: device.replace(':', ''),
              path: device + '\\',
              label: label || '',
              drive_type: String(driveType),
              total_space: size,
              free_space: free,
            });
          }
          if (results.length) return results;
        } catch (e) {
          // ignore and fallback to simple detection
        }

        // Fallback: detect existing drive roots A:..Z:
        const drives = [];
        for (let c = 65; c <= 90; c++) {
          const letter = String.fromCharCode(c);
          const p = letter + ':\\';
          try {
            if (fs.existsSync(p)) {
              drives.push({ letter, path: p, label: '', drive_type: 'unknown', total_space: 0, free_space: 0 });
            }
          } catch (e) { }
        }
        return drives;
      }
      case 'localshare_send_files':
        return sendLocalShareFiles(args.targets || [], args.filePaths || []);
      case 'localsend_accept':
        const localsend = require('./localsend.cjs');
        return localsend.acceptSession(args.sessionId);
      case 'localsend_reject':
        const localsend2 = require('./localsend.cjs');
        return localsend2.rejectSession(args.sessionId);
      case 'localsend_set_config':
        const localsend3 = require('./localsend.cjs');
        return localsend3.setConfig(args.config);
      case 'shell_execute':
        const { exec } = require('child_process');
        return new Promise((resolve, reject) => {
          exec(`start ${args.program}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      case 'open_with':
        return new Promise((resolve) => {
          execFile('rundll32.exe', ['shell32.dll,OpenAs_RunDLLW', args.path], () => resolve());
        });
      case 'compress_file':
        return run7z(['a', args.path + '.zip', args.path]);
      case 'show_in_explorer':
        shell.showItemInFolder(args.path);
        return;
      case 'show_properties':
        return new Promise((resolve) => {
          const psCmd = `$obj = New-Object -ComObject Shell.Application; $folder = $obj.NameSpace([System.IO.Path]::GetDirectoryName('${args.path.replace(/'/g, "''")}')); $file = $folder.ParseName([System.IO.Path]::GetFileName('${args.path.replace(/'/g, "''")}')); if ($file) { $file.InvokeVerb('properties') }`;
          execFile('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', psCmd], () => resolve());
        });
      case 'compress_files':
        return run7z(['a', args.paths[0] + '.zip', ...(args.paths || [])]);
      case 'get_disk_space':
        return new Promise((resolve, reject) => {
          const drive = args.drive || 'C:';
          execFile('wmic', ['logicaldisk', 'where', `DeviceID='${drive}'`, 'get', 'FreeSpace,Size', '/VALUE'], { windowsHide: true }, (error, stdout) => {
            if (error) {
              // Fallback: try PowerShell
              execFile('powershell', ['-NoProfile', '-Command', `Get-PSDrive -Name '${drive[0]}' | Select-Object Free,Used | ConvertTo-Json`], { windowsHide: true }, (err2, stdout2) => {
                if (err2) return resolve({ free: 0, total: 0 });
                try {
                  const data = JSON.parse(stdout2);
                  resolve({ free: data.Free || 0, total: (data.Free || 0) + (data.Used || 0) });
                } catch {
                  resolve({ free: 0, total: 0 });
                }
              });
              return;
            }
            const freeMatch = stdout.match(/FreeSpace=(\d+)/);
            const sizeMatch = stdout.match(/Size=(\d+)/);
            resolve({
              free: freeMatch ? Number(freeMatch[1]) : 0,
              total: sizeMatch ? Number(sizeMatch[1]) : 0,
            });
          });
        });
      case 'get_folder_size':
        return new Promise(async (resolve) => {
          let totalSize = 0;
          let fileCount = 0;
          let folderCount = 0;
          async function calculate(currentPath) {
            try {
              const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
              for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                  folderCount++;
                  await calculate(fullPath);
                } else {
                  fileCount++;
                  try {
                    const stats = await fs.promises.stat(fullPath);
                    totalSize += stats.size;
                  } catch { }
                }
              }
            } catch { }
          }
          await calculate(args.path);
          resolve({ size: totalSize, files: fileCount, folders: folderCount });
        });
      case 'toggle_localsend':
        if (args.enabled) {
          startLocalSendServer(mainWindow);
        } else {
          stopLocalSendServer();
        }
        return true;
      case 'pick_files':
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: args.properties || ['openFile', 'multiSelections']
        });
        return result.filePaths;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  });

  ipcMain.handle('nex:open-path', (_event, filePath) => shell.openPath(filePath));
  ipcMain.handle('nex:window', (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    if (action === 'minimize') win.minimize();
    if (action === 'toggleMaximize') win.isMaximized() ? win.unmaximize() : win.maximize();
    if (action === 'close') win.close();
    if (action === 'isMaximized') return win.isMaximized();
    return true;
  });
}
