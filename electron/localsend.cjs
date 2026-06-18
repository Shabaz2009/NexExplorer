const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { app } = require('electron');

let server;
let activeSessions = new Map();
let mainWindow;
let config = {
  alias: os.hostname(),
  port: 53317,
  saveDirectory: '',
  autoAccept: true,
};

function setConfig(newConfig) {
  config = { ...config, ...newConfig };
}

function getUniqueFileName(dir, fileName) {
  let name = fileName;
  let ext = '';
  const extIndex = fileName.lastIndexOf('.');
  if (extIndex > 0) {
    name = fileName.substring(0, extIndex);
    ext = fileName.substring(extIndex);
  }

  let counter = 0;
  let currentName = fileName;
  let currentPath = path.join(dir, currentName);
  while (fs.existsSync(currentPath)) {
    counter++;
    currentName = `${name} (${counter})${ext}`;
    currentPath = path.join(dir, currentName);
  }
  return currentName;
}

function getDeviceInfo() {
  return {
    version: '2.1',
    port: config.port,
    https: false,
    fingerprint: os.hostname(),
    alias: config.alias || os.hostname(),
    deviceModel: os.type(),
    deviceType: 'desktop',
    download: true,
  };
}

function startLocalSendServer(win) {
  mainWindow = win;
  if (server) return;

  server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = url.pathname;

    if (req.method === 'GET' && pathname === '/api/localsend/v2/info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(getDeviceInfo()));
    }

    if (req.method === 'POST' && pathname === '/api/localsend/v2/prepare-upload') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const sessionId = Date.now().toString();
          const token = Math.random().toString(36).substring(2, 15);
          const savePath = config.saveDirectory || app.getPath('downloads');

          const sessionFiles = {};
          let isText = false;
          let textPreview = '';

          for (const [key, fileDef] of Object.entries(data.files)) {
            if (fileDef.fileType === 'text') {
              isText = true;
              textPreview = fileDef.fileName; // Usually the text snippet or file name
            }
            let safeName = path.basename(fileDef.fileName || 'file').replace(/[^a-zA-Z0-9.\-_ ]/g, '_');
            safeName = getUniqueFileName(savePath, safeName);

            sessionFiles[key] = {
              ...fileDef,
              safeFileName: safeName
            };
          }

          activeSessions.set(sessionId, {
            info: data.info,
            files: sessionFiles,
            token,
            savePath,
            res
          });

          if (mainWindow) {
            mainWindow.webContents.send('nex:event', {
              event: 'receive-request',
              payload: {
                sessionId,
                device: data.info.alias,
                files: data.files,
                autoAccept: config.autoAccept,
                isText,
                textPreview
              }
            });
          }

          if (config.autoAccept || isText) {
            acceptSession(sessionId);
          }
        } catch (e) {
          res.writeHead(400);
          res.end();
        }
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/localsend/v2/upload') {
      const sessionId = url.searchParams.get('sessionId');
      const fileId = url.searchParams.get('fileId');
      const token = url.searchParams.get('token');
      const offset = Number(url.searchParams.get('offset')) || 0;

      const session = activeSessions.get(sessionId);
      if (!session || session.token !== token || !session.files[fileId]) {
        res.writeHead(403);
        return res.end();
      }

      const fileInfo = session.files[fileId];

      if (fileInfo.fileType === 'text') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          if (mainWindow) {
            mainWindow.webContents.send('nex:event', {
              event: 'text-received',
              payload: { text: body, device: session.info.alias }
            });
          }
          res.writeHead(200);
          res.end();
        });
        return;
      }

      const destPath = path.join(session.savePath, fileInfo.safeFileName);
      const partPath = destPath + '.part';

      const writeStream = fs.createWriteStream(partPath, { flags: offset > 0 ? 'a' : 'w' });
      req.pipe(writeStream);

      req.on('end', () => {
        if (fs.existsSync(partPath)) {
          fs.renameSync(partPath, destPath);
        }
        if (mainWindow) {
          mainWindow.webContents.send('nex:event', {
            event: 'file-received',
            payload: { path: destPath, name: fileInfo.fileName }
          });
        }
        res.writeHead(200);
        res.end();
      });

      req.on('error', () => {
        writeStream.close();
        res.writeHead(500);
        res.end();
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/localsend/v2/cancel') {
      const sessionId = url.searchParams.get('sessionId');
      const session = activeSessions.get(sessionId);
      if (session) {
        if (session.res && !session.res.headersSent) {
          session.res.writeHead(403);
          session.res.end();
        }
        for (const fileDef of Object.values(session.files)) {
          const partPath = path.join(session.savePath, fileDef.safeFileName + '.part');
          if (fs.existsSync(partPath)) {
            try { fs.unlinkSync(partPath); } catch (e) { }
          }
        }
      }
      activeSessions.delete(sessionId);
      res.writeHead(200);
      return res.end();
    }

    res.writeHead(404);
    res.end();
  });

  server.on('error', (e) => {
    console.error('LocalSend HTTP server error:', e);
  });

  try {
    server.listen(config.port, '0.0.0.0', () => {
      console.log(`LocalSend HTTP server listening on port ${config.port}`);
    });
  } catch (e) {
    console.error('Failed to bind LocalSend port');
  }
}

function acceptSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session || !session.res || session.res.headersSent) return;

  const fileMap = {};
  const resumeOffsets = {};
  for (const [key, fileDef] of Object.entries(session.files)) {
    fileMap[key] = session.token;

    if (fileDef.fileType !== 'text') {
      const partPath = path.join(session.savePath, fileDef.safeFileName + '.part');
      if (fs.existsSync(partPath)) {
        try {
          const stats = fs.statSync(partPath);
          if (stats.size < fileDef.size) {
            resumeOffsets[key] = stats.size;
          } else {
            fs.unlinkSync(partPath);
          }
        } catch (e) { }
      }
    }
  }

  session.res.writeHead(200, { 'Content-Type': 'application/json' });
  session.res.end(JSON.stringify({ sessionId, files: fileMap, resumeOffsets }));
}

function rejectSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session || !session.res || session.res.headersSent) return;
  session.res.writeHead(403);
  session.res.end();
  activeSessions.delete(sessionId);
}

function stopLocalSendServer() {
  if (server) {
    server.close();
    server = null;
    activeSessions.clear();
  }
}

module.exports = { startLocalSendServer, stopLocalSendServer, setConfig, acceptSession, rejectSession };
