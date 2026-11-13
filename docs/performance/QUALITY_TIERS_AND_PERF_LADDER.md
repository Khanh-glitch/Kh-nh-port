# Ba mức chất lượng & thang hiệu năng đo được

Nhánh `arena/d4163fde-kh-nh-port`. Chuyển mức bằng **Q**:
`thấp → cao → hiệu năng → thấp`. Mặc định của khách vẫn là **thấp**.

## 1. HIGH — không đổi một pixel

`high` là đường cũ, nguyên vẹn: DPR `[1, 1.6]`, shadow 2048, đủ 5 pass hậu kỳ,
Bloom 8 mip, ACES. Mọi thay đổi của vòng này nằm ngoài nhánh đó; các cổng
`hex-preservation`, `colossus-hitch-contracts`, `hex-preflight-program-variant`
vẫn khoá đúng literal `[2048, 2048]` và `<Bloom intensity={low ? 0.9 : 1.25}>`,
nên High không thể bị hạ cấp do nhầm lẫn.

## 2. LOW — tối ưu sâu thêm, không đổi hình ảnh

Hai chỗ sinh ra "chớp khối vuông đen" đúng lúc trigger đã được sửa tại gốc:

**a. Texture thẻ nhạc piano** (`reality/Sheets.tsx`). Mỗi lần đổi bài — kể cả
lần trigger HEX đầu tiên — code cũ trả về **một `CanvasTexture` mới** cho mỗi
tờ nhạc (512×720) rồi mới upload. Texture vừa upload thì chưa "complete", nên
frame ngay sau trigger có thể sample texture rỗng → ô phẳng/đen. Giờ mỗi tờ có
**một** canvas + **một** texture, đổi bài chỉ vẽ lại vào canvas đó
(`needsUpdate`), pixel y hệt, nhưng không cấp phát gì trên frame trigger.

**b. Lớp phủ panel sân khấu** (`stage/ShowSystem.tsx`). `setLayer` cũ
`dispose()` texture rồi tạo `crispTexture(c)` mới mỗi lần đổi lớp — cùng cơ chế
vừa nêu, và đây là lớp **toàn màn hình** nên một frame sample rỗng là cả khung
hình đen. Giờ texture nằm trong pool theo lớp, canvas được tái sử dụng và chỉ
upload lại nội dung.

Cả hai đều không đổi độ phân giải texture, filter, colour space hay bất kỳ pixel
nào đã vẽ.

## 3. PERFORMANCE — thang đánh đổi có đo lường

Đây là phần bạn yêu cầu: ưu tiên hiệu năng nhưng **chỉ đánh đổi khi có lợi thật**,
và đo trên chính máy người dùng thay vì đoán theo tên thiết bị.

### 3.1 Thang 6 mức, xếp theo mức đánh đổi tăng dần

| Mức | Đánh đổi | Chi phí về mắt |
| --- | --- | --- |
| 0 | *không gì cả* | y hệt `low` — vào tier này chưa chắc đã mất gì |
| 1 | bỏ `Noise` + `Vignette` | mất hạt phim và viền tối; Bloom/ACES/ánh sáng giữ nguyên |
| 2 | render scale 0.85× | 15% ít pixel hơn; mesh/texture/shader không đổi |
| 3 | shadow 1024 | mép bóng mềm hơn; bóng tiếp xúc vẫn còn |
| 4 | Bloom 3 mip | quầng sáng gọn hơn, cùng pixel nguồn |
| 5 | render scale 0.72× | 28% ít pixel hơn; vẫn gấp rưỡi mức 0.5× dùng dưới phi thuyền |

Thứ tự này là **cố định và đơn điệu** (có test khoá): không bao giờ mức sau
"rẻ" hơn mức trước về mặt hình ảnh.

### 3.2 Cách nó quyết định (đo, không đoán)

```
1. Ngay khi vào tier: chạy mức 0 và đo ~1.2s  → baseline FPS của máy
2. Nếu baseline đã ≥ 55 FPS  → DỪNG, không mất gì
3. Nếu chưa: lên mức kế, bỏ ~0.4s settle, đo lại ~1.1s
4. Nếu mức đó không tăng ≥ 3.5 FPS  → đánh dấu "vô ích", HOÀN LẠI mức trước, dừng
5. Nếu đã ≥ 58 FPS  → hạ lại một mức để trả hình ảnh về
6. Lặp tới khi mượt, hoặc hết mức, hoặc hết thứ có tác dụng
```

Điểm quan trọng: **bước 4**. Một máy bị giới hạn ở CPU/driver sẽ không được
"đền" bằng cách bị bóp nghẹt hình ảnh mà không lên được FPS. Nếu mức 1 không
giúp, nó quay về mức 0 và báo thật: "máy giới hạn ở X FPS ngay cả khi chưa giảm
gì". Cũng không có chuyện rung bị đánh giá sai: một khung hình 5 giây do chuyển
tab bị loại khỏi cửa sổ đo (có test).

Mọi quyết định được công bố ở `window.__orbitaPerf`
(`rung`, `fps`, `worstFrameMs`, `mode`, `reason`, `futile`).

### 3.3 Đo trên máy thật

`source/src/perfReport.ts` chứa script dán vào DevTools console. Nó vào tier
performance như phím Q, đo **cả 6 mức** bằng `requestAnimationFrame` thật
(fps, p50, p95, p99, số frame), in bảng và để lại `window.__orbitaPerfReport`.
Dùng `window.__orbitaPerfForceRung(n)` để ghim một mức khi cần so sánh A/B.

### 3.4 Không âm thầm

Khi ở tier performance, HUD hiện ở góc dưới phải: `HIỆU NĂNG` + mức hiện tại và
đánh đổi cụ thể. Người xem luôn biết mình đang mất gì. Nút Q ở HUD cũng hiện
đúng tên mức đang dùng.

Nếu máy bị cổng GPU từ chối High, phím Q **không bị nuốt**: nó đi thẳng sang
performance và nói rõ lý do, vì đó chính là máy cần tier này nhất.

## 4. Kiểm chứng

- `tests/perf-tier-ladder.mjs` — biên dịch `perfLadder.ts` bằng esbuild của
  repo rồi chạy mô phỏng trên luồng frame tổng hợp. Bắt buộc:
  máy nhanh **không mất gì**; máy chỉ cần 1 mức thì dừng ở 1; máy yếu leo đúng
  số mức cần; **mức không giúp gì phải bị hoàn lại**; khung hình treo do chuyển
  tab không được kích hoạt hạ cấp; thang đơn điệu; High/Low không đọc concession;
  và `index.html` ship đủ 3 tier.
- `tests/hex-preservation.mjs`, `colossus-hitch-contracts.mjs` — vẫn khoá
  shadow 2048 và Bloom cho High/Low.
- Toàn bộ 11 cổng: 9 PASS, 2 FAIL (`colossus-regression`, `first-visit-hitch`)
  là lỗi có sẵn từ base commit, không liên quan.
- `tsc --noEmit`: chỉ còn 1 lỗi có sẵn (`kit.tsx:397`).
- 64/64 module nhúng trong `index.html` parse sạch.

## 5. Chưa kiểm chứng được

Sandbox không tải được Chromium nên **không có** số FPS thật. Phần *logic quyết
định* đã được kiểm bằng mô phỏng chạy đúng engine sẽ ship, nhưng ngưỡng tuyệt
đối (55/58 FPS, +3.5 FPS, 1.2s/1.1s) cần một lần đo trên máy thật mới nên chỉnh
được. Script ở §3.3 tồn tại đúng để làm việc đó.
