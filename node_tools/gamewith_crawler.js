const fs = require('fs');
const path = require('path');
const config = require('./config');

const overlaysDir = path.resolve(__dirname, '..', 'assets', 'overlays');
if (!fs.existsSync(overlaysDir)) fs.mkdirSync(overlaysDir, { recursive: true });

async function downloadBestImage(urls, destPath) {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const arrayBuffer = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      // Ưu tiên ảnh có kích thước lớn (> 10KB) là ảnh súng/bản đồ phụ kiện
      if (buf.byteLength > 8000) {
        fs.writeFileSync(destPath, buf);
        return { success: true, url, size: buf.byteLength };
      }
    } catch (err) {
      console.error('Lỗi tải ảnh:', err.message);
    }
  }

  // Fallback tải ảnh đầu tiên nếu không có ảnh lớn
  if (urls.length > 0) {
    try {
      const res = await fetch(urls[0]);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buf = Buffer.from(arrayBuffer);
        fs.writeFileSync(destPath, buf);
        return { success: true, url: urls[0], size: buf.byteLength };
      }
    } catch (e) {}
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

  // 2. Tìm tất cả ảnh phụ kiện/vũ khí
  const images = [];
  const imgRegex = /data-original=["'](https:\/\/img\.gamewith\.jp\/img\/[a-zA-Z0-9]+\.png)["']/g;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    if (!images.includes(imgMatch[1])) {
      images.push(imgMatch[1]);
    }
  }

  // 3. Thông số kỹ thuật
  const stats = {
    damage: '29',
    fireRate: '972',
    armorDamage: '48',
    range: '27m',
    magSize: '15',
    soundRange: '100m',
    control: '43',
    handling: '62',
    stability: '51'
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

  // 4. Tải ảnh chính về thư mục assets/overlays
  const cleanId = weaponName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `GUN_${cleanId}.png`;
  const destPath = path.join(overlaysDir, filename);
  
  const dlRes = await downloadBestImage(images, destPath);
  const localImageUrl = `/overlays/${filename}?t=${Date.now()}`;

  // 5. Sinh kịch bản voice tiếng Việt ngắn gọn, cuốn hút
  const videoId = `DF_${cleanId}_meta`;
  const voiceText = `Đánh giá sức mạnh khẩu súng ${weaponName} trong Delta Force. Với tốc độ xả đạn lên tới ${stats.fireRate} viên một phút, sát thương giáp ${stats.armorDamage} điểm và tầm bắn hiệu quả ${stats.range}, đây là nỗi khiếp sợ ở cự ly tầm gần. Khẩu súng này tích hợp sẵn nòng giảm thanh giúp hạn chế lộ vị trí trên bản đồ. Nhược điểm duy nhất là băng đạn mặc định chỉ có ${stats.magSize} viên, anh em bắt buộc phải nâng cấp băng đạn mở rộng và tay cầm kiểm soát độ giật để sấy đầm tay nhất nhé!`;

  const visualCues = `0s: Ảnh thông số ${weaponName} | 4s: Tốc độ xả đạn ${stats.fireRate} RPM | 8s: Phụ kiện khuyên dùng | 14s: Highlight sấy tầm gần`;

  return {
    success: true,
    weaponName,
    videoId,
    url,
    stats,
    images,
    localImageUrl,
    voiceText,
    visualCues,
    recommendedVoice: 'vi-VN-NamMinhNeural',
    recommendedSpeed: '+12%'
  };
}

module.exports = { scrapeGameWithWeapon };
