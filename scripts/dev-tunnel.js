// scripts/dev-tunnel.js
// Giữ kết nối Expo Metro Tunnel và Snap Video Resolver Server liên tục
const { spawn } = require('child_process');
const path = require('path');

function startSnapServer() {
  console.log('[SNAP-SERVER] Đang khởi chạy Snap Video Backend Resolver (Port 4000)...');
  const snapProcess = spawn('node', [path.join(__dirname, 'snap-server.js')], {
    stdio: 'inherit',
    env: process.env,
  });

  snapProcess.on('close', (code) => {
    console.warn(`[SNAP-SERVER] Snap Server kết thúc (code ${code}). Tự động chạy lại sau 2s...`);
    setTimeout(startSnapServer, 2000);
  });

  snapProcess.on('error', (err) => {
    console.error('[SNAP-SERVER] Lỗi Snap Server:', err.message);
    setTimeout(startSnapServer, 2000);
  });
}

function startMetroTunnel() {
  console.log('[WATCHDOG] Đang khởi chạy Expo Metro Tunnel...');
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'npx.cmd' : 'npx';

  const child = spawn(cmd, ['expo', 'start', '--tunnel', '-c'], {
    stdio: 'inherit',
    shell: isWindows,
    env: {
      ...process.env,
      NODE_OPTIONS: '--dns-result-order=ipv4first',
    },
  });

  child.on('close', (code) => {
    console.warn(`[WATCHDOG] Expo Tunnel kết thúc (code ${code}). Tự động kết nối lại sau 2s...`);
    setTimeout(startMetroTunnel, 2000);
  });

  child.on('error', (err) => {
    console.error('[WATCHDOG] Lỗi khởi chạy:', err.message);
    setTimeout(startMetroTunnel, 2000);
  });
}

startSnapServer();
startMetroTunnel();
