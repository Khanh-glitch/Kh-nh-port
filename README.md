# ORBITA — Final / Low First + Protected High

**Nền:** `ORBITA_FROM_ORIGINAL_ORB_ONLY` (bản bạn đã chọn), không dùng các bản V2, V3, SMAA hay giảm chất lượng vũ trụ.

## Mở nhanh

- Mở `index.html` bằng Chrome hoặc Edge (kết nối mạng để tải thư viện JavaScript từ CDN).
- `Low` là chế độ mặc định ở **mọi lần mở**, không phụ thuộc lựa chọn trước đó.
- Sau khi vào scene, phím `Q` yêu cầu bật `High`. Chế độ này **chỉ bật nếu**:
  1. Scene Low đã render đủ thời gian và đạt FPS ổn định (trung bình ≥57 FPS, p95 frame time ≤26 ms, không có frame >70 ms trong cửa sổ quan sát).
  2. WebGL2 hoạt động, đáp ứng thông số GPU cần cho render High (MSAA ≥4, texture ≥4096, renderbuffer đủ lớn); đồng thời đạt các ngưỡng cấu hình được trình duyệt cung cấp.
  3. Một WebGL2 context *riêng*, kích thước 64×64, tạo và resolve framebuffer MSAA 4× thành công, pixel kết quả không bị đen; framebuffer HDR HalfFloat 4× được tạo thành công.
- Chưa đủ dữ liệu: Q chưa bật High (có thể thử lại sau). Không đủ điều kiện thực sự: High **bị khóa cho phiên hiện tại**, nhấn Q tiếp không làm gì.
- Nếu High được phép bật, phím Q tiếp theo có thể trở lại Low.
- Không có cơ chế tự động đổi qua đổi lại High/Low theo FPS.

## Cấu trúc ZIP

```text
index.html                HTML độc lập, mở ngay để trải nghiệm
README.md                 Hướng dẫn và giới hạn
CHANGELOG.md              Những tệp đã chỉnh
source/                   Nguồn Vite/React/TypeScript có thể phát triển tiếp
  package.json
  package-lock.json
  vite.config.ts
  tsconfig.json
  src/
    highGuard.ts           Chính sách High và GPU preflight
    scene/Experience.tsx   Q gating, render và cấu hình Low/High
    store.ts               Mặc định Low
    audio.ts               Fallback piano khi không có samples MP3
    ...                    Toàn bộ source ORBITA còn lại
```

Để phát triển từ source: `cd source`, `npm ci`, `npm run dev`. Để build: `npm run build` (trong thư mục `source`). Khả năng tải dependency phụ thuộc Internet.

## Cam kết và giới hạn kỹ thuật

Các vật thể, shader, scene, bóng đổ, cấu hình Bloom/High/Low giữ đúng bản **From Original Orb Only**. Chỉ thay đổi **cơ chế quyền truy cập chế độ High** và mặc định Low.

**Không thể cam kết tuyệt đối không xuất hiện màn hình đen trên mọi driver/GPU:** Trình duyệt không cung cấp API nào có thể chứng minh trước rằng cả scene WebGL đầy đủ sẽ luôn render chính xác. Đây là chính sách **từ chối nếu không đủ dữ liệu**, có thử nghiệm framebuffer, và chặn thiết bị yếu; không phải bảo đảm chống lỗi driver. Máy mạnh vẫn có thể gặp lỗi độc lập từ shader, compositor hoặc trình điều khiển.
