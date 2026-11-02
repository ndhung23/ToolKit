// scripts/test-ytdlp-service.js
const { exec } = require('child_process');
const path = require('path');

function resolveWithYtDlp(url, mode = 'video') {
  return new Promise((resolve, reject) => {
    let cmd = '';
    const ytdlpPath = path.join(__dirname, '..', 'yt-dlp.exe');

    if (url.includes('youtu')) {
      if (mode === 'audio') {
        cmd = `"${ytdlpPath}" -f 140/bestaudio -g "${url}"`;
      } else {
        // Ưu tiên format 18 (mp4 kết hợp cả video lẫn audio), fallback sang best
        cmd = `"${ytdlpPath}" --extractor-args "youtube:player_client=android,ios,web" -f 18/best -g "${url}"`;
      }
    } else if (url.includes('instagram.com')) {
      // Chuẩn hóa link Instagram
      const cleanUrl = url.replace(/[?&]igsh=[^&]+/, '').replace(/\/share\/[^\/]+/, '');
      cmd = `"${ytdlpPath}" -g "${cleanUrl}"`;
    } else {
      cmd = `"${ytdlpPath}" -g "${url}"`;
    }

    console.log('[EXEC]', cmd);
    exec(cmd, { timeout: 20000 }, (error, stdout, stderr) => {
      if (error) {
        const errText = (stderr || error.message || '').toString();
        console.error('[STDERR]', errText);
        let userMessage = 'Không thể tải video từ link này.';
        let code = 'UNKNOWN';

        if (errText.includes('Sign in to confirm you’re not a bot') || errText.includes('Botguard')) {
          code = 'BOT_CHECK';
          userMessage = 'YouTube yêu cầu xác minh bot. Vui lòng thử lại sau.';
        } else if (errText.includes('login') || errText.includes('empty media response') || errText.includes('Private')) {
          code = 'LOGIN_REQUIRED';
          userMessage = 'Instagram yêu cầu đăng nhập hoặc bài viết ở chế độ riêng tư.';
        } else if (errText.includes('Requested format is not available')) {
          code = 'FORMAT_UNAVAILABLE';
          userMessage = 'Định dạng video không khả dụng trên server này.';
        }
        return reject({ code, message: userMessage, raw: errText });
      }

      const lines = stdout.trim().split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
      if (lines.length === 0) {
        return reject({ code: 'NO_STREAM', message: 'Không tìm thấy luồng tải về hợp lệ.' });
      }

      const streamUrl = lines[0];
      resolve({
        success: true,
        streamUrl,
        mode,
      });
    });
  });
}

async function test() {
  console.log('--- TEST 1: YouTube Video ---');
  try {
    const resYt = await resolveWithYtDlp('https://youtu.be/wirc5PFn2KU', 'video');
    console.log('YouTube Video OK! URL snippet:', resYt.streamUrl.slice(0, 100));
  } catch (err) {
    console.error('YouTube Video FAIL:', err);
  }

  console.log('\n--- TEST 2: YouTube Audio ---');
  try {
    const resYtAudio = await resolveWithYtDlp('https://youtu.be/wirc5PFn2KU', 'audio');
    console.log('YouTube Audio OK! URL snippet:', resYtAudio.streamUrl.slice(0, 100));
  } catch (err) {
    console.error('YouTube Audio FAIL:', err);
  }

  console.log('\n--- TEST 3: Instagram Reel ---');
  try {
    const resIg = await resolveWithYtDlp('https://www.instagram.com/reel/C8qV8_9S4x_/?igsh=MW56eXRmZzRwMzRocg==', 'video');
    console.log('Instagram OK! URL snippet:', resIg.streamUrl.slice(0, 100));
  } catch (err) {
    console.error('Instagram FAIL (Structured):', { code: err.code, message: err.message });
  }
}

test();

