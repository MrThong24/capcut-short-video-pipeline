const express = require('express');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const multer = require('multer');
const config = require('./config');
const { renderVideo } = require('./video_generator');
const { scrapeGameWithWeapon } = require('./gamewith_crawler');

const app = express();
const PORT = process.env.PORT || 4000;
const outputVideoDir = path.resolve(__dirname, '..', 'output_video');
const gameplayDir = path.resolve(__dirname, '..', 'assets', 'gameplay');
const overlaysDir = path.resolve(__dirname, '..', 'assets', 'overlays');

if (!fs.existsSync(outputVideoDir)) fs.mkdirSync(outputVideoDir, { recursive: true });
if (!fs.existsSync(gameplayDir)) fs.mkdirSync(gameplayDir, { recursive: true });
if (!fs.existsSync(overlaysDir)) fs.mkdirSync(overlaysDir, { recursive: true });

// Cấu hình Multer upload gameplay video
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, gameplayDir),
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, cleanName);
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/audio', express.static(config.paths.outputAudioDir));
app.use('/video', express.static(outputVideoDir));
app.use('/overlays', express.static(overlaysDir));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper đọc CSV
function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    if (!fs.existsSync(filePath)) {
      return resolve([]);
    }
    fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

// Helper ghi CSV
async function writeCsv(filePath, rows) {
  const csvWriter = createCsvWriter({
    path: filePath,
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
}

// Hàm sinh audio cho 1 text
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
      throw new Error('File âm thanh quá nhỏ hoặc rỗng.');
    } catch (err) {
      if (tts) {
        try { tts.close(); } catch (e) {}
      }
      if (attempt >= maxRetries) throw err;
      await sleep(1000);
    }
  }
}

