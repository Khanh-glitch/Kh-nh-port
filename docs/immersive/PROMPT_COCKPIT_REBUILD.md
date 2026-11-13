# PROMPT — Thiết kế lại khoang lái phi thuyền (Kh-nh-port)

> **Cách dùng:** copy toàn bộ nội dung từ dòng "BẮT ĐẦU PROMPT" tới hết, dán vào
> một phiên Arena Agent Mode mới. Không cần đính kèm gì thêm — mọi link, lệnh và
> số liệu đã nằm trong prompt.

---

BẮT ĐẦU PROMPT

## 0. Bối cảnh phiên của bạn

Bạn nhận một repo có sẵn, đang chạy được, đã qua 10 vòng cải tiến. Nhiệm vụ của
bạn là **một vòng nữa**: thiết kế lại khoang lái phi thuyền từ tận gốc. Không
phải chỉnh sửa. Không phải thêm chi tiết. **Dựng lại.**

Người dùng đã nói rõ ba lần, theo ba cách khác nhau, rằng sản phẩm hiện tại
không đạt. Câu chấm gần nhất: *"vấn đề không phải tối, nó gần như không có gì"*.
Sau khi dựng lại, câu chấm tiếp theo vẫn là: *"nó vẫn là hộp"*. **Đó là chẩn
đoán đúng.** Đừng cố chứng minh ngược lại. Hãy đọc phần 2 để hiểu chính xác cái
gì sai.

Bạn có toàn quyền phát hiện vấn đề người dùng chưa thấy, nghiên cứu phương pháp
họ chưa biết, và thay đổi kiến trúc code nếu có cơ sở. Thứ bạn **không** có
quyền: hạ gate test, tuyên bố bất khả thi, hoặc báo cáo hiệu năng bằng số bịa.

## 1. Lấy code

```bash
git clone https://github.com/Khanh-glitch/Kh-nh-port.git
cd Kh-nh-port
git checkout arena/d4163fde-kh-nh-port   # HEAD = f6b6c4e
```

Nhánh này đã có 10 vòng cải tiến khoang lái. Nhánh `main` (base `09774ccf`) là
bản trước khi có khoang lái — dùng nó để đối chiếu nếu cần biết cái gì đã thay
đổi.

Môi trường tham chiếu đã kiểm chứng: **Node v22.22.3, npm 10.9.8**.

```bash
cd source/immersive
npm ci
```

Repo **không** commit `node_modules`. Không có lockfile lạ. `source/package-lock.json`
và `source/immersive/package-lock.json` đều có sẵn.

## 2. Cái gì đang sai, chính xác

### 2.1 Chẩn đoán

`source/immersive/src/cockpit/interior.ts` — **761 dòng** — hiện dựng khoang lái
bằng 85 mesh thường cộng 419 instance chia vào 3 batch `InstancedMesh`, tổng
6.748 tam giác.

Nhìn vào số thì có vẻ ổn. Nhìn vào ảnh thì không: đó là **một tập hợp hình hộp
có kích thước khác nhau**. Ba hàm `solid()`, `strip()`, `greeble()` — tất cả đều
nhận tham số `w, h, d` và sinh ra một `BoxGeometry`. Một tấm táp-lô là hộp. Một
cái tựa đầu là hộp. Một cái kẹp ống là hộp. 419 chi tiết kia cũng là hộp, chỉ
nhỏ hơn.

Mật độ đã tăng. **Hình thái thì không.** Không có một bề mặt cong nào, không có
một tiết diện nào được vuốt theo biên dạng, không có một chỗ nào hai vật liệu
gặp nhau theo cách thật, không có một chi tiết nào tồn tại vì nó *phải* tồn tại
để cái khoang đó chịu được lực hoặc để phi công vận hành được nó.

### 2.2 Vì sao lần trước thất bại

Không phải vì thiếu công sức — 419 instance là nhiều công. Thất bại vì **áp một
phương pháp dựng hình tổng quát cho mọi thứ**. Khi `greeble()` là công cụ duy
nhất, mọi vấn đề trông giống một cái đinh, và mọi giải pháp là một cái hộp.

