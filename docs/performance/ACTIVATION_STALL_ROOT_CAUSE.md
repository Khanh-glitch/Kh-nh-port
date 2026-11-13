# Vì sao bấm beacon / piano / robot bị khựng & "mảng đen" — và đã sửa gì

Nhánh: `arena/d4163fde-kh-nh-port` (base `09774cc`). Không có thay đổi nào làm
giảm chất lượng nhìn: không bớt mesh, không hạ shadow map, không đổi shader,
không hạ render scale, không tắt postprocessing.

## 1. Nguyên nhân gốc (đã xác minh trong mã three.js 0.187)

`WebGLPrograms.getParameters()` đưa `numPointLights: lights.point.length` vào
khoá cache shader; `WebGLProgram` thay `NUM_POINT_LIGHTS` bằng số đó. Nghĩa là
**chỉ cần một point light chuyển `visible = false → true`** thì *mọi* material
nhận sáng trong toàn cảnh (kèm cả biến thể shadow của mặt trời) phải có Program
mới, và lần compile đầu tiên xảy ra ngay trong frame của cú click.

Đó chính là "khựng + mảng đen" khi kích hoạt:

| Nơi kích hoạt | Light được bật khi bấm |
| --- | --- |
| Beacon (tín hiệu) | **6 point light** của 6 icon social, mỗi cái nằm trong `<group visible={false}>` |
| APEX / Ragnarok | mắt laser, lửa, đèn đảo (đã được giữ mount từ trước) |
| Piano / Stage / Cinema | đèn sân khấu, đèn phòng chiếu (luôn mount, chỉ đổi cường độ) |

Beacon là trường hợp nặng nhất: 6 light xuất hiện cùng lúc ⇒ 6 lần tăng
`NUM_POINT_LIGHTS` trong một frame.

## 2. Cách sửa (giữ nguyên 100% hình ảnh)

1. **SocialDrops (beacon)** — 6 lamp được mount thường trực ở cường độ 0 và
   được gán vị trí theo icon mỗi frame. Số light của scene không bao giờ đổi,
   nên không có Program mới nào được compile khi phát tín hiệu. Ánh sáng nhìn
   thấy giống hệt: cùng màu, cùng cường độ 2.6, cùng khoảng cách 5, đi theo icon.
2. **Prewarm bất đồng bộ** — material của icon là `MeshPhysicalMaterial`
   (clearcoat), một biến thể shader riêng. 6 biến thể này được `compileAsync`
   lần lượt lúc rảnh (cách nhau 320 ms, bắt đầu sau 1.2 s, dừng ngay khi người
   dùng phát tín hiệu). Không dùng geometry giả, không đổi material.
3. **Panel hồ sơ là thẻ nổi** — không còn gradient tối full-screen, không còn
   div chặn click; lớp ngoài `pointer-events: none`, chỉ thẻ nhận input. Người
   xem vẫn nhìn thấy sân khấu và vẫn xoay được camera.
4. **Sheet "Tạm dừng"** — trước đây mất pointer-lock là hiện ngay tấm tối
   full-screen + `backdrop-blur`. Giờ trễ 180 ms và không còn blur; một nhịp
   lock bị rơi không còn tạo "mảng đen", còn pause thật vẫn hiện y như cũ.
5. **Beacon không tự mở hồ sơ** — tín hiệu chỉ là hiệu ứng thế giới (beam,
   vòng sáng, icon, toast). Hồ sơ chỉ mở khi bấm đúng thẻ nổi hoặc nhấn `E`.
6. **Minimap** — bỏ ghi `transform` chuỗi mỗi frame (dùng `setMatrix`), bỏ qua
   frame khi người chơi đứng yên, và chỉ mount khi thực sự nhìn thấy.
7. **HUD** — thanh tiến trình nhạc ghi thẳng vào DOM thay vì `setState` mỗi
   120 ms; pill gợi ý và toast bỏ `backdrop-filter` (nguyên nhân khiến
   compositor phải blur lại vùng canvas mỗi frame).