// API: Lấy danh sách kịch bản (Kèm trạng thái Audio & Video)
app.get('/api/scripts', async (req, res) => {
  try {
    const rows = await readCsv(config.paths.inputCsv);
    const enriched = rows.map(r => {
      const mp3Name = `${r.video_id}.mp3`;
      const mp3Path = path.join(config.paths.outputAudioDir, mp3Name);
      const hasAudio = fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 1000;
      let audioSizeKb = 0;
      if (hasAudio) {
        audioSizeKb = Math.round(fs.statSync(mp3Path).size / 1024);
      }

      const mp4Name = `${r.video_id}.mp4`;
      const mp4Path = path.join(outputVideoDir, mp4Name);
      const hasVideo = fs.existsSync(mp4Path) && fs.statSync(mp4Path).size > 5000;
      let videoSizeMb = '0';
      if (hasVideo) {
        videoSizeMb = (fs.statSync(mp4Path).size / (1024 * 1024)).toFixed(2);
      }

      return {
        ...r,
        has_audio: hasAudio,
        audio_url: hasAudio ? `/audio/${mp3Name}?t=${Date.now()}` : null,
        audio_size_kb: audioSizeKb,
        has_video: hasVideo,
        video_url: hasVideo ? `/video/${mp4Name}?t=${Date.now()}` : null,
        video_size_mb: videoSizeMb
      };
    });
    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Thêm/Sửa kịch bản
app.post('/api/scripts', async (req, res) => {
  try {
    const { video_id, voice_name, speed, voice_text, visual_cues } = req.body;
    if (!video_id || !voice_text) {
      return res.status(400).json({ success: false, error: 'Thiếu Video ID hoặc Kịch bản Voice.' });
    }

    const rows = await readCsv(config.paths.inputCsv);
    const existingIndex = rows.findIndex(r => r.video_id === video_id.trim());

    const newRow = {
      video_id: video_id.trim(),
      voice_name: voice_name || config.defaultVoice,
      speed: speed || config.defaultSpeed,
      voice_text: voice_text.trim(),
      visual_cues: visual_cues ? visual_cues.trim() : '',
      status: 'pending'
    };

    if (existingIndex >= 0) {
      rows[existingIndex] = newRow;
    } else {
      rows.push(newRow);
    }

    await writeCsv(config.paths.inputCsv, rows);
    res.json({ success: true, message: 'Đã lưu kịch bản thành công!', data: newRow });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Xóa kịch bản
app.delete('/api/scripts/:id', async (req, res) => {
  try {
    const id = req.params.id;
    let rows = await readCsv(config.paths.inputCsv);
    rows = rows.filter(r => r.video_id !== id);
    await writeCsv(config.paths.inputCsv, rows);
    res.json({ success: true, message: `Đã xóa kịch bản ${id}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Tạo audio TTS
app.post('/api/generate', async (req, res) => {
  try {
    const { video_id, force } = req.body;
    const rows = await readCsv(config.paths.inputCsv);
    const results = [];

    for (const row of rows) {
      if (video_id && row.video_id !== video_id) continue;

      const outputFile = path.join(config.paths.outputAudioDir, `${row.video_id}.mp3`);
      const exists = fs.existsSync(outputFile) && fs.statSync(outputFile).size > 1000;

      if (!force && exists && row.status === 'ready_for_capcut') {
        results.push({ video_id: row.video_id, status: 'skipped', reason: 'already exists' });
        continue;
      }

      try {
        const voiceName = row.voice_name || config.defaultVoice;
        const speed = row.speed || config.defaultSpeed;
        const size = await generateEdgeAudioWithRetry(row.voice_text, voiceName, speed, outputFile);
        row.status = 'ready_for_capcut';
        results.push({ video_id: row.video_id, status: 'success', size_kb: Math.round(size / 1024) });
      } catch (err) {
        row.status = 'error';
        results.push({ video_id: row.video_id, status: 'error', error: err.message });
      }
      await sleep(400);
    }

    await writeCsv(config.paths.inputCsv, rows);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Tạo Video MP4 hoàn chỉnh từ Audio + Footage Gameplay (Cách 2)
app.post('/api/generate-video', async (req, res) => {
  try {
    const { video_id } = req.body;
    const rows = await readCsv(config.paths.inputCsv);
    const targetRows = video_id ? rows.filter(r => r.video_id === video_id) : rows;

    if (targetRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy kịch bản.' });
    }

    const results = [];

    for (const row of targetRows) {
      const audioPath = path.join(config.paths.outputAudioDir, `${row.video_id}.mp3`);
      
      // Nếu chưa có file audio, tự sinh audio trước
      if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size < 1000) {
        const voiceName = row.voice_name || config.defaultVoice;
        const speed = row.speed || config.defaultSpeed;
        await generateEdgeAudioWithRetry(row.voice_text, voiceName, speed, audioPath);
        row.status = 'ready_for_capcut';
      }

      const videoPath = path.join(outputVideoDir, `${row.video_id}.mp4`);
      try {
        const renderRes = await renderVideo({
          videoId: row.video_id,
          voiceText: row.voice_text,
          visualCues: row.visual_cues,
          audioPath,
          outputPath: videoPath
        });
        results.push({
          video_id: row.video_id,
          status: 'success',
          size_mb: renderRes.sizeMb,
          duration: renderRes.duration
        });
      } catch (err) {
        results.push({
          video_id: row.video_id,
          status: 'error',
          error: err.message
        });
      }
    }

    await writeCsv(config.paths.inputCsv, rows);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Crawl thông tin vũ khí từ GameWith
app.post('/api/crawl-weapon', async (req, res) => {
  try {
    const { url } = req.body;
    const targetUrl = url || 'https://gamewith.jp/deltaforce/475463';
    const data = await scrapeGameWithWeapon(targetUrl);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Tạo video từ vũ khí GameWith chỉ bằng 1 Click
app.post('/api/create-weapon-video', async (req, res) => {
  try {
    const { video_id, weapon_name, voice_text, visual_cues, voice_name, speed } = req.body;
    if (!video_id || !voice_text) {
      return res.status(400).json({ success: false, error: 'Thiếu dữ liệu kịch bản.' });
    }

    const rows = await readCsv(config.paths.inputCsv);
    const existingIndex = rows.findIndex(r => r.video_id === video_id.trim());

    const newRow = {
      video_id: video_id.trim(),
      voice_name: voice_name || 'vi-VN-NamMinhNeural',
      speed: speed || '+12%',
      voice_text: voice_text.trim(),
      visual_cues: visual_cues ? visual_cues.trim() : '',
      status: 'pending'
    };

    if (existingIndex >= 0) {
      rows[existingIndex] = newRow;
    } else {
      rows.push(newRow);
    }
    await writeCsv(config.paths.inputCsv, rows);

    // 1. Tạo audio
    const audioPath = path.join(config.paths.outputAudioDir, `${newRow.video_id}.mp3`);
    await generateEdgeAudioWithRetry(newRow.voice_text, newRow.voice_name, newRow.speed, audioPath);
    newRow.status = 'ready_for_capcut';
    await writeCsv(config.paths.inputCsv, rows);

    // 2. Tạo video MP4
    const videoPath = path.join(outputVideoDir, `${newRow.video_id}.mp4`);
    const renderRes = await renderVideo({
      videoId: newRow.video_id,
      voiceText: newRow.voice_text,
      visualCues: newRow.visual_cues,
      audioPath,
      outputPath: videoPath
    });

    res.json({
      success: true,
      message: `Đã tạo thành công Video Review cho ${weapon_name || video_id}!`,
      video_url: `/video/${newRow.video_id}.mp4?t=${Date.now()}`,
      size_mb: renderRes.sizeMb,
      duration: renderRes.duration
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Upload video gameplay nền
app.post('/api/upload-gameplay', upload.single('gameplay'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Không có file nào được tải lên.' });
  }
  res.json({
    success: true,
    message: `Đã lưu file gameplay: ${req.file.filename}`,
    filename: req.file.filename
  });
});

// API: Lấy danh sách video gameplay hiện có
app.get('/api/gameplay-files', (req, res) => {
  if (!fs.existsSync(gameplayDir)) return res.json({ success: true, files: [] });
  const files = fs.readdirSync(gameplayDir).filter(f => ['.mp4', '.mov', '.mkv', '.webm'].includes(path.extname(f).toLowerCase()));
  res.json({ success: true, files });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🌐 CAPCUT AUTOMATION WEB SERVER ĐANG CHẠY!`);
  console.log(`👉 Truy cập trên trình duyệt: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