Người dùng đã cảnh báo đúng điều này trong lần giao việc trước:
> *"Hãy tự khám phá cấu trúc thực của từng loại đối tượng, thay vì áp dụng một
> phương pháp dựng hình tổng quát cho mọi thứ."*

## 3. Thứ bạn phải làm trước khi viết một dòng code

**Đây là điều kiện tiên quyết. Đừng bỏ qua để đi nhanh.**

Nghiên cứu khoang lái thật. Không phải "gợi ý không khí phi thuyền" — **cấu
tạo**. Một buồng lái là một vật thể kỹ thuật có niên đại, có nhà sản xuất, có
quy chuẩn. Nó có những thứ sau, và mỗi thứ có lý do hình học riêng:

| Thành phần | Vì sao nó có hình dạng đó |
| --- | --- |
| **Glare shield** (tấm chắn loá) | Nhô ra trên bảng điều khiển, mặt trên nghiêng, để phi công không nhìn thấy phản xạ của chính bảng điều khiển trên kính chắn. Mép trước mỏng, có gờ cuộn. |
| **Coaming** (gờ vòm kính) | Dày, bọc đệm, vì phi công chống tay và va đầu vào đó khi tăng tốc. Tiết diện là một đường cong kín, không phải hộp. |
| **Instrument panel** | Không phẳng. Nghiêng về phía phi công, và *cong* theo hình trụ quanh đầu gối — vì tầm với của tay là một cung, không phải một đường thẳng. |
| **Centre pedestal** | Khối giữa hai đầu gối, thấp dần về phía trước, chứa throttle quadrant. Có vai (shoulder) nơi nó gặp bảng điều khiển. |
| **Canopy frame** | Các vòm (bow) tiết diện chữ C hoặc chữ Z, không phải thanh đặc. Kính gắn vào rãnh cao su, không dán phẳng lên mặt phẳng. |
| **Ejection seat / ghế** | Khung ống, đệm bọc, tựa lưng nghiêng ~17°, tựa đầu, dây đai 5 điểm, thanh chống. Bề mặt đệm *lún* ở chỗ ngồi. |
| **Rudder pedals** | Hai bàn đạp có gân chống trượt, trên một thanh xoay chung, đặt trong hốc sàn. |
| **Side console** | Mặt nghiêng theo tay, mép ngoài có gờ chắn để rơi đồ không lọt xuống. |
| **Overhead panel** | Chỉ có ở khoang lớn. Nếu bạn dựng nó, nó phải có bản lề, chốt, và một lý do để ở trên đó. |
| **Fasteners** | Bu-lông, vít, đinh tán phân bố theo **đường kết cấu** — theo xương (stringer) và sườn (frame), không rải ngẫu nhiên. |

Nguồn phải mở và đọc thật, không phải nhớ lại:

- NASA Technical Reports Server — https://ntrs.nasa.gov/ — tìm "crew station design",
  "human factors spacecraft cockpit", "Apollo command module interior".
- SpaceX Crew Dragon / Crew-1 interior press photos; Soyuz TMA descent module
  interior; Boeing 737NG flight deck; A-10C / F-16C cockpit layout diagrams.
- FAA / MIL-STD human factors handbook (MIL-STD-1472) — có bảng kích thước tầm
  với, góc nhìn, khoảng cách bảng điều khiển. Dùng số thật.
- Bất kỳ repository mã nguồn mở nào dựng khoang lái có chất lượng — tìm, clone,
  đọc, chạy thử. Ghi lại cái bạn học được và cái bạn quyết định không dùng.

**Ghi chú thiết kế bắt buộc:** những con số bạn dùng (khoảng cách mắt–bảng điều
khiển, góc nghiêng tựa lưng, chiều cao tầm với) phải **trích được nguồn**. Nếu
bạn chọn một con số vì nó "trông ổn" trong ảnh render, nói rõ đó là lựa chọn
thẩm mỹ, không phải số đo.

## 4. Tiêu chuẩn kỹ thuật cho hình học

Bạn phải dùng nhiều kỹ thuật dựng hình khác nhau, **mỗi kỹ thuật cho đúng thứ nó
sinh ra để làm**. Ba công cụ tối thiểu:

