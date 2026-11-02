/* Usage: set SNAP_SERVER_URL=http://127.0.0.1:4000 && node scripts/smoke-test.js */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const configPath = path.join(root, 'test-links.json');
const outputPath = path.join(root, 'SMOKE_BASELINE.md');
const tempDir = path.join(root, 'temp_test_downloads');
const baseUrl = (process.env.SNAP_SERVER_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const ffprobe = path.join(root, 'ffprobe.exe');
const ffmpeg = path.join(root, 'ffmpeg.exe');

if (!fs.existsSync(configPath)) {
  console.error('Missing test-links.json. Copy test-links.example.json and add only public test links (file is gitignored).');
  process.exit(2);
}
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] });
}

async function fetchWithTimeout(url, options = {}, timeout = 180000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function decodeDuration(file) {
  const output = run(ffmpeg, ['-v', 'error', '-progress', 'pipe:1', '-nostats', '-i', file, '-f', 'null', '-']);
  const times = [...output.matchAll(/out_time_us=(\d+)/g)];
  return times.length ? Number(times.at(-1)[1]) / 1e6 : 0;
}

async function oneCase(platform, url, mode, index) {
  const started = Date.now();
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, mode, quality: 'best' }),
    });
    const job = await response.json();
    if (!response.ok || !job.success) return { platform, mode, url, pass: false, reason: job.code || `HTTP_${response.status}`, seconds: ((Date.now() - started) / 1000).toFixed(1) };
    const mediaResponse = await fetchWithTimeout(job.url, {}, 120000);
    if (!mediaResponse.ok) return { platform, mode, url, pass: false, reason: `DOWNLOAD_HTTP_${mediaResponse.status}`, seconds: ((Date.now() - started) / 1000).toFixed(1) };
    const bytes = Buffer.from(await mediaResponse.arrayBuffer());
    const file = path.join(tempDir, `${platform}_${mode}_${index}${mode === 'audio' ? '.mp3' : '.mp4'}`);
    fs.writeFileSync(file, bytes);
    const probe = JSON.parse(run(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]));
    const duration = Number(probe.format?.duration || 0);
    const decoded = decodeDuration(file);
    const video = probe.streams.find((stream) => stream.codec_type === 'video');
    const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const extensionOk = mode === 'audio' ? job.filename.endsWith('.mp3') : job.filename.endsWith('.mp4');
    const streamOk = mode === 'audio'
      ? audio?.codec_name === 'mp3' && !video
      : ['h264', 'hevc'].includes(video?.codec_name) && video?.pix_fmt === 'yuv420p' && audio?.codec_name === 'aac';
    const durationOk = duration > 0 && decoded > 0 && Math.abs(duration - decoded) <= 0.5;
    const sizeOk = Number(job.metadata?.size || 0) === bytes.length;
    const hashOk = !job.metadata?.sha256 || job.metadata.sha256 === sha256;
    const pass = extensionOk && streamOk && durationOk && sizeOk && hashOk;
    return { platform, mode, url, pass, reason: pass ? 'OK' : `ext=${extensionOk} stream=${streamOk} duration=${durationOk} size=${sizeOk} sha=${hashOk}`, seconds: ((Date.now() - started) / 1000).toFixed(1), file: job.filename, bytes: bytes.length, duration, decoded, video: video ? `${video.codec_name}/${video.width}x${video.height}` : '-', audio: audio?.codec_name || '-', sha256 };
  } catch (error) {
    return { platform, mode, url, pass: false, reason: error.message.split('\n')[0], seconds: ((Date.now() - started) / 1000).toFixed(1) };
  }
}

async function main() {
  const links = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const cases = Object.entries(links).flatMap(([platform, urls]) => (urls || []).flatMap((url, index) => ['video', 'audio'].map((mode) => ({ platform, url, mode, index }))));
  if (!cases.length) throw new Error('test-links.json does not contain test URLs.');
  const results = [];
  for (const item of cases) results.push(await oneCase(item.platform, item.url, item.mode, item.index));
  const lines = ['# Snap Video smoke baseline', '', `Backend: ${baseUrl}`, `Run: ${new Date().toISOString()}`, '', '| Platform | Mode | Result | Detail | Seconds |', '|---|---|---|---|---:|'];
  for (const item of results) lines.push(`| ${item.platform} | ${item.mode} | ${item.pass ? 'PASS' : 'FAIL'} | ${item.reason} | ${item.seconds} |`);
  lines.push('', '## Media details', '', '```json', JSON.stringify(results, null, 2), '```', '');
  fs.writeFileSync(outputPath, lines.join('\n'));
  console.table(results.map(({ platform, mode, pass, reason, seconds }) => ({ platform, mode, result: pass ? 'PASS' : 'FAIL', reason, seconds })));
  console.log(`Saved ${outputPath}`);
  process.exitCode = results.some((item) => !item.pass) ? 1 : 0;
}

main().catch((error) => { console.error(error.message); process.exit(2); });
