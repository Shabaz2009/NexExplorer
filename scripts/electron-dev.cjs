const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const vite = spawn('npm.cmd', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '1420'], {
  stdio: 'inherit',
  shell: false,
});

let electron;
const devUrl = 'http://127.0.0.1:1420';
const electronBin = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');

const waitForVite = (attemptsLeft = 80) => {
  const request = http.get(devUrl, (response) => {
    response.resume();
    startElectron();
  });

  request.on('error', () => {
    if (attemptsLeft <= 0) {
      console.error(`Timed out waiting for Vite at ${devUrl}`);
      vite.kill();
      process.exit(1);
    }
    setTimeout(() => waitForVite(attemptsLeft - 1), 250);
  });
};

const startElectron = () => {
  if (electron) return;
  const electronEnv = { ...process.env, VITE_DEV_SERVER_URL: devUrl };
  delete electronEnv.ELECTRON_RUN_AS_NODE;

  electron = spawn(electronBin, ['.'], {
    stdio: 'inherit',
    shell: false,
    env: electronEnv,
  });
  electron.on('exit', () => {
    vite.kill();
    process.exit(0);
  });
};

waitForVite();

process.on('SIGINT', () => {
  electron?.kill();
  vite.kill();
});
