const fs = require('fs');
const path = require('path');

function formatAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function generateAssPackage({ videoId, voiceText, visualCues, totalDuration, outputPath }) {
  // Tiêu đề dựa theo ID
  let title = 'GAMEPLAY SHORT REVIEW';
  let cardTitle = 'THÔNG TIN CHI TIẾT';
  let cardLines = [];

  if (videoId.toUpperCase().includes('DF') || videoId.toUpperCase().includes('K416')) {
    title = '🔥 DELTA FORCE - K416 META 🔥';
    cardTitle = '⚡ THÔNG SỐ VŨ KHÍ ⚡';
    cardLines = [
      '• Triệt tiêu độ giật ngang: -35%',
      '• Tốc độ ngắm bắn ADS: +25%',
      '• Khẩu súng trường quốc dân cực bá'
    ];
  } else if (videoId.toUpperCase().includes('VLTK') || videoId.toUpperCase().includes('NGAMI')) {
    title = '⚔️ VÕ LÂM 1 - NGA MI KIẾM PHÁI ⚔️';
    cardTitle = '💎 TRANG BỊ ĐAI LƯNG THỦY 💎';
    cardLines = [
      '• Sinh lực cực đại: +320 điểm',
      '• Kháng tất cả thuộc tính: +28%',
      '• Làm chậm đối phương khi Tống Kim'
    ];
  } else if (videoId.toUpperCase().includes('MEME')) {
    title = '😂 GÓC HÀI HƯỚNG VLTK1 😂';
    cardTitle = '💀 ĐẬP ĐỒ HUYỀN TINH CẤP 8 💀';
    cardLines = [
      '• Dồn hết tiền tiết kiệm mua đá',
      '• Tỷ lệ thành công: 90%',
      '• Kết quả: XỊT TOÀN TẬP - XÓA GAME!'
    ];
  } else if (visualCues) {
    title = `🎬 ${videoId.toUpperCase()}`;
    cardTitle = '📌 MỤC TIÊU VIDEO';
    cardLines = visualCues.split('|').map(c => `• ${c.trim()}`);
  }

  // Tách kịch bản thành các câu phụ đề ngắn (style TikTok)
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

  // Tiêu đề trên cùng (hiện suốt video)
  const allDurationStr = formatAssTime(totalDuration);
  const titleEvent = `Dialogue: 2,0:00:00.00,${allDurationStr},TitleStyle,,0,0,0,,${title}\n`;

  // Thẻ thông tin ở giữa (hiện từ giây 2 đến hết video)
  const cardText = `{\\b1}${cardTitle}{\\b0}\\N\\N${cardLines.join('\\N')}`;
  const cardEvent = `Dialogue: 0,0:00:02.00,${allDurationStr},CardStyle,,0,0,0,,${cardText}\n`;

  const assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: TitleStyle,Segoe UI,54,&H0000FFFF,&H000000FF,&H00000000,&H90000000,1,0,0,0,100,100,0,0,1,5,2,8,60,60,260,1
Style: CardStyle,Segoe UI,46,&H00FFFFFF,&H000000FF,&H00111111,&H90000000,1,0,0,0,100,100,0,0,1,4,3,5,80,80,0,1
Style: SubtitleStyle,Segoe UI,58,&H0000E5FF,&H000000FF,&H00000000,&H90000000,1,0,0,0,100,100,0,0,1,6,2,2,60,60,420,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${titleEvent}
${cardEvent}
${subtitleEvents}
`;

  fs.writeFileSync(outputPath, assContent, 'utf8');
  return outputPath;
}

module.exports = { generateAssPackage };
