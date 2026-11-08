const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

module.exports = {
  provider: process.env.TTS_PROVIDER || 'edge',
  defaultVoice: process.env.DEFAULT_VOICE || 'vi-VN-NamMinhNeural',
  defaultSpeed: process.env.DEFAULT_SPEED || '+10%',
  
  // Đường dẫn thư mục
  paths: {
    inputCsv: path.resolve(__dirname, '..', 'scripts', 'scripts_input.csv'),
    inputJson: path.resolve(__dirname, '..', 'scripts', 'scripts_sample.json'),
    outputAudioDir: path.resolve(__dirname, '..', 'output_audio'),
    outputReport: path.resolve(__dirname, '..', 'output_audio', 'ASSEMBLY_GUIDE.md'),
    assetsDir: path.resolve(__dirname, '..', 'assets')
  },

  // Dự phòng API Key
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    voiceId: process.env.ELEVENLABS_VOICE_ID || ''
  },
  viettel: {
    apiKey: process.env.VIETTEL_API_KEY || '',
    voiceCode: process.env.VIETTEL_VOICE_CODE || ''
  }
};

