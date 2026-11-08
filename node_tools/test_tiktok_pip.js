const { spawn } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const path = require('path');

const img1 = path.resolve(__dirname, '..', 'assets', 'overlays', 'as_val_build_operations.png').replace(/\\/g, '/');
const img2 = path.resolve(__dirname, '..', 'assets', 'overlays', 'as_val_build_warfare.png').replace(/\\/g, '/');
const audio = path.resolve(__dirname, '..', 'output_audio', 'DF_as_val_meta.mp3').replace(/\\/g, '/');
const output = path.resolve(__dirname, '..', 'output_video', 'test_tiktok_edit.mp4').replace(/\\/g, '/');

const filterParts = [
  '[0:v]drawgrid=w=108:h=108:t=2:c=#1e293b@0.8,drawbox=x=40:y=420:w=1000:h=520:color=black@0.7:t=fill,drawbox=x=40:y=420:w=1000:h=520:color=0x38bdf8@0.9:t=4[bg]',
  '[1:v]scale=940:-1[img1]',
  '[2:v]scale=940:-1[img2]',
  "[bg][img1]overlay=x=(W-w)/2:y=450:enable='between(t,0,8)'[v1]",
  "[v1][img2]overlay=x=(W-w)/2:y=450:enable='gte(t,8)'[v2]",
  '[3:a]showwaves=s=880x140:mode=cline:colors=0x00f5ff@0.95[waves]',
  '[v2][waves]overlay=x=(W-w)/2:y=1000[outv]'
];
const filterStr = filterParts.join(';');

const args = [
  '-y',
  '-f', 'lavfi', '-i', 'color=c=#0b0f19:s=1080x1920:d=15:r=30',
  '-i', img1,
  '-i', img2,
  '-i', audio,
  '-t', '15',
  '-filter_complex', filterStr,
  '-map', '[outv]',
  '-map', '3:a',
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  output
];

const proc = spawn(ffmpegPath, args);
proc.stderr.on('data', d => process.stderr.write(d));
proc.on('close', code => {
  console.log('Finished with code:', code);
});