1. **Vuốt theo biên dạng (profile sweep / `ExtrudeGeometry` theo đường dẫn, hoặc
   `LatheGeometry` cho vật thể tròn xoay).** Dùng cho: gờ coaming, khung vòm,
   ống dẫn, tay vịn, thanh chống, vành màn hình. Một ống dẫn có tiết diện tròn
   bán kính 2 cm thì *là* hình trụ, không phải hộp xoay 45°.
2. **Tấm có độ dày thật (`rb()` đã có sẵn — bo góc).** Một tấm nhôm dày 2 mm bo
   góc 3 mm trông khác hẳn một hộp mỏng, ở góc cạnh và ở cách ánh sáng bắt mép.
3. **Instancing chỉ cho chi tiết lặp lại theo quy luật.** Bu-lông, đinh tán, khe
   thông gió, nút bấm — những thứ có *hàng trăm bản giống nhau và vị trí xác
   định bởi kết cấu*. Không dùng instancing để rải chi tiết trang trí.

Và **bắt buộc**:

- **Mỗi mối nối phải có cấu tạo.** Chỗ tấm này gặp tấm kia phải có một trong:
  gờ chồng mí, rãnh, gioăng, mối hàn có gân, hoặc khe hở có bóng. Không có hai
  bề mặt nào "dán" vào nhau mà không có gì ở giữa.
- **Mỗi chi tiết phải có chức năng.** Trước khi thêm một hình khối, trả lời được:
  nó giữ cái gì, che cái gì, hay phi công chạm vào nó để làm gì. Nếu không trả
  lời được, đừng thêm.
- **Tiết diện phải đúng.** Ray trượt là chữ C. Khung là chữ Z. Gioăng là chữ U.
  Ống là tròn rỗng. Cáp là bó nhiều sợi. Đây là những thứ mà một rasteriser
  nhìn nghiêng sẽ bắt được ngay, và một `BoxGeometry` không bao giờ có.

## 5. Ràng buộc tuyệt đối — không được phá

Đây là repo đang chạy thật. Mỗi dòng dưới đây là một thứ đã từng bị phá và đã
được sửa; phá lại là mất việc của cả 10 vòng.

1. **Scene ngoài (island / vũ trụ) không được đổi một pixel.** Khoang lái là
   build riêng: `assets/immersive/index.html`, sinh ra bởi
   `scripts/sync-space-first-standalone.mjs`. Bản island nhúng trong `index.html`
   gốc phải giữ **64 module, 0 thay đổi**. Kiểm bằng cách giải mã
   `orbita-embedded-map` trong `index.html` và so với bản ở commit base.
2. **Phím chọn: đúng sáu, đúng hai hàng.** `KEY_R = 2.10`, nhưng **bán kính thật
   của cột ngoài cùng là `cos(angle) × 2.10 ≈ 1.94`**. Mọi phép chiếu phải dùng
   1.94. Dùng 2.10 là hàng 2 bị cắt ở 99.7% chiều cao khung — lỗi này đã xảy ra
   hai lần.
3. **Sáu phím phải nằm trong 60–96.5% chiều cao khung; màn hình chính 10–66%.**
   `tests/cockpit-layout.mjs` đang cưỡng chế điều này và **đang PASS**. Đừng làm
   nó fail.
4. **Vòm kính phải mở phía trên `y ≈ 0.5`.** Đã hai lần dựng trần kín và cả hai
   lần biến khoang lái thành đường hầm, giết luôn thứ duy nhất khiến nó ra phi
   thuyền: không gian nhìn thấy qua kính. Test có một assertion cấm tấm trần
   toàn khổ `solid(2.10, 0.10, 2.80, …)`.
5. **Không thêm đèn.** Bộ đèn hiện tại là cố định và đã cân bằng:
   `sunLight(0xffe6c4, 4.4)` từ `(0,−1,0)`, `fill(0x4a86d8, 0.9)` tại
   `(0.7,−0.5,−0.3)`, `AmbientLight(0x22344f, 1)`, `cabinLight(0x9fd4ff, 1.1,
   4.2, 2)` tại `(0,0.15,−1.2)`, `cabinWarm(0xffc27a, 0.5, 3.0, 2)` tại
   `(0,−0.95,−1.55)`. Không shadow map. `PointLight` decay 2 → cường độ rơi theo
   `1/d²`. Thêm một đèn nữa là đổi toàn bộ cân bằng đã đo.
   **Nếu bạn cần sáng hơn, sửa hằng số cường độ, không thêm nguồn sáng.**
