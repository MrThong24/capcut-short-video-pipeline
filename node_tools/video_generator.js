const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { generateAssPackage } = require('./subtitle_generator');
const config = require('./config');

const outputVideoDir = path.resolve(__dirname, '..', 'output_video');
const gameplayDir = path.resolve(__dirname, '..', 'assets', 'gameplay');

if (!fs.existsSync(outputVideoDir)) fs.mkdirSync(outputVideoDir, { recursive: true });
if (!fs.existsSync(gameplayDir)) fs.mkdirSync(gameplayDir, { recursive: true });

function getAudioDuration(audioPath) {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, ['-i', audioPath]);
    let output = '';
    proc.stderr.on('data', d => output += d.toString());
    proc.on('close', () => {
      const match = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d+)/);
      if (match) {
        const seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
        resolve(seconds);
      } else {
        resolve(15);
      }
    });
  });
}

function pickGameplayFootage(videoId = '') {
  if (!fs.existsSync(gameplayDir)) return null;

  const files = fs.readdirSync(gameplayDir).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.mp4', '.mov', '.mkv', '.webm', '.avi'].includes(ext);
  });

  if (files.length === 0) return null;

  // Nếu có video khớp tên ID
  const lowerId = videoId.toLowerCase();
  const matched = files.find(f => {
    const base = f.toLowerCase().replace(/\.[^/.]+$/, '');
    return lowerId.includes(base) || base.includes('gameplay');
  });

  return path.join(gameplayDir, matched || files[0]);
}

async function renderVideo({ videoId, voiceText, visualCues, audioPath, outputPath }) {
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Không tìm thấy audio: ${audioPath}`);
  }

  const duration = await getAudioDuration(audioPath);

  // Tạo file phụ đề ASS kèm Tiêu đề & Thông số vũ khí
  const assPath = path.join(outputVideoDir, `${videoId}.ass`);
  generateAssPackage({
    videoId,
    voiceText: voiceText || '',
    visualCues: visualCues || '',
    totalDuration: duration,
    outputPath: assPath
  });

  // Đường dẫn ASS chuẩn hóa cho filter của FFmpeg trên Windows
  const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const gameplayPath = pickGameplayFootage(videoId);

  return new Promise((resolve, reject) => {
    let args = [];

    if (gameplayPath && fs.existsSync(gameplayPath)) {
      // Có clip gameplay: crop 9:16, ghép wave âm thanh, đè phụ đề chữ và tiêu đề
      const filterStr = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];` +
                        `[1:a]showwaves=s=880x150:mode=cline:colors=0x00f5ff@0.9[waves];` +
                        `[bg][waves]overlay=x=(W-w)/2:y=1140[v1];` +
                        `[v1]ass='${escapedAss}'[outv]`;

      args = [
        '-y',
        '-stream_loop', '-1',
        '-i', gameplayPath,
        '-i', audioPath,
        '-t', duration.toFixed(2),
        '-filter_complex', filterStr,
        '-map', '[outv]',
        '-map', '1:a',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        outputPath
      ];
    } else {
      // Chưa có clip gameplay: tạo nền gaming motion grid + visualizer wave + phụ đề + tiêu đề
      const filterStr = `[0:v]drawgrid=w=108:h=108:t=2:c=#1e293b@0.8[bg];` +
                        `[1:a]showwaves=s=880x160:mode=cline:colors=0x00f5ff@0.95[waves];` +
                        `[bg][waves]overlay=x=(W-w)/2:y=1120[v1];` +
                        `[v1]ass='${escapedAss}'[outv]`;

      args = [
        '-y',
        '-f', 'lavfi',
        '-i', `color=c=#0b0f19:s=1080x1920:d=${duration}:r=30`,
        '-i', audioPath,
        '-t', duration.toFixed(2),
        '-filter_complex', filterStr,
        '-map', '[outv]',
        '-map', '1:a',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        outputPath
      ];
    }

    const proc = spawn(ffmpegPath, args);
    let errorLog = '';

    proc.stderr.on('data', d => errorLog += d.toString());

    proc.on('close', (code) => {
      // Dọn file ass tạm
      try { if (fs.existsSync(assPath)) fs.unlinkSync(assPath); } catch (e) {}

      if (code === 0 && fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        resolve({
          success: true,
          outputPath,
          duration,
          sizeMb: (stats.size / (1024 * 1024)).toFixed(2)
        });
      } else {
        reject(new Error(`Lỗi render video (code ${code}): ${errorLog.slice(-500)}`));
      }
    });
  });
}

module.exports = {
  renderVideo,
  getAudioDuration,
  pickGameplayFootage
};
