# Changelog — Final Low First

- Nền HTML: `ORBITA_FROM_ORIGINAL_ORB_ONLY.html`.
- **`src/store.ts`**: Chế độ mặc định `high` → `low`.
- **`src/scene/Experience.tsx`**: Bỏ tự hạ chất lượng của `PerformanceMonitor`; phím Q phải vượt High Guard mới đổi sang High; khi High hợp lệ, Q đổi về Low thủ công; cấu hình render vẫn giữ nguyên Low/High và MSAA/Bloom của bản đã chọn.
- **`src/highGuard.ts`** (mới): Theo dõi FPS Low, kiểm tra GPU/WebGL2 và chạy thử render-target MSAA 4× ngoài canvas trước khi duyệt High; bị từ chối thì khóa High cho phiên này.
- **`src/audio.ts`** (chỉ trong source): Đồng bộ phần piano tổng hợp fallback đã có trong HTML nền để nguồn có thể phát triển độc lập dù ZIP không kèm samples MP3.
- **Không đổi**: `Orb`, `Sky`, `Robot`, `Piano` render, `Rubik`, `Platform`, `Phenomena`, `Post` params, âm thanh 3D trong HTML nền, các module/đối tượng khác.