6. **`paintScreen()` phải luôn gọi với `scale = 1`.** Canvas nền là 1024×640
   (`MAIN_W × MAIN_H`). Gọi `scale = 2` làm transform gấp đôi trong khi backing
   store vẫn 1024×640 → chỉ một phần tư góc trên trái hiện ra, tên phi công đọc
   thành "LÊ QUỐC KH...". Lỗi này đã xảy ra và có test.
7. **`InstancedMesh` bắt buộc gọi `computeBoundingBox()` + `computeBoundingSphere()`.**
   Không có nó, three.js coi cả batch là khối đơn vị tại gốc camera: frustum
   culling sai, mọi phép đo `Box3` sau đó sai, và nó từng làm một tấm sàn 3 m
   báo kích thước 3.02 × 2.73 × 3.83.
8. **Không dùng chung geometry giữa `InstancedMesh` và mesh thường.** Mesh thường
   thừa hưởng bound của instance. Mỗi `solid()` phải có `BoxGeometry` riêng.
9. **`tsconfig.json` là strict + `noUnusedLocals` + `noUnusedParameters`.** Biến
   thừa là lỗi build.
10. **Tên thật chưa được xác nhận.** Khoang lái hiện ghi `LÊ QUỐC KHÁNH`;
    `source/src/content.ts` ghi `Lâm Anh Khoa`; git author là `Men Le`. **Không
    tự quyết định tên nào là đúng.** Giữ nguyên chuỗi hiện có và hỏi người dùng
    trước khi publish bất kỳ tên thật nào.

## 6. Bạn không có GPU. Đây là cách xử lý.

Môi trường này **không** có trình duyệt và không có GPU:

- `npx playwright install chromium` → fail
- `npm i gl` → fail
- `npm i canvas` → fail

Người dùng đã ra lệnh rõ: **không được dừng lại và tuyên bố bất khả thi.** Khi
thiếu công cụ, tìm đường khác và **giao bằng chứng**.

Vòng trước đã giải bằng cách tự viết một **rasteriser CPU** đọc thẳng scene graph
three.js và xuất PNG: duyệt `Mesh` + `InstancedMesh` (`matrixWorld ×
instanceMatrix`), chiếu tam giác, tô phẳng với Blinn-Phong có tone map, và
composite 7 quad màn hình thủ công (không dùng `CanvasTexture` — nó gọi DOM).
Công cụ đó sống ở `/tmp` và **đã mất**, không nằm trong repo. Bạn phải **dựng
lại và commit nó** vào `scripts/render-cockpit.mjs`, kèm ghi chú trong README
rằng đây là **render CPU, không phải WebGL**.

Ràng buộc kỹ thuật khi dựng lại:

- `@napi-rs/canvas` cài được nhưng ở `/tmp/node_modules` (không vào repo). Kiểm
  tra còn sống không trước khi giả định.
- Rasteriser rất dễ **sáng quá** nếu quên tone map hoặc để Blinn-Phong không
  giới hạn. Đã xảy ra hai lần. Ảnh phải trông giống bản ship, không phải bản
  "đẹp hơn".
- **Không bao giờ báo cáo FPS, không bao giờ nói "đã đo trên GPU", không bao giờ
  gọi ảnh CPU là screenshot.** Ghi rõ: "render CPU của hình học thật".

Nếu bạn tìm được đường khác tốt hơn — headless GL, WebGPU qua Dawn, một
rasteriser WASM, bất cứ thứ gì chạy được — dùng nó và ghi lại. Nhưng bạn phải
nhìn thấy ảnh trước khi nói mình đã xong.

## 7. Gate test — chạy trước và sau mỗi thay đổi

```bash
cd <repo-root>
node --test tests/*.mjs
```

