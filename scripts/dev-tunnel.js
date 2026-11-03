// scripts/dev-tunnel.js
// Giữ kết nối Expo Metro Tunnel và Snap Video Resolver Server liên tục.
// Tự động tạo Cloudflare Quick Tunnel cho Snap Server port 4000 và cấp URL cho Metro.
// => App trên iPhone có thể dùng Snap Video mượt mà trên mọi mạng (Wi-Fi khác, 4G, 5G).

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ENV_LOCAL_PATH = path.join(__dirname, '..', '.env.local');
const CLOUDFLARED_PATH = path.join(__dirname, '..', 'cloudflared.exe');
const SNAP_PORT = 4000;

let metroStarted = false;

// ─── Helpers ────────────────────────────────────────────────────────────────

function readEnvLocal() {
  try { return fs.existsSync(ENV_LOCAL_PATH) ? fs.readFileSync(ENV_LOCAL_PATH, 'utf8') : ''; }
  catch { return ''; }
}

function writeSnapUrl(url) {
  let content = readEnvLocal();
  const line = `EXPO_PUBLIC_SNAP_SERVER_URL=${url}`;
  if (content.includes('EXPO_PUBLIC_SNAP_SERVER_URL=')) {
    content = content.replace(/EXPO_PUBLIC_SNAP_SERVER_URL=.*/g, line);
  } else {
    content = content.trim() ? content.trim() + '\n' + line : line;
  }
  fs.writeFileSync(ENV_LOCAL_PATH, content, 'utf8');
  console.log(`[DEV-TUNNEL] Đã lưu vào .env.local: EXPO_PUBLIC_SNAP_SERVER_URL=${url}`);
}

// ─── 1. Snap Server (port 4000) ──────────────────────────────────────────────

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

// ─── 2. Cloudflare Quick Tunnel cho Snap Server ─────────────────────────────

function startCloudflareTunnel() {
  console.log('[SNAP-TUNNEL] Đang khởi tạo Cloudflare Tunnel cho port 4000...');
  const cfProcess = spawn(CLOUDFLARED_PATH, ['tunnel', '--url', `http://localhost:${SNAP_PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  function handleOutput(data) {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match) {
      const publicUrl = match[0];
      console.log(`[SNAP-TUNNEL] ✅ Cloudflare Public URL: ${publicUrl}`);
      writeSnapUrl(publicUrl);

      if (!metroStarted) {
        metroStarted = true;
        startMetroTunnel(publicUrl);
      }
    }
  }

  cfProcess.stdout.on('data', handleOutput);
  cfProcess.stderr.on('data', handleOutput);

  cfProcess.on('close', (code) => {
    console.warn(`[SNAP-TUNNEL] Cloudflare Tunnel kết thúc (code ${code}). Khởi động lại sau 3s...`);
    setTimeout(startCloudflareTunnel, 3000);
  });

  cfProcess.on('error', (err) => {
    console.error('[SNAP-TUNNEL] Lỗi Cloudflare Tunnel:', err.message);
    setTimeout(startCloudflareTunnel, 3000);
  });
}

// ─── 3. Expo Metro Tunnel ────────────────────────────────────────────────────

function startMetroTunnel(snapPublicUrl) {
  console.log('[WATCHDOG] Đang khởi chạy Expo Metro Tunnel với Snap Server URL:', snapPublicUrl);
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'npx.cmd' : 'npx';

  const child = spawn(cmd, ['expo', 'start', '--tunnel', '-c'], {
    stdio: 'inherit',
    shell: isWindows,
    env: {
      ...process.env,
      EXPO_PUBLIC_SNAP_SERVER_URL: snapPublicUrl,
      NODE_OPTIONS: '--dns-result-order=ipv4first',
    },
  });

  child.on('close', (code) => {
    console.warn(`[WATCHDOG] Expo Tunnel kết thúc (code ${code}). Tự động kết nối lại sau 2s...`);
    setTimeout(() => startMetroTunnel(snapPublicUrl), 2000);
  });

  child.on('error', (err) => {
    console.error('[WATCHDOG] Lỗi khởi chạy Metro:', err.message);
    setTimeout(() => startMetroTunnel(snapPublicUrl), 2000);
  });
}

// ─── Khởi động tuần tự ───────────────────────────────────────────────────────
startSnapServer();
startCloudflareTunnel();
