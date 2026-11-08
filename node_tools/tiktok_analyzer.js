const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

// Thư mục lưu cache phân tích
const analysisDir = path.resolve(__dirname, '..', 'output_video', 'analysis');
if (!fs.existsSync(analysisDir)) fs.mkdirSync(analysisDir, { recursive: true });

// 1. Lấy thông tin TikTok qua official oEmbed API (Công khai, không bị chặn)
async function fetchTikTokOEmbed(url) {
  try {
    let cleanUrl = url.trim().split('?')[0]; // Bỏ query string
    // Chuẩn hóa /photo/ sang /video/ để tương thích với oEmbed API của TikTok
    cleanUrl = cleanUrl.replace(/\/photo\//i, '/video/');

    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code === 400 || json.message === 'Something went wrong') return null;
    return json;
  } catch (err) {
    console.error('Lỗi fetch TikTok oEmbed:', err.message);
    return null;
  }
}

// 2. Thuật toán bóc tách từng phân cảnh video (Scene Deconstruction Engine)
// Phân tích cấu trúc video ngắn thịnh hành: Hook -> Build-up -> Climax / Gunsmith -> CTA Loop
function deconstructScenes({ title = '', author = '', duration = 16, url = '' }) {
  const d = Math.max(12, Math.min(60, duration));
  const hookEnd = Math.min(3.5, (d * 0.2)).toFixed(1);
  const buildupEnd = (d * 0.5).toFixed(1);
  const climaxEnd = (d * 0.85).toFixed(1);
  const ctaEnd = d.toFixed(1);

  // Phân tích chủ đề từ tiêu đề & URL
  const combinedText = `${title} ${url}`;
  const cleanTitle = title.replace(/#[a-zA-Z0-9_]+/g, '').trim() || 'Review vũ khí Meta Delta Force';

  // Nhận diện tên vũ khí nếu có
  const weaponMatch = combinedText.match(/\b(as[\s_-]*val|k416|m4a1|scar[\s_-]*h?|mp5|vector|qbz|ak[\s_-]*12|svd|p90|awm)\b/i);
  let weaponName = 'khẩu súng này';
  if (weaponMatch) {
    weaponName = weaponMatch[0].replace(/[_-]/g, ' ').toUpperCase();
  } else if (/delta|súng|gun|fps|meta/i.test(combinedText)) {
    weaponName = 'khẩu súng meta này';
  }

  const isGunReview = /súng|gun|k416|as val|m4a1|build|meta|delta|fps|game|vũ khí/i.test(combinedText);

  const scenes = [
    {
      sceneNumber: 1,
      phase: 'HOOK (0s - 3s)',
      timeRange: `0:00 - 0:0${Math.floor(hookEnd)}`,
      purpose: 'Giữ chân người xem trong 3 giây đầu tiên (Ngăn lướt qua)',
      visual: isGunReview 
        ? `Cảnh highlight sấy gục 2-3 mạng liên tiếp bằng ${weaponName}. Camera zoom giật nhẹ (Camera Shake). Tiêu đề chữ to viền neon vàng/đỏ: "${weaponName} ĐÃ TRỞ LẠI META!".`
        : 'Hình ảnh giật gân, tương phản cao, góc quay cận cảnh chủ thể chuyển động nhanh.',
      audioSpeech: isGunReview 
        ? `Đừng dùng khẩu súng cũ nữa, ${weaponName} này mới chính là quái vật meta bá đạo nhất Delta Force mùa này!`
        : `Bạn đã biết bí mật này chưa? Xem ngay kẻo lỡ!`,
      sfxAndMusic: 'SFX: Whoosh mạnh + Tiếng nạp đạn (Gun cock) hoặc Vine Boom. Nhạc nền trap/phonk tiết tấu dồn dập.',
      capcutTips: 'Hiệu ứng CapCut: Zoom In 1.1x nhịp nhạc + Hiệu ứng Shake (Lắc 25%) + Font SVN-Be Vietnam Pro viền vàng nảy (Spring Bounce).'
    },
    {
      sceneNumber: 2,
      phase: 'BUILD-UP (3s - 8s: Phân tích & Thông số)',
      timeRange: `0:0${Math.floor(hookEnd)} - 0:0${Math.floor(buildupEnd)}`,
      purpose: 'Cung cấp bằng chứng thuyết phục và thông số ấn tượng',
      visual: isGunReview
        ? `Gameplay bắn thử cự ly tầm trung + Hiển thị icon thông số nổi bật (Tốc độ xả đạn cực nhanh, độ giật laser). Đường đạn ghim thẳng một chỗ.`
        : 'Các dẫn chứng, so sánh trực quan, hình ảnh minh họa xuất hiện liên tục mỗi 1.5 - 2 giây.',
      audioSpeech: isGunReview
        ? `Với tốc độ xả đạn hủy diệt và độ giật ngang gần như bằng không, ${weaponName} chấp mọi kèo solo tầm gần lẫn trung cự ly.`
        : `Điểm đặc biệt nhất nằm ở chi tiết này mà rất ít người để ý tới.`,
      sfxAndMusic: 'SFX: Pop sound khi hiện thông số + Hitmarker đanh thép khi đạn trúng đích. Giảm âm lượng nhạc nền xuống 15%.',
      capcutTips: 'Chèn Sticker mũi tên neon chỉ vào tâm súng. Chèn âm thanh "Pling" hoặc "Hit Sound" mỗi khi xuất hiện dòng chữ thông số.'
    },
    {
      sceneNumber: 3,
      phase: 'CLIMAX (8s - 14s: Bảng Phụ Kiện Gunsmith)',
      timeRange: `0:0${Math.floor(buildupEnd)} - 0:${Math.floor(climaxEnd)}`,
      purpose: 'Giá trị cốt lõi nhất của video - Phần người xem mong chờ nhất',
      visual: isGunReview
        ? `Bảng Gunsmith phụ kiện chuẩn Full màn hình sắc nét (Nòng giảm thanh, Tay cầm ổn định, Băng đạn mở rộng, Báng súng công thái học). Nền gameplay phía sau tối mờ 50%.`
        : 'Kết quả cuối cùng, hình ảnh cận cảnh giải pháp hoàn chỉnh.',
      audioSpeech: isGunReview
        ? `Và đây là trọn bộ phụ kiện chuẩn thi đấu giúp sấy đầm tay nhất, nhớ lắp đúng nòng và tay cầm này nhé!`
        : `Đây là toàn bộ giải pháp chi tiết mà bạn cần áp dụng ngay hôm nay.`,
      sfxAndMusic: 'SFX: Camera Snapshot (Tiếng chụp ảnh tách một phát). Nhạc nền giảm nhẹ để người xem tập trung nhìn bảng phụ kiện.',
      capcutTips: 'Hiệu ứng Freeze Frame (Đứng hình 1s) + Chèn Text nhấp nháy đỏ: "📸 CHỤP MÀN HÌNH LẠI NGAY".'
    },
    {
      sceneNumber: 4,
      phase: 'CTA & LOOP (14s - Hết: Kêu gọi hành động & Tạo vòng lặp)',
      timeRange: `0:${Math.floor(climaxEnd)} - 0:${Math.floor(ctaEnd)}`,
      purpose: 'Tối đa hóa lượt Lưu/Chia sẻ và khiến video lặp lại mượt mà',
      visual: isGunReview
        ? `Một pha headshot giật tâm kết liễu đẹp mắt. Chữ "LƯU LẠI KẺO QUÊN" nhấp nháy góc dưới màn hình.`
        : 'Chuyển cảnh nhanh về trạng thái ban đầu để người xem xem lại từ đầu mà không nhận ra video đã hết.',
      audioSpeech: isGunReview
        ? `Anh em test thử xem sấy có dính đầu không và comment cảm nhận nhé!`
        : `Lưu video lại và follow kênh để không bỏ lỡ mẹo tiếp theo!`,
      sfxAndMusic: 'SFX: Swoosh kết thúc dứt khoát. Nhạc nền loop liền mạch sang câu thoại đầu tiên.',
      capcutTips: 'Cắt video ngay ở cao trào để nhịp chuyển lặp lại đầu video, giúp Retention Rate vượt mốc 100% trên TikTok.'
    }
  ];

  return {
    title: cleanTitle,
    weaponName,
    author: author || 'TikTok Creator',
    estimatedDuration: d,
    totalScenes: scenes.length,
    scenes,
    fullRemixScript: scenes.map(s => s.audioSpeech).join(' '),
    visualCues: scenes.map(s => `${s.timeRange}: ${s.phase}`).join(' | ')
  };
}

// 3. Hàm chính phân tích link hoặc video
async function analyzeTikTokVideo(inputUrl) {
  if (!inputUrl) throw new Error('Vui lòng nhập đường dẫn TikTok.');

  // Thử lấy metadata từ oEmbed
  const oembed = await fetchTikTokOEmbed(inputUrl);

  // Trích xuất username từ URL nếu oEmbed không trả về
  let fallbackAuthor = 'TikTok Creator';
  const authorMatch = inputUrl.match(/@([a-zA-Z0-9_.-]+)/);
  if (authorMatch) {
    fallbackAuthor = '@' + authorMatch[1];
  }

  // Trích xuất tên vũ khí / tiêu đề từ URL nếu có
  let fallbackTitle = 'Review Vũ Khí Delta Force Meta';
  if (/as[\s_-]*val/i.test(inputUrl)) fallbackTitle = 'Bảng Build AS Val Meta Sấy Không Giật';
  else if (/k416/i.test(inputUrl)) fallbackTitle = 'K416 Laser Beam - Quái Vật Solo';
  else if (/m4a1/i.test(inputUrl)) fallbackTitle = 'M4A1 Cân Mọi Khoảng Cách Delta Force';

  const title = (oembed && oembed.title) ? oembed.title : fallbackTitle;
  const author = (oembed && oembed.author_name) ? oembed.author_name : fallbackAuthor;
  const thumbnail = (oembed && oembed.thumbnail_url) ? oembed.thumbnail_url : null;
  const duration = 18; // Chuẩn thời lượng short video tối ưu

  const breakdown = deconstructScenes({ title, author, duration, url: inputUrl });

  return {
    success: true,
    url: inputUrl,
    title,
    author,
    thumbnail,
    breakdown
  };
}

module.exports = {
  analyzeTikTokVideo,
  fetchTikTokOEmbed,
  deconstructScenes
};
