// scripts/dev-tunnel.js
// Giữ kết nối Expo Metro Tunnel liên tục, tự động khôi phục kết nối khi mạng chập chờn
const { spawn } = require('child_process');

function start() {
  console.log('[WATCHDOG] Đang khởi chạy Expo Metro Tunnel...');
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'npx.cmd' : 'npx';

  const child = spawn(cmd, ['expo', 'start', '--tunnel'], {
    stdio: 'inherit',
    shell: isWindows,
    env: {
      ...process.env,
      NODE_OPTIONS: '--dns-result-order=ipv4first',
    },
  });

  child.on('close', (code) => {
    console.warn(`[WATCHDOG] Expo Tunnel kết thúc (code ${code}). Tự động kết nối lại sau 2s...`);
    setTimeout(start, 2000);
  });

  child.on('error', (err) => {
    console.error('[WATCHDOG] Lỗi khởi chạy:', err.message);
    setTimeout(start, 2000);
  });
}

start();
