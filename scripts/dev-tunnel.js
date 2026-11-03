// scripts/dev-tunnel.js
// Khởi động theo đúng thứ tự:
// 1. Snap Server (port 4000)
// 2. Localtunnel → lấy URL → ghi .env.local
// 3. Expo Metro Tunnel (đọc URL mới từ .env.local)

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ENV_LOCAL_PATH = path.join(__dirname, '..', '.env.local');
const SNAP_PORT = 4000;
const isWindows = process.platform === 'win32';
const npx = isWindows ? 'npx.cmd' : 'npx';

// ─── .env.local helpers ──────────────────────────────────────────────────────

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
  fs.writeFileSync(ENV_LOCAL_PATH, content.endsWith('\n') ? content : content + '\n', 'utf8');
  console.log(`[DEV-TUNNEL] ✅ EXPO_PUBLIC_SNAP_SERVER_URL=${url}`);
}

// ─── 1. Snap Server ──────────────────────────────────────────────────────────

function startSnapServer() {
  return new Promise((resolve) => {
    console.log('[SNAP-SERVER] Khởi chạy port 4000...');
    const proc = spawn('node', [path.join(__dirname, 'snap-server.js')], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    proc.stdout.on('data', (d) => {
      const text = d.toString().trim();
      process.stdout.write('[SNAP-SERVER] ' + text + '\n');
      if (text.includes('4000') || text.includes('listening') || text.includes('lắng nghe')) {
        resolve(proc);
      }
    });
    proc.stderr.on('data', (d) => process.stderr.write('[SNAP-SERVER-ERR] ' + d));

    proc.on('close', (code) => {
      console.warn(`[SNAP-SERVER] Kết thúc (code ${code}). Khởi động lại sau 2s...`);
      setTimeout(() => startSnapServer().then(resolve), 2000);
    });
    proc.on('error', (err) => {
      console.error('[SNAP-SERVER] Lỗi:', err.message);
      setTimeout(() => startSnapServer().then(resolve), 2000);
    });

    // Timeout fallback: coi như server đã lên sau 3s
    setTimeout(() => resolve(proc), 3000);
  });
}

// ─── 2. Localtunnel cho port 4000 ────────────────────────────────────────────

function startTunnel() {
  return new Promise((resolve) => {
    console.log('[SNAP-TUNNEL] Tạo public tunnel cho port 4000...');

    function tryTunnel() {
      const lt = spawn(npx, ['--yes', 'localtunnel', '--port', String(SNAP_PORT)], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: isWindows,
      });

      let resolved = false;

      lt.stdout.on('data', (data) => {
        const text = data.toString().trim();
        if (text) process.stdout.write('[SNAP-TUNNEL] ' + text + '\n');
        const match = text.match(/(https?:\/\/[^\s]+\.loca\.lt)/);
        if (match && !resolved) {
          resolved = true;
          const tunnelUrl = match[1];
          writeSnapUrl(tunnelUrl);
          console.log('[SNAP-TUNNEL] 🌐 Tunnel URL:', tunnelUrl);
          console.log('[SNAP-TUNNEL] iPhone dùng mạng bất kỳ đều kết nối được.');
          resolve({ proc: lt, url: tunnelUrl });
        }
      });

      lt.stderr.on('data', (d) => {
        const text = d.toString().trim();
        if (text) process.stderr.write('[SNAP-TUNNEL-ERR] ' + text + '\n');
      });

      lt.on('close', (code) => {
        console.warn(`[SNAP-TUNNEL] Tunnel đóng (code ${code}). Tạo lại sau 5s...`);
        resolved = false;
        setTimeout(tryTunnel, 5000);
      });

      lt.on('error', (err) => {
        console.error('[SNAP-TUNNEL] Lỗi:', err.message);
        setTimeout(tryTunnel, 5000);
      });
    }

    tryTunnel();
  });
}

// ─── 3. Expo Metro ───────────────────────────────────────────────────────────

function startMetro() {
  console.log('[METRO] Khởi chạy Expo Metro Tunnel...');
  const child = spawn(npx, ['expo', 'start', '--tunnel', '-c'], {
    stdio: 'inherit',
    shell: isWindows,
    env: { ...process.env, NODE_OPTIONS: '--dns-result-order=ipv4first' },
  });

  child.on('close', (code) => {
    console.warn(`[METRO] Kết thúc (code ${code}). Khởi động lại sau 3s...`);
    setTimeout(startMetro, 3000);
  });
  child.on('error', (err) => {
    console.error('[METRO] Lỗi:', err.message);
    setTimeout(startMetro, 3000);
  });
}

// ─── Main: đúng thứ tự ───────────────────────────────────────────────────────

(async () => {
  // Bước 1: Snap server lên trước
  await startSnapServer();
  console.log('[DEV-TUNNEL] Snap server sẵn sàng.');

  // Bước 2: Tạo tunnel, chờ URL
  console.log('[DEV-TUNNEL] Chờ tunnel URL (tối đa 30s)...');
  const tunnelTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Tunnel timeout')), 30000)
  );
  let tunnelUrl = null;
  try {
    const result = await Promise.race([startTunnel(), tunnelTimeout]);
    tunnelUrl = result.url;
  } catch (err) {
    console.warn('[DEV-TUNNEL] ⚠️ Không lấy được tunnel URL:', err.message);
    console.warn('[DEV-TUNNEL] Tiếp tục với URL hiện tại trong .env.local...');
  }

  // Bước 3: Metro start (đọc URL đã cập nhật)
  console.log('[DEV-TUNNEL] Khởi chạy Metro với URL:', tunnelUrl || readEnvLocal());
  startMetro();
})();
