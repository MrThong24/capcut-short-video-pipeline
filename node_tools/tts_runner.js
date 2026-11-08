const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const config = require('./config');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper đọc CSV
function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`Không tìm thấy file: ${filePath}`));
    }
    fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

// Helper đọc JSON
function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

// Chạy Edge TTS cho 1 đoạn văn bản kèm retry
async function generateEdgeAudioWithRetry(text, voice, speed, outputPath, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    let tts = null;
    try {
      tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

      const options = {};
      if (speed) {
        options.rate = speed.trim();
      }

      const { audioStream } = tts.toStream(text, options);
      const writeStream = fs.createWriteStream(outputPath);

      await new Promise((resolve, reject) => {
        audioStream.pipe(writeStream);
        audioStream.on('end', () => resolve());
        audioStream.on('error', (err) => reject(err));
        writeStream.on('error', (err) => reject(err));
      });

      if (tts) tts.close();

      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        if (stats.size > 1000) {
          return stats.size;
        }
      }
      throw new Error('File tạo ra có dung lượng quá nhỏ hoặc rỗng.');
    } catch (err) {
      if (tts) {
        try { tts.close(); } catch (e) {}
      }
      if (attempt >= maxRetries) {
        throw err;
      }
      console.log(`     ⚠️ Thử lại lần ${attempt + 1}/${maxRetries} sau 1.5s (Lý do: ${err.message})...`);
      await sleep(1500);
    }
  }
}

// Tạo file cẩm nang lắp ráp Assembly Guide
function generateAssemblyGuide(items) {
  let content = `# BẢNG HƯỚNG DẪN LẮP RÁP TIMELINE CAPCUT (ASSEMBLY GUIDE)\n`;
  content += `> Cập nhật tự động lúc: ${new Date().toLocaleString('vi-VN')}\n\n`;
  content += `| Video ID | File Audio | Kích thước | Visual Cues (Gợi ý kéo thả) |\n`;
  content += `| :--- | :--- | :--- | :--- |\n`;

  for (const item of items) {
    const mp3Name = `${item.video_id}.mp3`;
    const mp3Path = path.join(config.paths.outputAudioDir, mp3Name);
    let sizeInfo = '❌ Chưa có audio';
    if (fs.existsSync(mp3Path)) {
      const stats = fs.statSync(mp3Path);
      if (stats.size > 0) {
        sizeInfo = `✅ ${Math.round(stats.size / 1024)} KB`;
      }
    }

    content += `| **${item.video_id}** | \`${mp3Name}\` | ${sizeInfo} | ${item.visual_cues || 'Chưa có ghi chú'} |\n`;
  }

  content += `\n---\n\n## Chi tiết từng kịch bản:\n\n`;

  for (const item of items) {
    content += `### 🎬 Video: \`${item.video_id}\`\n`;
    content += `- **Giọng đọc / Tốc độ**: \`${item.voice_name || config.defaultVoice}\` (${item.speed || config.defaultSpeed})\n`;
    content += `- **File MP3**: \`output_audio/${item.video_id}.mp3\`\n`;
    content += `- **Kịch bản Voice**:\n  > "${item.voice_text}"\n`;
    content += `- **Quy hoạch Visual (Timeline Track 1 & 2)**:\n`;
    
    if (item.visual_cues) {
      const cues = item.visual_cues.split('|').map(c => c.trim());
      for (const cue of cues) {
        content += `  - [ ] ${cue}\n`;
      }
    } else {
      content += `  - *(Không có visual cue)*\n`;
    }
    content += `\n`;
  }

  fs.writeFileSync(config.paths.outputReport, content, 'utf8');
}

