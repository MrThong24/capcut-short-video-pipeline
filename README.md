# WORKFLOW SẢN XUẤT VIDEO NGẮN HÀNG LOẠT (SHORT-VIDEO FACTORY)

> Hệ thống tự động hóa kết hợp giữa **Node.js (Xử lý âm thanh & dữ liệu)** và **CapCut Desktop (Lắp ráp Timeline)** cho video review game (Delta Force, VLTK1, Meme).

---

## 🗂️ Cấu trúc thư mục Workspace

```text
D:\Capcut\New\
├── scripts\
│   ├── scripts_input.csv        # File bảng tính kịch bản chính (CSV UTF-8)
│   └── scripts_sample.json      # File mẫu định dạng JSON (dành cho API)
├── assets\
│   ├── gameplay\                # Kho footage nền 9:16 (DF K416, VLTK1 combat)
│   ├── memes\                   # Green screen meme, funny video (.mp4)
│   ├── overlays\                # Ảnh thông số, chỉ số trang bị + safe_zone_tiktok_9x16.svg
│   ├── sfx\                     # Hiệu ứng âm thanh (whoosh, pop, punch)
│   └── README.md                # Quy ước đặt tên file tài nguyên
├── output_audio\
│   ├── [ID].mp3                 # File audio TTS đã render theo đúng mã video
│   └── ASSEMBLY_GUIDE.md        # Cẩm nang tóm tắt Visual Cues để editor kéo thả
├── node_tools\                  # Bộ công cụ tự động hóa Node.js
│   ├── package.json
│   ├── config.js                # Cấu hình giọng, tốc độ, thư mục
│   ├── tts_runner.js            # Tool chính quét kịch bản & tải voice
│   └── .env.example             # Mẫu biến môi trường
└── README.md
```

---

## 🚀 Hướng Dẫn Sử Dụng Theo 5 Giai Đoạn

### Giai đoạn 1: Chuẩn bị kịch bản (Scripting)
1. Mở file [scripts_input.csv](file:///D:/Capcut/New/scripts/scripts_input.csv) bằng Excel, Google Sheets hoặc Notepad.
2. Nhập các cột:
   - `video_id`: Mã duy nhất (VD: `DF_K416_meta`, `VLTK1_NgaMi_Thuy`).
   - `voice_name`: Giọng đọc (`vi-VN-NamMinhNeural` cho giọng nam review súng / `vi-VN-HoaiMyNeural` cho giọng nữ).
   - `speed`: Tốc độ nói (Khuyên dùng `+10%` đến `+15%` để giữ nhịp cuốn hút của video ngắn).
   - `voice_text`: Kịch bản đọc (ngắt nghỉ bằng dấu phẩy `,` hoặc chấm `.`).
   - `visual_cues`: Ghi chú mốc thời gian để thả asset (VD: `0s: Gameplay | 5s: Meme batngo | 10s: Overlay thongso`).
   - `status`: Để `pending` cho các video mới.

### Giai đoạn 2: Tự động hóa tải Voice AI (Node.js)
Mở Terminal tại thư mục `node_tools` và chạy lệnh:
```bash
npm start
```
- Tool sẽ tự động quét các dòng `pending`, tải giọng đọc Edge TTS (miễn phí 100%, chất lượng cao), lưu thành `output_audio/[ID].mp3`.
- Tự động sinh file cẩm nang [ASSEMBLY_GUIDE.md](file:///D:/Capcut/New/output_audio/ASSEMBLY_GUIDE.md) liệt kê sẵn checklist từng đoạn để bạn đối chiếu.
- Nếu muốn render lại tất cả các file đã có:
```bash
npm run tts:force
```

### Giai đoạn 3: Phân loại tài nguyên (Asset Preparation)
- Ném các clip quay sẵn vào `assets/gameplay/`.
- Ném meme vào `assets/memes/`.
- File ảnh thước đo căn lề an toàn: [safe_zone_tiktok_9x16.svg](file:///D:/Capcut/New/assets/overlays/safe_zone_tiktok_9x16.svg).

### Giai đoạn 4: Lắp ráp cơ học trên CapCut Desktop
1. Tạo 1 Project Master với **3 tầng Track cố định**:
   - **Track 1 (Trên cùng)**: Safe-Zone SVG (tắt mở mắt khi cần) + Ảnh Overlays / Memes.
   - **Track 2 (Ở giữa)**: Video gameplay nền 9:16.
   - **Track 3 (Ở dưới)**: Audio (Voice AI ở trên, Nhạc nền BGM chỉnh âm lượng 10-15% ở dưới).
2. **Quy trình lắp ráp 4 bước siêu tốc**:
   - Bước 1: Kéo `[video_id].mp3` vào Track Audio -> Bấm **Auto-captions** tiếng Việt -> Chọn 1 style animation nảy chữ đồng nhất.
   - Bước 2: Kéo video Gameplay vào Track giữa, cắt đúng bằng độ dài audio.
   - Bước 3: Mở file `output_audio/ASSEMBLY_GUIDE.md`, nhìn các mốc Visual Cues và thả ảnh/meme tương ứng vào Track trên cùng.
   - Bước 4: Nhấn `Ctrl + A` -> Chuột phải chọn **Create Compound Clip** (hoặc kéo sang phải trên timeline) để lắp video tiếp theo.

### Giai đoạn 5: Render & Xuất bản (Export)
- Dùng phím tắt **`I` (Mark In)** và **`O` (Mark Out)** để chọn vùng video cần render trên timeline.
- Bấm **Ctrl + E** xuất file MP4 1080x1920 (60fps).
- Đánh dấu hoàn thành trên file kịch bản.

