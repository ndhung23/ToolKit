const { execSync } = require('child_process');

const testUrl = 'https://youtu.be/wirc5PFn2KU';
const clients = ['android', 'ios', 'tv', 'mweb', 'web_safari', 'visionos'];

console.log('=== TEST YOUTUBE PLAYER CLIENTS ===');
console.log('Target URL:', testUrl);

const results = {};

for (const client of clients) {
  process.stdout.write(`Testing client: ${client}... `);
  try {
    const cmd = `.\\yt-dlp.exe --extractor-args "youtube:player_client=${client}" -g "${testUrl}"`;
    const output = execSync(cmd, { encoding: 'utf8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = output.trim().split('\n').filter(l => l.startsWith('http'));
    if (lines.length > 0) {
      console.log(`SUCCESS! Extracted ${lines.length} streams.`);
      results[client] = { success: true, streams: lines.length, sampleUrl: lines[0].slice(0, 80) + '...' };
    } else {
      console.log('FAILED (No HTTP stream)');
      results[client] = { success: false, reason: 'No HTTP stream' };
    }
  } catch (err) {
    const errMsg = (err.stderr || err.message || '').toString();
    const shortErr = errMsg.split('\n').find(l => l.includes('ERROR:')) || errMsg.slice(0, 100);
    console.log(`FAILED: ${shortErr.trim()}`);
    results[client] = { success: false, reason: shortErr.trim() };
  }
}

console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(results, null, 2));

