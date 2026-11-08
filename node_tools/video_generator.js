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
  return path.join(gameplayDir, files[0]);
}

function findOverlayImages(videoId = '') {
  if (!fs.existsSync(overlaysDir)) return [];
  const lowerId = videoId.toLowerCase().replace('df_', '').replace('_meta', '').replace('_review', '');

  const files = fs.readdirSync(overlaysDir).filter(f => {
    const ext = path.extname(f).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return false;
    const lowerName = f.toLowerCase();
    return lowerName.includes(lowerId) || lowerName.includes('as_val') || lowerName.includes('k416');
  });

  files.sort((a, b) => a.localeCompare(b));
  return files.map(f => path.join(overlaysDir, f));
}

async function renderVideo({ videoId, weaponName, voiceText, visualCues, audioPath, outputPath, template = 'split_screen' }) {
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Không tìm thấy audio: ${audioPath}`);
  }

  const duration = await getAudioDuration(audioPath);
  const overlayImages = findOverlayImages(videoId);
  const hasImages = overlayImages.length > 0;
  const midPoint = (duration / 2).toFixed(2);

  // Tạo file phụ đề ASS
  const assPath = path.join(outputVideoDir, `${videoId}_${template}.ass`);
  generateAssPackage({
    videoId,
    weaponName,
    voiceText: voiceText || '',
    visualCues: visualCues || '',
    totalDuration: duration,
    outputPath: assPath,
    template,
    hasCustomImages: hasImages
  });

  const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const gameplayPath = pickGameplayFootage(videoId);

  return new Promise((resolve, reject) => {
    let args = [];
    const img1 = (hasImages ? overlayImages[0] : '').replace(/\\/g, '/');
    const img2 = (hasImages ? (overlayImages[1] || overlayImages[0]) : '').replace(/\\/g, '/');

    // =========================================================================
    // TỐI ƯU HÌNH ẢNH: PHÓNG TO FULL CHIỀU NGANG (1080px) + THUẬT TOÁN LANCZOS
    // Giữ nguyên độ sắc nét 100%, không bị thu nhỏ, nằm ngay chính giữa màn hình
    // =========================================================================

    // MẪU 1: SPLIT-SCREEN (Nửa trên Gameplay, Nửa dưới ảnh Full Width phóng to)
    if (template === 'split_screen') {
      let filterParts = [];
      let inputArgs = [];

      if (gameplayPath && fs.existsSync(gameplayPath)) {
        inputArgs = [
          '-f', 'lavfi', '-i', `color=c=#080c14:s=1080x1920:d=${duration}:r=30`,
          '-stream_loop', '-1', '-i', gameplayPath,
          '-i', img1,
          '-i', img2,
          '-i', audioPath
        ];
        filterParts = [
          // Nửa trên: Gameplay 1080x920
          `[1:v]scale=1080:920:force_original_aspect_ratio=increase,crop=1080:920[gp]`,
          `[0:v][gp]overlay=0:0[top]`,
          // Dải viền Neon phân cách Y=915
          `[top]drawbox=x=0:y=915:w=1080:h=8:color=0x38bdf8@1:t=fill[split]`,
          // Nửa dưới: Ảnh bảng build phóng to Full Width 1080, thuật toán Lanczos siêu nét
          `[2:v]scale=1080:-1:flags=lanczos[img1]`,
          `[3:v]scale=1080:-1:flags=lanczos[img2]`,
          // Đặt ảnh ngay nửa dưới Y=960 (không viền đen thừa hai bên)
          `[split][img1]overlay=0:980:enable='between(t,0,${midPoint})'[v1]`,
          `[v1][img2]overlay=0:980:enable='gte(t,${midPoint})'[v2]`,
          `[4:a]showwaves=s=700x50:mode=cline:colors=0x00f5ff@0.9[waves]`,
          `[v2][waves]overlay=x=(W-w)/2:y=860[v3]`,
          `[v3]ass='${escapedAss}'[outv]`
        ];
      } else {
        inputArgs = [
          '-f', 'lavfi', '-i', `color=c=#080c14:s=1080x1920:d=${duration}:r=30`,
          '-i', img1,
          '-i', img2,
          '-i', audioPath
        ];
        filterParts = [
          `[0:v]drawgrid=w=90:h=90:t=2:c=#1e293b@0.8,drawbox=x=0:y=915:w=1080:h=8:color=0x38bdf8@1:t=fill[split]`,
          `[1:v]scale=1080:-1:flags=lanczos[img1]`,
          `[2:v]scale=1080:-1:flags=lanczos[img2]`,
          `[split][img1]overlay=0:980:enable='between(t,0,${midPoint})'[v1]`,
          `[v1][img2]overlay=0:980:enable='gte(t,${midPoint})'[v2]`,
          `[3:a]showwaves=s=700x50:mode=cline:colors=0x00f5ff@0.9[waves]`,
          `[v2][waves]overlay=x=(W-w)/2:y=860[v3]`,
          `[v3]ass='${escapedAss}'[outv]`
        ];
      }

      const audioMapIndex = gameplayPath ? '4:a' : '3:a';
      args = [
        '-y',
        ...inputArgs,
        '-t', duration.toFixed(2),
        '-filter_complex', filterParts.join(';'),
        '-map', '[outv]',
        '-map', audioMapIndex,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        outputPath
      ];

    // MẪU 2 & MẪU 3: PHÓNG TO FULL WIDTH Ở CHÍNH GIỮA MÀN HÌNH (Y=560)
    } else {
      const baseSource = (gameplayPath && fs.existsSync(gameplayPath))
        ? `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,`
        : `[0:v]drawgrid=w=108:h=108:t=2:c=#1e293b@0.8,`;

      const inputArgs = (gameplayPath && fs.existsSync(gameplayPath))
        ? ['-stream_loop', '-1', '-i', gameplayPath]
        : ['-f', 'lavfi', '-i', `color=c=#0b0f19:s=1080x1920:d=${duration}:r=30`];

      // Nền đen mờ 80% full chiều ngang để tôn ảnh lên, kèm 2 viền neon trên dưới
      // Ảnh được phóng to Full 1080 width, dùng Lanczos filter giữ chữ sắc nét tối đa
      const filterParts = [
        `${baseSource}drawbox=x=0:y=540:w=1080:h=560:color=black@0.85:t=fill,drawbox=x=0:y=540:w=1080:h=4:color=0x38bdf8@1:t=fill,drawbox=x=0:y=1096:w=1080:h=4:color=0x38bdf8@1:t=fill[bg]`,
        `[1:v]scale=1080:-1:flags=lanczos[img1]`,
        `[2:v]scale=1080:-1:flags=lanczos[img2]`,
        // Overlay đúng full width x=0, căn giữa y=560
        `[bg][img1]overlay=0:560:enable='between(t,0,${midPoint})'[v1]`,
        `[v1][img2]overlay=0:560:enable='gte(t,${midPoint})'[v2]`,
        `[3:a]showwaves=s=880x100:mode=cline:colors=0x00f5ff@0.95[waves]`,
        `[v2][waves]overlay=x=(W-w)/2:y=1140[v3]`,
        `[v3]ass='${escapedAss}'[outv]`
      ];

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
          template,
          sizeMb: (stats.size / (1024 * 1024)).toFixed(2)
        });
      } else {
        reject(new Error(`Lỗi render (${template}, code ${code}): ${errorLog.slice(-500)}`));
      }
    });
  });
}

module.exports = {
  renderVideo,
  getAudioDuration,
  pickGameplayFootage
};
