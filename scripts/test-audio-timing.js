// scripts/test-audio-timing.js
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ytdlp = path.join(__dirname, '..', 'yt-dlp.exe');
const ffmpeg = path.join(__dirname, '..', 'ffmpeg.exe');

const outputDir = path.join(__dirname, '..', 'temp_test_downloads');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

async function measureAudio(platformName, url, extractFn) {
  console.log(`\n========================================`);
  console.log(`ĐO TỐC ĐỘ AUDIO: ${platformName}`);
  console.log(`URL: ${url}`);
  console.log(`========================================`);

  const tStart = Date.now();
  let tExtracted = 0;
  let tDownloaded = 0;
  let audioUrl = '';
  let filename = '';
  let fileSize = 0;

  try {
    // Giai đoạn (b): Trích xuất link stream audio trực tiếp
    const t0 = Date.now();
    const result = await extractFn(url);
    tExtracted = Date.now() - t0;
    audioUrl = result.url;
    filename = result.filename;
    console.log(`(b) Thời gian trích xuất link stream: ${tExtracted} ms`);

    // Giai đoạn (c) & (d): Tải file stream về
    const tDownloadStart = Date.now();
    const tempFile = path.join(outputDir, `timing_${platformName}_${Date.now()}.source`);
    const res = await fetch(audioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(tempFile, Buffer.from(buffer));
    tDownloaded = Date.now() - tDownloadStart;
    fileSize = buffer.byteLength;

    console.log(`(d) Thời gian tải file audio về (${(fileSize / 1024).toFixed(1)} KB): ${tDownloaded} ms`);
    const totalTime = Date.now() - tStart;
    console.log(`(Tổng cộng): ${(totalTime / 1000).toFixed(2)} giây`);

    return {
      platform: platformName,
      extractMs: tExtracted,
      downloadMs: tDownloaded,
      totalSec: (totalTime / 1000).toFixed(2),
      sizeKB: (fileSize / 1024).toFixed(1),
      status: 'OK',
    };
  } catch (err) {
    console.error(`Lỗi ${platformName}:`, err.message);
    return {
      platform: platformName,
      extractMs: tExtracted,
      downloadMs: tDownloaded,
      totalSec: ((Date.now() - tStart) / 1000).toFixed(2),
      sizeKB: 0,
      status: `FAIL: ${err.message}`,
    };
  }
}

async function run() {
  // 1. YouTube: lấy format 140 (AAC source, only for timing measurement)
  const ytExtract = async (url) => {
    const cmd = `"${ytdlp}" -f 140/bestaudio -g "${url}"`;
    const out = execSync(cmd, { encoding: 'utf8' }).trim().split('\n').filter(l => l.startsWith('http'));
    return { url: out[0], filename: 'youtube.source' };
  };

  // 2. TikTok: lấy direct audio qua TikWM
  const tiktokExtract = async (url) => {
    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
    const json = await res.json();
    const musicUrl = json.data?.music || json.data?.play;
    return { url: musicUrl, filename: 'tiktok.mp3' };
  };

  // 3. Facebook: lấy direct qua FDown
  const fbExtract = async (url) => {
    const res = await fetch('https://fdown.co.in/ajax', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://fdown.co.in',
        'Referer': 'https://fdown.co.in/',
      },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    const links = json.links || {};
    const downloadUrl = links['Download Video in HD Quality'] || links['Download Video'] || Object.values(links)[0];
    return { url: downloadUrl, filename: 'facebook.mp4' };
  };

  const table = [];
  table.push(await measureAudio('YouTube', 'https://youtu.be/wirc5PFn2KU', ytExtract));
  table.push(await measureAudio('TikTok', 'https://vt.tiktok.com/ZSg7RfKSL/', tiktokExtract));
  table.push(await measureAudio('Facebook', 'https://www.facebook.com/share/r/15o3YqM3kZ/', fbExtract));

  console.log('\n=== BẢNG TỔNG HỢP THỜI GIAN TẢI AUDIO (3 NỀN TẢNG THẬT) ===');
  console.table(table);
}

run();

