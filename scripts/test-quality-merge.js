// scripts/test-quality-merge.js
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const testUrl = 'https://youtu.be/wirc5PFn2KU';
const ytdlp = path.join(__dirname, '..', 'yt-dlp.exe');
const ffmpeg = path.join(__dirname, '..', 'ffmpeg.exe');
const ffprobe = path.join(__dirname, '..', 'ffprobe.exe');

const outputDir = path.join(__dirname, '..', 'temp_test_downloads');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

async function testDownload(quality, targetHeight) {
  const outputFile = path.join(outputDir, `test_${quality}.mp4`);
  if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

  const formatSelector = targetHeight
    ? `bv*[height<=${targetHeight}][vcodec^=avc1]+ba[acodec^=mp4a]/bv*[height<=${targetHeight}]+ba/b[height<=${targetHeight}]/best`
    : `bv*[vcodec^=avc1]+ba[acodec^=mp4a]/bv*+ba/best`;

  console.log(`\n=== TẢI CHẤT LƯỢNG: ${quality} (height <= ${targetHeight || 'max'}) ===`);
  const cmd = `"${ytdlp}" --ffmpeg-location "${ffmpeg}" -f "${formatSelector}" --merge-output-format mp4 -o "${outputFile}" "${testUrl}"`;
  console.log('Command:', cmd);

  const t0 = Date.now();
  execSync(cmd, { stdio: 'inherit' });
  const t1 = Date.now();

  const stat = fs.statSync(outputFile);
  const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);

  // Đọc thông số kỹ thuật thực tế bằng ffprobe
  const probeCmd = `"${ffprobe}" -v error -select_streams v:0 -show_entries stream=width,height,codec_name,avg_frame_rate -of json "${outputFile}"`;
  const probeOut = JSON.parse(execSync(probeCmd, { encoding: 'utf8' }));
  const vStream = probeOut.streams[0] || {};

  console.log(`Kết quả [${quality}]:`);
  console.log(`- Thời gian xử lý: ${((t1 - t0) / 1000).toFixed(2)}s`);
  console.log(`- Dung lượng: ${sizeMB} MB (${stat.size} bytes)`);
  console.log(`- Độ phân giải thật: ${vStream.width}x${vStream.height} (${vStream.height}p)`);
  console.log(`- Video codec: ${vStream.codec_name}, FPS: ${eval(vStream.avg_frame_rate || '30').toFixed(0)}`);

  return { quality, sizeMB, width: vStream.width, height: vStream.height, codec: vStream.codec_name };
}

async function run() {
  const res360 = await testDownload('360p', 360);
  const res720 = await testDownload('720p', 720);

  console.log('\n=== BẢNG SO SÁNH CHẤT LƯỢNG VIDEO ===');
  console.table([res360, res720]);
}

run();