8. **Raycast & layout** — cache `getBoundingClientRect()` của canvas (trước đây
   gọi mỗi `pointermove`), raycast hover giới hạn ≤15 Hz với mảng kết quả dùng
   lại, danh sách target của `world.ts` chỉ dựng lại khi có thay đổi.
9. **Audio & vòng lặp** — automation khoảng cách chỉ lên lịch khi giá trị đổi;
   Robot/Phenomena không còn cấp phát `Color`/`Vector3` mỗi frame.

## 3. Kiểm chứng

- `tests/activation-no-light-recompile.mjs` (mới) khoá lại quy tắc "kích hoạt
  không được đổi số point light", cùng các hợp đồng panel nổi / beacon / pause.
- 62/62 module nhúng trong `index.html` parse sạch (`node --check`), mọi import
  đều resolve trong import map.
- `tsc --noEmit`: chỉ còn 4 lỗi có sẵn từ trước (`reality/RealityHost.tsx`,
  `reality/kit.tsx`), không phát sinh lỗi mới.
- Các cổng đang xanh: `activation-no-light-recompile`, `colossus-hitch-contracts`,
  `hex-preservation`, `integration-regression`, `piano-colossus-integration`,
  `space-first-entry-contract`. Hai cổng `colossus-regression` và
  `first-visit-hitch` **vốn đã fail trên cây gốc** (lệch offset source-vs-shipped),
  không liên quan thay đổi này.

## 4. Chưa kiểm chứng được (nói rõ)

Sandbox không tải được Chromium (`playwright install chromium` bị chặn mạng),
nên **không có** đo FPS/rAF hay ảnh chụp trong trình duyệt thật. Toàn bộ kết
luận ở trên dựa trên mã nguồn three.js, hợp đồng tĩnh và các cổng test. Cần một
lần đo thủ công trên máy thật (Chrome Performance, bấm beacon → piano → colossus)
để xác nhận bằng số.

---

# Vòng 3 — vì sao lần trigger HEX đầu tiên vẫn khựng (đã sửa)

Câu hỏi: preflight đã chạy lúc idle, tại sao cú click piano đầu tiên vẫn
khựng vài giây và tối màn hình?

## 5. Nguyên nhân gốc #3: preflight compile SAI biến thể shader

three.js r187 đưa `outputColorSpace` vào **khoá cache chương trình**, và giá
trị đó được suy ra từ **render target đang bind**, không phải từ material:

```js
// WebGLPrograms.js:217  (getParameters)
outputColorSpace: ( currentRenderTarget === null )
  ? renderer.outputColorSpace                       // sRGB  — vẽ thẳng ra canvas
  : ( currentRenderTarget.isXRRenderTarget === true
        ? currentRenderTarget.texture.colorSpace
        : ColorManagement.workingColorSpace )       // Linear-sRGB
// WebGLPrograms.js:454  (getProgramCacheKeyParameters)
array.push( parameters.outputColorSpace )
```

`EffectComposer` (Bloom/ACES) **luôn bind target riêng** cho `RenderPass`, nên
mọi material của HEX thực tế được vẽ bằng biến thể **Linear-sRGB**. Trong khi
đó preflight cũ gọi `gl.compileAsync(obj, camera, scene)` khi
`currentRenderTarget === null` ⇒ sinh ra biến thể **sRGB**.

Hai khoá cache khác nhau ⇒ **không một chương trình nào preflight tạo ra được
tái sử dụng**. Đúng như trace Metal đã ghi:

| Bằng chứng đã có trong repo | Nội dung |
| --- | --- |
| `docs/hex/HEX_FIRST_DRAW_EVIDENCE_20261111.md` (run 42958734925) | compile cả scene thật: submit 6–15 ms nhưng `cached program count 113 → 113`, và vẫn **24–27 program link on-demand** ở frame click đầu tiên |
| run 42956942228 | `getProgramInfoLog` chiếm **9.116 ms** cộng dồn (max 1.091 ms/lần) ngay trong frame HEX đầu tiên; `bufferData` chỉ 7 ms |