async function main() {
  const isForce = process.argv.includes('--force');
  
  // Xác định file input: kiểm tra xem user có truyền đường dẫn file vào không
  let inputFile = config.paths.inputCsv;
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('--') && (arg.endsWith('.csv') || arg.endsWith('.json'))) {
      inputFile = path.resolve(process.cwd(), arg);
      break;
    }
  }

  console.log('='.repeat(65));
  console.log('🚀 AUTOMATION PIPELINE: CHẠY BATCH TEXT-TO-SPEECH (TTS)');
  console.log('='.repeat(65));
  console.log(`📂 Nguồn dữ liệu: ${inputFile}`);
  if (isForce) console.log(`⚡ Chế độ: FORCE (Render lại toàn bộ)`);

  let rows = [];
  const isJson = inputFile.endsWith('.json');

  try {
    if (isJson) {
      rows = readJson(inputFile);
    } else {
      rows = await readCsv(inputFile);
    }
  } catch (err) {
    console.error(`❌ Lỗi khi đọc file dữ liệu:`, err.message);
    process.exit(1);
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('⚠️ Dữ liệu trống, không có dòng nào để xử lý.');
    return;
  }

  console.log(`📋 Tổng số kịch bản tìm thấy: ${rows.length}`);
  
  if (!fs.existsSync(config.paths.outputAudioDir)) {
    fs.mkdirSync(config.paths.outputAudioDir, { recursive: true });
  }

  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const videoId = (row.video_id || '').trim();
    const voiceText = (row.voice_text || '').trim();
    const voiceName = (row.voice_name || config.defaultVoice).trim();
    const speed = (row.speed || config.defaultSpeed).trim();
    const currentStatus = (row.status || '').trim().toLowerCase();

    if (!videoId || !voiceText) {
      console.log(`[${i + 1}/${rows.length}] ⏭️ Bỏ qua dòng thiếu ID hoặc nội dung Voice.`);
      skippedCount++;
      continue;
    }

    const outputFile = path.join(config.paths.outputAudioDir, `${videoId}.mp3`);
    const fileExists = fs.existsSync(outputFile) && fs.statSync(outputFile).size > 1000;

    // Bỏ qua nếu đã có file và không yêu cầu force
    if (!isForce && fileExists && currentStatus === 'ready_for_capcut') {
      console.log(`[${i + 1}/${rows.length}] ⏩ [ĐÃ CÓ SẴN] ${videoId}.mp3 -> Bỏ qua`);
      skippedCount++;
      continue;
    }

    console.log(`[${i + 1}/${rows.length}] 🎙️ Đang tạo audio cho [${videoId}]...`);
    console.log(`   - Giọng: ${voiceName} | Tốc độ: ${speed}`);
    console.log(`   - Text: "${voiceText.substring(0, 50)}..."`);

    try {
      const fileSize = await generateEdgeAudioWithRetry(voiceText, voiceName, speed, outputFile);
      console.log(`   ✅ Hoàn thành: ${videoId}.mp3 (${Math.round(fileSize / 1024)} KB)`);
      row.status = 'ready_for_capcut';
      processedCount++;
    } catch (err) {
      console.error(`   ❌ Lỗi khi tạo ${videoId}:`, err.message);
      row.status = 'error';
      errorCount++;
    }

    // Nghỉ nhẹ 500ms giữa các request
    await sleep(500);
  }

  // Cập nhật lại file nguồn
  if (isJson) {
    fs.writeFileSync(inputFile, JSON.stringify(rows, null, 2), 'utf8');
    console.log(`📝 Đã đồng bộ trạng thái kịch bản vào file JSON: ${path.basename(inputFile)}`);
  } else {
    const csvWriter = createCsvWriter({
      path: inputFile,
      header: [
        { id: 'video_id', title: 'video_id' },
        { id: 'voice_name', title: 'voice_name' },
        { id: 'speed', title: 'speed' },
        { id: 'voice_text', title: 'voice_text' },
        { id: 'visual_cues', title: 'visual_cues' },
        { id: 'status', title: 'status' }
      ]
    });
    await csvWriter.writeRecords(rows);
    console.log(`📝 Đã đồng bộ trạng thái kịch bản vào file CSV: ${path.basename(inputFile)}`);
  }

  // Tạo file cẩm nang lắp ráp
  generateAssemblyGuide(rows);
  console.log(`📖 Đã cập nhật cẩm nang lắp ráp trực quan tại: output_audio/ASSEMBLY_GUIDE.md`);

  console.log('='.repeat(65));
  console.log(`🏁 HOÀN TẤT BATCH: Đã tạo mới: ${processedCount} | Đã có sẵn: ${skippedCount} | Lỗi: ${errorCount}`);
  console.log(`👉 File audio sẵn sàng tại thư mục: output_audio\\`);
  console.log('='.repeat(65));
}

main().catch(err => {
  console.error('Fatal Error:', err);
});
