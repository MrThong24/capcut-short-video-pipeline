const fs = require('fs');
const path = require('path');

function formatAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function generateAssPackage({ videoId, weaponName, voiceText, visualCues, totalDuration, outputPath, template = 'split_screen', hasCustomImages = false }) {
  const wpn = (weaponName || 'VŨ KHÍ').toUpperCase();
  const allDurationStr = formatAssTime(totalDuration);
  const midPoint = totalDuration / 2;
  const midPointStr = formatAssTime(midPoint);

  // Tách phụ đề TikTok
  const rawWords = voiceText.trim().split(/\s+/);
  const chunks = [];
  let currentChunk = [];

  for (let i = 0; i < rawWords.length; i++) {
    currentChunk.push(rawWords[i]);
    const word = rawWords[i];
    if (word.includes(',') || word.includes('.') || word.includes('!') || word.includes('?') || currentChunk.length >= 5 || i === rawWords.length - 1) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
    }
  }

  const totalWords = rawWords.length;
  let currentTime = 0;
  let subtitleEvents = '';

  for (const chunk of chunks) {
    const chunkWords = chunk.split(/\s+/).length;
    const chunkDuration = Math.max(1.2, (chunkWords / totalWords) * totalDuration);
    const startStr = formatAssTime(currentTime);
    const endStr = formatAssTime(Math.min(totalDuration, currentTime + chunkDuration));
    const cleanChunk = chunk.replace(/[,.!?]/g, '').trim().toUpperCase();

    subtitleEvents += `Dialogue: 1,${startStr},${endStr},SubtitleStyle,,0,0,0,,${cleanChunk}\n`;
    currentTime += chunkDuration;
  }

  let extraEvents = '';
  let styles = '';

  if (template === 'split_screen') {
    // MẪU 1: SPLIT SCREEN (Tiêu đề trên dải ngăn + Nhãn Build 1 / 2)
    styles = `
Style: TitleStyle,Segoe UI,46,&H0000FFFF,&H000000FF,&H00000000,&H90000000,1,0,0,0,100,100,0,0,1,4,1,8,40,40,940,1
Style: LabelStyle,Segoe UI,38,&H00FFFFFF,&H000000FF,&H00000000,&H90000000,1,0,0,0,100,100,0,0,1,4,1,8,40,40,1000,1
Style: SubtitleStyle,Segoe UI,56,&H0000E5FF,&H000000FF,&H00000000,&H90000000,1,0,0,0,100,100,0,0,1,6,2,2,60,60,300,1
`;
    extraEvents += `Dialogue: 2,0:00:00.00,${allDurationStr},TitleStyle,,0,0,0,,🔥 DELTA FORCE - ${wpn} META SẤY KHÔNG GIẬT 🔥\n`;
    if (hasCustomImages) {
      extraEvents += `Dialogue: 2,0:00:00.00,${midPointStr},LabelStyle,,0,0,0,,🎯 BẢNG PHỤ KIỆN 1: CHIẾN DỊCH (OPERATIONS)\n`;
      extraEvents += `Dialogue: 2,${midPointStr},${allDurationStr},LabelStyle,,0,0,0,,⚔️ BẢNG PHỤ KIỆN 2: CHIẾN TRANH (WARFARE)\n`;
    }

  } else {
    // MẪU 2 & 3: ẢNH FULL CHIỀU NGANG Ở CHÍNH GIỮA
    styles = `
Style: TitleStyle,Segoe UI,54,&H0000FFFF,&H000000FF,&H00000000,&H90000000,1,0,0,0,100,100,0,0,1,5,2,8,60,60,200,1
Style: LabelStyle,Segoe UI,42,&H0038BDF8,&H000000FF,&H00000000,&H90000000,1,0,0,0,100,100,0,0,1,4,1,8,60,60,470,1
Style: SubtitleStyle,Segoe UI,56,&H0000E5FF,&H000000FF,&H00000000,&H90000000,1,0,0,0,100,100,0,0,1,6,2,2,60,60,300,1
`;
    extraEvents += `Dialogue: 2,0:00:00.00,${allDurationStr},TitleStyle,,0,0,0,,🔥 DELTA FORCE - ${wpn} META 🔥\n`;
    if (hasCustomImages) {
      extraEvents += `Dialogue: 2,0:00:00.00,${midPointStr},LabelStyle,,0,0,0,,🎯 BẢNG BUILD 1: CHIẾN DỊCH (OPERATIONS)\n`;
      extraEvents += `Dialogue: 2,${midPointStr},${allDurationStr},LabelStyle,,0,0,0,,⚔️ BẢNG BUILD 2: CHIẾN TRANH (WARFARE)\n`;
    }
  }

  const assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styles}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${extraEvents}
${subtitleEvents}
`;

  fs.writeFileSync(outputPath, assContent, 'utf8');
  return outputPath;
}

module.exports = { generateAssPackage };
