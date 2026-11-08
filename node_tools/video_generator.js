const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { generateAssPackage } = require('./subtitle_generator');
const config = require('./config');

const outputVideoDir = path.resolve(__dirname, '..', 'output_video');
const gameplayDir = path.resolve(__dirname, '..', 'assets', 'gameplay');
const overlaysDir = path.resolve(__dirname, '..', 'assets', 'overlays');

if (!fs.existsSync(outputVideoDir)) fs.mkdirSync(outputVideoDir, { recursive: true });
if (!fs.existsSync(gameplayDir)) fs.mkdirSync(gameplayDir, { recursive: true });
if (!fs.existsSync(overlaysDir)) fs.mkdirSync(overlaysDir, { recursive: true });

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

  const lowerId = videoId.toLowerCase();
  const matched = files.find(f => {
    const base = f.toLowerCase().replace(/\.[^/.]+$/, '');
    return lowerId.includes(base) || base.includes('gameplay');
  });

  return path.join(gameplayDir, matched || files[0]);
}

// Tìm danh sách ảnh vũ khí/phụ kiện có trong thư mục overlays khớp với videoId
function findOverlayImages(videoId = '') {
  if (!fs.existsSync(overlaysDir)) return [];
  const lowerId = videoId.toLowerCase().replace('df_', '').replace('_meta', '').replace('_review', '');

  const files = fs.readdirSync(overlaysDir).filter(f => {
    const ext = path.extname(f).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return false;
    const lowerName = f.toLowerCase();
    return lowerName.includes(lowerId) || lowerName.includes('as_val') || lowerName.includes('k416');
  });

  // Sắp xếp ưu tiên build 1, build 2
  files.sort((a, b) => a.localeCompare(b));
  return files.map(f => path.join(overlaysDir, f));
}

async function renderVideo({ videoId, weaponName, voiceText, visualCues, audioPath, outputPath }) {
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Không tìm thấy audio: ${audioPath}`);
  }

  const duration = await getAudioDuration(audioPath);
  const overlayImages = findOverlayImages(videoId);
  const hasImages = overlayImages.length > 0;

  // Tạo file phụ đề ASS kèm tiêu đề và nhãn bảng build
  const assPath = path.join(outputVideoDir, `${videoId}.ass`);
  generateAssPackage({
    videoId,
    weaponName,
    voiceText: voiceText || '',
    visualCues: visualCues || '',
    totalDuration: duration,
    outputPath: assPath,
    hasCustomImages: hasImages
  });

  const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const gameplayPath = pickGameplayFootage(videoId);
  const midPoint = (duration / 2).toFixed(2);

  return new Promise((resolve, reject) => {
    let args = [];

    if (hasImages) {
      // CÓ ẢNH PHỤ KIỆN: DÙNG FILTER ĐÈ ẢNH TIKTOK PIP CHUYÊN NGHIỆP
      const img1 = overlayImages[0].replace(/\\/g, '/');
      const img2 = (overlayImages[1] || overlayImages[0]).replace(/\\/g, '/');

      // Chuỗi filter chuyên nghiệp kiểu CapCut / TikTok gaming review:
      // 1. Khung nền: Nếu có gameplay thì crop 9:16, nếu không thì vẽ grid gaming
      // 2. Vẽ container card bo góc viền xanh neon nổi bật
      // 3. Scale ảnh phụ kiện và đè vào giữa màn hình
      // 4. Nửa đầu video hiện Build 1, nửa sau video chuyển sang Build 2
      // 5. Thêm sóng âm thanh neon bên dưới
      // 6. Đè phụ đề vàng TikTok và tiêu đề
      let baseSource = '';
      if (gameplayPath && fs.existsSync(gameplayPath)) {
        baseSource = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,`;
      } else {
        baseSource = `[0:v]drawgrid=w=108:h=108:t=2:c=#1e293b@0.8,`;
      }

      const filterParts = [
        `${baseSource}drawbox=x=40:y=390:w=1000:h=560:color=black@0.75:t=fill,drawbox=x=40:y=390:w=1000:h=560:color=0x38bdf8@0.9:t=4[bg]`,
        `[1:v]scale=940:-1[img1]`,
        `[2:v]scale=940:-1[img2]`,
        `[bg][img1]overlay=x=(W-w)/2:y=420:enable='between(t,0,${midPoint})'[v1]`,
        `[v1][img2]overlay=x=(W-w)/2:y=420:enable='gte(t,${midPoint})'[v2]`,
        `[3:a]showwaves=s=880x130:mode=cline:colors=0x00f5ff@0.95[waves]`,
        `[v2][waves]overlay=x=(W-w)/2:y=1000[v3]`,
        `[v3]ass='${escapedAss}'[outv]`
      ];

      const inputArgs = (gameplayPath && fs.existsSync(gameplayPath))
        ? ['-stream_loop', '-1', '-i', gameplayPath]
        : ['-f', 'lavfi', '-i', `color=c=#0b0f19:s=1080x1920:d=${duration}:r=30`];

      args = [
        '-y',
        ...inputArgs,
        '-i', img1,
        '-i', img2,
        '-i', audioPath,
        '-t', duration.toFixed(2),
        '-filter_complex', filterParts.join(';'),
        '-map', '[outv]',
        '-map', '3:a',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        outputPath
      ];
    } else {
      // KHÔNG CÓ ẢNH: DÙNG FILTER MẶC ĐỊNH
      let baseFilter = (gameplayPath && fs.existsSync(gameplayPath))
        ? `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];`
        : `[0:v]drawgrid=w=108:h=108:t=2:c=#1e293b@0.8[bg];`;

      const filterStr = `${baseFilter}` +
                        `[1:a]showwaves=s=880x160:mode=cline:colors=0x00f5ff@0.95[waves];` +
                        `[bg][waves]overlay=x=(W-w)/2:y=1120[v1];` +
                        `[v1]ass='${escapedAss}'[outv]`;

      const inputArgs = (gameplayPath && fs.existsSync(gameplayPath))
        ? ['-stream_loop', '-1', '-i', gameplayPath]
        : ['-f', 'lavfi', '-i', `color=c=#0b0f19:s=1080x1920:d=${duration}:r=30`];

      args = [
        '-y',
        ...inputArgs,
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