**Lưu ý cú pháp:** phải là `tests/*.mjs`. `node --test tests/` chỉ chạy 1 test và
fail — đây không phải kết quả thật.

Baseline đã biết: **14 file, 22 test, 20 PASS, 2 FAIL**. Hai cái fail là
`colossus-regression.mjs` và `first-visit-hitch.mjs` — **có sẵn từ trước, không
liên quan khoang lái**. Đừng cố sửa chúng trong vòng này, và đừng để chúng thành
cái cớ che một regression mới.

Bốn gate liên quan trực tiếp:

| File | Cưỡng chế điều gì |
| --- | --- |
| `tests/cockpit-layout.mjs` | Bán kính thật 1.94 cho phép chiếu phím; phím 60–96.5%; màn hình 10–66%; phải có ghế, tựa đầu, bệ giữa, cần ga, vách sau, vòm kính, `InstancedMesh`; cấm trần kín |
| `tests/cockpit-prop-placement.mjs` | Parse `furnish.ts`, `PROPS.length === 8`; mọi prop trong khung (trừ ghế); không prop nào đè màn hình/phím; không hai prop xuyên nhau; không gì đứng trên sàn |
| `tests/cockpit-render-fidelity.mjs` | `paintScreen` gọi với `scale = 1`; màu prop đã tint đúng hex (assert hex, không tin `userData`) |
| `tests/interactive-pick-contract.mjs` | Click vào khoang lái không được kích hoạt cả một screen phía sau |

**Cấm hạ ngưỡng để test xanh.** Lần trước gate đếm greeble fail ở ~93 so với
ngưỡng 120, và cách sửa đúng là **thêm chi tiết thật + đếm cả số lần lặp do vòng
lặp sinh ra**, không phải sửa 120 thành 90. Nếu một test cản trở thiết kế mới,
sửa test để **chặt hơn** hoặc để đo đúng thứ mới — và giải thích trong commit.

## 8. Chuỗi publish

```bash
cd source/immersive
./node_modules/.bin/tsc -p tsconfig.json --noEmit          # phải 0 lỗi
./node_modules/.bin/vite build                            # dist/index.html ~1.37 MB
cd ../..
node scripts/sync-space-first-standalone.mjs               # ghi assets/immersive/index.html
```

Sau đó kiểm tra tính toàn vẹn island: giải mã `orbita-embedded-map` trong
`index.html`, so với `git show <base-commit>:index.html`. Kỳ vọng
**64 module / 0 changed**. Nếu khác, bạn đã chạm vào thứ không được chạm.

Tham chiếu `shipBytes` ở lần sync gần nhất: **915585**.

## 9. Đánh giá thị giác — bắt buộc, theo đúng thứ tự này

Đây là phần người dùng yêu cầu rõ nhất và cũng là phần lần trước làm thiếu.

### 9.1 Đánh giá "trần" — bỏ hết vật liệu

Render khoang lái với **toàn bộ vật liệu thay bằng một màu xám phẳng**, không
texture, không emissive, không màu. Chỉ còn silhouette, cạnh, và bóng đổ.

Nếu ở chế độ này khoang lái vẫn đọc ra là một buồng lái — có ghế, có vòm, có
bảng điều khiển nghiêng, có bệ giữa — thì hình học đã đúng. Nếu nó đọc ra là
một đống hộp xám, bạn chưa xong, và không có vật liệu nào cứu được.

**Đây là bài kiểm tra quyết định.** Lần trước nó bị bỏ qua, và đó là lý do 419
instance vẫn ra "hộp".

### 9.2 Đánh giá có vật liệu

Render lại với vật liệu và đèn thật. So sánh với ảnh tham chiếu thật (không phải
ảnh nghệ thuật phi thuyền trong phim — ảnh chụp khoang lái thật).

### 9.3 Đánh giá ở nhiều khoảng cách và góc

Tối thiểu: từ ghế phi công nhìn thẳng, nhìn nghiêng 45°, từ trên xuống, và **áp
sát** vào từng cụm chi tiết (bảng điều khiển, cần ga, khung vòm). Cái gì trông
ổn ở 3 m và vỡ ở 30 cm thì vẫn là hình hộp.