Đây cũng giải thích vì sao "compile cả scene" không giúp gì: nó compile rất
nhanh, nhưng compile **nhầm biến thể**, nên chỉ tạo thêm chương trình chết.

Lưu ý: `onFirstUse()` (uniform/attribute location) chỉ chạy ở **lần draw đầu**,
nên chi phí đồng bộ driver luôn rơi vào frame click — kể cả khi chương trình đã
được compile sẵn. Vì vậy chỉ sửa khoá cache là chưa đủ; nó là điều kiện cần.

## 6. Cách sửa

1. **Bind target Linear trong preflight** (`RealityHost.tsx`): đúng target
   `LinearSRGBColorSpace` 4×4 đã có sẵn được bind trong `compileHexCooperatively`
   trước `gl.compileAsync`, nên công việc idle *đã được lên lịch* giờ sinh ra
   biến thể dùng được. Không thêm submission, không thêm draw (`gl.compile`
   chỉ dựng program), và mọi state renderer được trả lại trước khi callback
   kết thúc. → Bật **mặc định**; `?hexCooperativeLinear=0` để tắt, và đường
   chẩn đoán `?colossusPostProbe=off` (không composer, vẽ thẳng sRGB) tự động
   không bật để không compile biến thể nó không hề vẽ.
2. **Shadow depth variant** (cùng lỗi): `WebGLShadowMap` bind `shadow.map`
   (cũng là target non-null/non-XR) trước khi vẽ `MeshDepthMaterial`, nên các
   biến thể depth cũng là Linear và cũng link trễ. Chúng là những link lạnh
   cuối cùng sau khi sửa queue chính. → Bật **mặc định**;
   `?hexShadowProgramWarm=0` để tắt. Không đổi shadow map 2048, không đổi
   material gốc, không vẽ preview; chỉ mượn geometry/instancing flag của mesh
   gốc để chọn đúng biến thể (<10 item).
3. **Giữ nguyên những gì đã bị loại**: không tắt `debug.checkShaderErrors`,
   không ẩn world, không hạ PBR→Basic, không đổi thứ tự instance. Priming
   `getUniforms()/getAttributes()` để đẩy sync driver sang frame idle **vẫn là
   opt-in** (`?hexShadowProgramWarm=1&hexPrimeFirstUse=1`) vì nó đánh đổi
   "click mượt" lấy "intro khựng" — một đánh đổi đã bị loại bỏ.

## 7. Cổng kiểm chứng mới

`tests/hex-preflight-program-variant.mjs` khoá lại: target preflight phải là
`LinearSRGBColorSpace`, phải bật mặc định kèm cờ tắt rõ ràng, phải restore
target/viewport/scissor, shadow warm phải bật mặc định, scheduler vẫn giữ gate
2 healthy paint + guard 120 ms, và các shortcut đã bị loại không được quay lại.
Cổng này đọc cả `index.html` đã ship, nên bản standalone không thể lệch.

## 8. Chưa kiểm chứng được (nói rõ)

Vẫn **không có** đo FPS/rAF/ảnh chụp thật: sandbox không tải được Chromium
(`playwright install chromium` bị chặn mạng). Kết luận trên là suy luận từ mã
three.js r187 + bằng chứng Metal đã có trong repo, chưa phải số đo mới. Cần một
lần đo trên máy thật (Chrome Performance: idle → click piano lần đầu) để xác
nhận thời gian khựng giảm và không phát sinh khựng ở intro. Nếu đo được, tiêu
chí chấp nhận là: (a) số program link trong frame click đầu tiên giảm mạnh,
(b) không frame idle nào > 120 ms, (c) ảnh HEX không đổi.
