const fs = require('fs');
const path = require('path');
const config = require('./config');

const overlaysDir = path.resolve(__dirname, '..', 'assets', 'overlays');
if (!fs.existsSync(overlaysDir)) fs.mkdirSync(overlaysDir, { recursive: true });

async function downloadFile(url, destPath) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    if (buf.byteLength > 2000) { // Bỏ qua icon quá nhỏ
      fs.writeFileSync(destPath, buf);
      return { success: true, path: destPath, size: buf.byteLength };
    }
  } catch (err) {
    console.error(`Lỗi tải ${url}:`, err.message);
  }
  return null;
}

async function scrapeGameWithWeapon(url = 'https://gamewith.jp/deltaforce/475463') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không thể truy cập ${url} (HTTP ${res.status})`);
  const html = await res.text();

  // 1. Tên vũ khí
  let weaponName = 'Vũ khí Delta Force';
  const titleMatch = html.match(/【デルタフォース】([^の]+)の評価と性能/i) || html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    weaponName = titleMatch[1].trim();
  }
  const cleanId = weaponName.toLowerCase().replace(/[^a-z0-9]/g, '_');

  // 2. Tìm tất cả các hash ảnh của bài viết
  const hashes = [];
  const hashRegex = /https:\/\/img\.gamewith\.jp\/img\/(?:original_)?([a-zA-Z0-9]{32})\.png/gi;
  let m;
  while ((m = hashRegex.exec(html)) !== null) {
    const hash = m[1];
    if (!hashes.includes(hash)) {
      hashes.push(hash);
    }
  }

  // 3. Tải tất cả các ảnh chất lượng cao (original_) về kho assets/overlays
  const downloadedImages = [];
  let index = 1;

  for (const hash of hashes) {
    const originalUrl = `https://img.gamewith.jp/img/original_${hash}.png`;
    const fallbackUrl = `https://img.gamewith.jp/img/${hash}.png`;
    const filename = `${cleanId}_img_${index}.png`;
    const dest = path.join(overlaysDir, filename);

    // Thử tải link original trước, nếu không được thì tải link thường
    let dl = await downloadFile(originalUrl, dest);
    if (!dl) {
      dl = await downloadFile(fallbackUrl, dest);
    }

    if (dl) {
      let label = `Ảnh Phụ Kiện #${index}`;
      if (index === 1) label = '🎯 Bảng Build 1 (Operations - Chiến Dịch)';
      else if (index === 2) label = '⚔️ Bảng Build 2 (Warfare - Chiến Tranh)';
      else if (index === 3) label = '⚙️ Chi tiết bộ phận phụ kiện #1';
      else if (index === 4) label = '⚙️ Chi tiết bộ phận phụ kiện #2';

      downloadedImages.push({
        index,
        filename,
        label,
        sizeKb: Math.round(dl.size / 1024),
        localPath: dest,
        webUrl: `/overlays/${filename}?t=${Date.now()}`
      });
      index++;
    }
  }

  // 4. Bảng thông số kỹ thuật
  const stats = {
    damage: '29',
    fireRate: '972',
    armorDamage: '48',
    range: '27m',
    magSize: '15',
    soundRange: '100m'
  };

  const damageMatch = html.match(/基本ダメージ\s*<\/th>\s*<td>\s*(\d+)/i) || html.match(/基本ダメージ\s*(\d+)/i);
  if (damageMatch) stats.damage = damageMatch[1];

  const fireRateMatch = html.match(/連射速度\s*<\/th>\s*<td>\s*(\d+)/i) || html.match(/連射速度\s*(\d+)/i);
  if (fireRateMatch) stats.fireRate = fireRateMatch[1];

  const armorMatch = html.match(/アーマーダメージ\s*<\/th>\s*<td>\s*(\d+)/i) || html.match(/アーマーダメージ\s*(\d+)/i);
  if (armorMatch) stats.armorDamage = armorMatch[1];

  const rangeMatch = html.match(/最適射程\s*<\/th>\s*<td>\s*([^<]+)/i) || html.match(/最適射程\s*(\d+m?)/i);
  if (rangeMatch) stats.range = rangeMatch[1].trim();

  const magMatch = html.match(/マガジン弾数\s*<\/th>\s*<td>\s*(\d+)/i) || html.match(/マガジン弾数\s*(\d+)/i);
  if (magMatch) stats.magSize = magMatch[1];

  const soundMatch = html.match(/銃声拡散距離\s*<\/th>\s*<td>\s*([^<]+)/i) || html.match(/銃声拡散距離\s*(\d+m?)/i);
  if (soundMatch) stats.soundRange = soundMatch[1].trim();

  // 5. Kịch bản TikTok bắt tai, ngắt nhịp đúng phong cách CapCut Creator
  const videoId = `DF_${cleanId}_review`;
  const voiceText = `Khẩu súng trường ${weaponName} trong Delta Force hiện tại bá đạo cỡ nào? Sở hữu tốc độ xả đạn lên tới ${stats.fireRate} viên một phút, sát thương giáp ${stats.armorDamage} điểm và tích hợp sẵn nòng giảm thanh. Điểm yếu duy nhất là băng đạn mặc định chỉ 15 viên. Đây là hai bảng build phụ kiện chuẩn meta cho cả chế độ Chiến Dịch và Chiến Tranh giúp anh em sấy đầm tay triệt tiêu giật ngang, nhớ lưu lại video kẻo quên nhé!`;

  const visualCues = `0s: Hook khẩu ${weaponName} | 4s: Build 1 Operations giảm giật | 10s: Build 2 Warfare sấy tầm trung | 15s: Kêu gọi lưu video`;

  return {
    success: true,
    weaponName,
    videoId,
    url,
    stats,
    images: downloadedImages,
    voiceText,
    visualCues,
    recommendedVoice: 'vi-VN-NamMinhNeural',
    recommendedSpeed: '+12%'
  };
}

module.exports = { scrapeGameWithWeapon };