### 9.4 Phân loại nguyên nhân trước khi sửa

Một khiếm khuyết có thể đến từ **hình học**, **vật liệu**, **ánh sáng**, hoặc
**cách tổ chức không gian**. Ba cái sau sửa bằng hằng số; cái đầu phải dựng lại.
Đừng sửa ánh sáng để che một silhouette sai — lần trước đã mất một vòng vì đúng
lỗi này.

## 10. Định nghĩa "xong"

Bạn chỉ được nói xong khi tất cả những điều sau đúng:

- [ ] Ảnh **trần** (xám phẳng, không vật liệu) đọc ra là một buồng lái.
- [ ] Có ít nhất một bề mặt **cong thật** được sinh bằng sweep hoặc lathe, và nó
      là bộ phận chịu lực hoặc chỗ phi công chạm vào — không phải đồ trang trí.
- [ ] Mỗi mối nối giữa hai vật liệu có cấu tạo nhìn thấy được (gờ, rãnh, gioăng,
      khe hở).
- [ ] Không còn `BoxGeometry` nào đóng vai một vật thể có tiết diện khác hộp.
      Ghi rõ trong commit những chỗ bạn cố ý giữ hộp và vì sao.
- [ ] `tsc --noEmit` = 0 lỗi.
- [ ] Gate: **20 PASS / 2 FAIL**, và 2 cái fail **vẫn là đúng hai file cũ**.
- [ ] Island: **64 module / 0 changed**.
- [ ] Sáu phím hiện đủ, không cắt, ở **1024×768, 1600×900, 1920×1080**.
- [ ] Rasteriser đã **commit** vào `scripts/render-cockpit.mjs`, không nằm ở `/tmp`.
- [ ] Ảnh render đã commit vào `docs/immersive/`, có chú thích rõ là render CPU.
- [ ] `docs/immersive/COCKPIT_3D_20261112.md` có một mục mới ghi lại: bạn đã
      nghiên cứu gì, đã bỏ phương pháp nào và vì sao, cái gì đã kiểm chứng, cái
      gì **chưa**.
- [ ] Không có tuyên bố FPS hoặc hiệu năng nào không đo được.
- [ ] Đã hỏi người dùng về tên thật trước khi publish.

## 11. Cách báo cáo

Người dùng đã nhiều lần bị báo cáo sai. Ba lần họ phải tự phát hiện ra vấn đề
mà báo cáo nói đã xong. Vì vậy:

- **Nói thẳng cái gì vẫn xấu.** Nếu một góc nhìn vẫn giả, nói ra trước khi họ
  tìm thấy. Đó là lý do họ còn tin bạn.
- **Phân biệt rõ đã đo và chưa đo.** "Đã render" khác "đã chạy trên GPU". "0 lỗi
  tsc" khác "chạy được trên máy người dùng".
- **Không dùng từ "hoàn hảo", "chân thực như thật", "xong".** Dùng: "đã sửa X,
  còn Y chưa đạt".
- Mỗi commit message phải nói **vấn đề là gì**, **sửa bằng cách nào**, **kiểm
  chứng bằng gì**. Không phải danh sách file đã đổi.

## 12. Ranh giới cuối cùng

Đừng biến việc này thành một cuộc thi polygon. Một hình khối đơn giản có thể
đúng — nếu tỷ lệ đúng, tiết diện đúng, và nó ở đúng chỗ. Một cái hộp 419 lần
vẫn là cái hộp.

Thứ người dùng muốn, nguyên văn: *"những ngôi nhà trông như thực sự được xây
dựng, đồ đạc như thực sự được sản xuất, cây cối như thực sự sinh trưởng, con
người như thực sự hiện diện"*. Với khoang lái: **một buồng lái như thực sự được
chế tạo** — bởi một nhà sản xuất có quy chuẩn, cho một phi công có cơ thể, trong
một khung chịu lực có lý do.

Nếu bạn phải chọn giữa "nhiều chi tiết hơn" và "một chi tiết đúng", chọn cái
sau. Rồi làm lại từng cái một.

KẾT THÚC PROMPT
