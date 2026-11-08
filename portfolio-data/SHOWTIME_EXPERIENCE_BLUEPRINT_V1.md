# SHOWTIME — Experience Blueprint v1
**Ngày:** 08/11/2026 · **Trạng thái:** quyết định kiến trúc trải nghiệm ở mức concept (KHÔNG PHẢI thiết kế UI)  
**Cơ sở nội dung:** `SHOWTIME_EDITORIAL_MASTER_V1.md` (10 case chính và danh mục hỗ trợ)  
**Ràng buộc của chủ portfolio:** không dựng giao diện, không cắt ngắn video để làm clip highlight; ngoại lệ là về sau được tuyển chọn ảnh tĩnh. Giữ nguyên bản tác phẩm khi người xem muốn xem/nghe chúng. Chưa xuất bản hoặc đóng thu thập.

## 1. Vấn đề SHOWTIME thực sự phải giải quyết

Một khách tuyển dụng cần thấy năng lực trong vài chục giây. Người quan tâm nghệ thuật muốn trải nghiệm tác phẩm nguyên vẹn. Người đánh giá chuyên môn cần biết người tạo đã làm phần nào, nguồn ở đâu, chất lượng đã được kiểm chứng đến đâu. Nếu chỉ làm một website CV dài, SHOWTIME đánh mất tính sáng tạo; nếu làm một trò chơi dẫn đường quá phức tạp, người xem bỏ đi trước khi nhìn thấy bất kỳ bằng chứng nghề nghiệp nào.

**Định vị cho trải nghiệm:** `THE SHOW IS THE WORK` — SHOWTIME là một *cuộc trình diễn có bằng chứng*, nơi mỗi tác phẩm được trình bày đúng bản chất phương tiện của nó, và người xem có thể bước ra hậu trường để hiểu vai trò, quyết định, phương pháp thực hiện.

Ẩn dụ **frontstage / backstage** áp dụng xuyên suốt mà không ép từng dự án vào những phòng ảo rời rạc:
- **Frontstage — What you can experience:** ảnh thật, phim nguyên bản, tác phẩm âm nhạc chính thức, game thực sự chơi được, sản phẩm có thể thử.
- **Backstage — What I actually did:** công việc/đóng góp cá nhân, cách phối hợp, những quyết định có chứng cứ, kết quả đạt được, giới hạn của dữ liệu.
- **Proof — Where it exists:** liên kết TikTok gốc, Spotify/YouTube, itch.io, GitHub, tài liệu đã duyệt, và nguồn thật. Không dựng ảnh giả hoặc thành tích diễn giải quá mức.

Lưu ý: đây là **ẩn dụ biên tập và luồng trải nghiệm**, không phải yêu cầu dựng một sân khấu 3D.

## 2. Ba archetype đối chiếu và quyết định

| Archetype | Điểm hấp dẫn | Nguy cơ với tác phẩm SHOWTIME | Quyết định |
|---|---|---|---|
| **A. Living Performance / The Show Is the Work** | Một danh tính xuyên lĩnh vực, có thể chuyển tự nhiên giữa xem–nghe–chơi–đọc, và lớp hậu trường làm rõ vai trò | Dễ thành phô diễn hiệu ứng nếu chuyển cảnh lấn át media thật | **CHỌN làm hướng concept chủ đạo** |
| **B. Evidence Archive / The Creative Ledger** | Rất mạnh cho nhà tuyển dụng, source và vai trò rõ ràng, đơn giản hóa quyền tác giả | Dễ khô cứng, như CV hoặc Notion database; khó thể hiện sân khấu và cảm xúc | **Dùng như lớp truy cập nhanh / proof**, không là bản sắc tổng thể |
| **C. Explorable Game World** | Có thể gây ấn tượng mạnh về game/creative tech nếu site chính là gameplay | Làm khó xem concert/video, giảm tốc cho người tuyển dụng, phức tạp trên mobile, khó đảm bảo tác phẩm trọng tâm | **Không chọn làm cấu trúc chính**; chỉ có thể xuất hiện dưới dạng tương tác cục bộ có lý do |

**Khóa kiến trúc trải nghiệm:** A làm trục + B làm đường tắt chứng minh năng lực + một số tương tác thực chất của C (chơi game demo, khám phá cơ chế sản phẩm thật). Không trộn ba aesthetic vào một giao diện vô tổ chức.

## 3. Nguyên tắc quan trọng nhất: không cắt các tác phẩm mỏng về thời lượng

Chủ portfolio xác nhận rằng ngoài ảnh tĩnh, video/audio thường không đủ dài để bị rút thành highlight. **Quy tắc mới:**
1. Video được xem/nghe **nguyên vẹn theo bản gốc**, kể cả các video học phần, phóng sự, OOH shorts và voice-over. Không tự làm cut, showreel trích đoạn hay kết nối hai clip thành một video.
2. Khi cần nhắc đến một tác phẩm trong nhiều bối cảnh, có thể dùng **ảnh đại diện / tên / mô tả / link nguyên bản**, không tạo bản cắt phỏng đoán.
3. Ảnh sân khấu, sự kiện và hậu trường có thể **tuyển chọn ảnh tiêu biểu** để tránh trùng lặp; vẫn cho phép xem tuyển tập gốc trong phần mở rộng.
4. Với video lớn trên Google Drive: chỉ hỗ trợ mở/link hoặc nhúng *nếu thật sự được phép và chạy ổn*; không giả định có thể stream mượt.
5. Tác phẩm có nhạc của bên thứ ba chỉ nhúng qua dịch vụ hợp pháp khi được phép; không tự sao chép tệp lên hosting công khai.
6. Bất kỳ hình ảnh minh họa khái niệm nào ở giai đoạn sau phải được ghi đúng là diễn giải, không được giả mạo ảnh chụp sản phẩm thật.

## 4. Hai nhịp khám phá, không phải hai website

### Path I — 30-second evidence pass (recruiter/client)
**Mục tiêu:** chưa cần nghe nhạc hoặc xem hết một phim, nhưng hiểu người này làm gì, có thành tích nào, và đi đâu để kiểm tra thật.

- **0–5 giây:** nhận diện một câu mô tả nghề nghiệp có tính kết nối (Creative Producer / Interactive Creator), biết đây là tác phẩm thật chứ không phải moodboard.
- **5–15 giây:** chạm các bằng chứng có sức nặng trực tiếp: Que Quá Quao ~1,1M views (owner-reported + link video cụ thể), APEX CHAOS link chơi công khai, MathPath sản phẩm học tập nguồn rõ, tín nhiệm từ event thật và tác phẩm âm nhạc chính thức.
- **15–30 giây:** tiếp cận danh sách dự án theo năng lực muốn tuyển (content / event / product & game / music). Không cần xem cinematic intro dài, chơi minigame, hay tìm lối thoát.
- **Kết thúc:** liên hệ và hồ sơ nghề nghiệp thích hợp (CV chỉ được liên kết khi có bản đã được duyệt).

**Tiêu chuẩn thành công:** một người không nghe âm thanh, không cuộn sâu và không hiểu ngữ cảnh AI cũng xác định được *người này thực sự làm gì và nên click vào đâu*.

### Path II — exploratory creative visit (2–8 minutes)
**Mục tiêu:** người xem nhớ tới bạn vì được trải nghiệm chứ không chỉ đọc.

- Chọn bất kỳ cánh cửa trải nghiệm nào: xem một phim nguyên bản, nghe tác phẩm chính thức, quan sát ảnh live, chơi APEX, đọc nội dung MathPath hoặc khám phá case backstage.
- Từ **frontstage**, lớp **backstage** xuất hiện khi người xem chủ động muốn biết ai làm gì, với nguồn chứng minh và nhãn trạng thái gọn, không ngắt tác phẩm đang chơi.
- Người xem có thể chuyển sang một case *liên quan về năng lực*: TikTok → China Town (production), China Town → VO (performance), stage event → EventFlow (domain problem), MathPath → nghiên cứu/giảng dạy, APEX → Ragnarok (game design).
- Người xem luôn có đường quay lại, chuyển lĩnh vực khác hoặc kết thúc. Không bắt đi hết “hành trình” mới xem được dự án.

**Tiêu chuẩn thành công:** dù bắt đầu từ media/game/sự kiện, người xem vẫn nhận ra tính nhất quán về tư duy sản xuất và khả năng chuyển ý tưởng thành trải nghiệm.

## 5. Cách trình bày riêng theo loại tác phẩm — không ép mọi thứ thành card giống nhau

| Loại nguồn | Frontstage (tác phẩm thật) | Backstage (năng lực) | Chứng cứ / lưu ý |
|---|---|---|---|
| **TikTok / Que Quá Quao** | [Video gốc ~1,1M](https://www.tiktok.com/@quequaquao/video/7530989283956559122) và link kênh | Chiến lược nội dung, lịch đăng, kịch bản, edit, framework, VO và quản lý | 4K+ follower và ~1,1M views là số liệu chủ kênh báo cáo, hiện chưa kiểm toán API |
| **China Town / commercial film** | [Xem video nguyên bản](https://drive.google.com/file/d/1Q8fq-i-Of1jMqeuFCPNCpLhZTatq4j4h/view) | Leader, voice-over, on-camera | Dự án học phần, điểm cao nhất và lượng tương tác do chủ cung cấp; không giới thiệu như agency TVC trả phí |
| **Crowd / Museum / VEINORA** | Các video nguồn nguyên bản; không cắt | Ý tưởng/thí nghiệm/VO/diễn xuất; documentary edit+leader; interior-concept editor, tương ứng từng dự án | Gọi đúng nội dung và phạm vi hợp tác; không có KPI giả |
| **Voice-over / OOH** | Hai mẫu voice và bốn video thử nghiệm **nguyên bản** | Khả năng đổi ngữ điệu, dựng âm, kể chuyện, ý tưởng quảng bá | OOH là **spec pieces**, không tuyên bố đã mua/đặt ngoài trời |
| **Live Event** | Ảnh sự kiện thật / ảnh hậu trường có quyền sử dụng | GDT hậu cần–rủi ro; MCYT/BGHX cánh sân khấu–cue–radio | Không gán vai trò Stage Manager hoặc toàn bộ ngân sách cho chủ portfolio |
| **Music / Performance** | Link Spotify, video chính thức, reel sáng tác, tuyển tập ảnh live đã chọn | Vocalist trong “Nếu ngày mai”; composer “Mùa Hạ Thứ 18”; sân khấu | Không nhận vơ cả hai vai trò ở cả hai bài hoặc tự tải lại nhạc của bên khác |
| **APEX CHAOS** | [Game playable công khai](https://realbae.itch.io/apex-chaos) (mở môi trường chính thức) | Lối chơi, nhân vật, chiến đấu, AI-assisted product direction | Không copy một game mô phỏng giả thay cho build thật |
| **MathPath** | User journey thật khi có runtime hoạt động; trước đó trình bày chức năng từ source & bản thử đã kiểm chứng | Logic học tập, mastery, K51, course structure, bảo mật chấm điểm | Source/release candidate ≠ chứng nhận sản phẩm đã kinh doanh |
| **Ragnarok: The Last Island** | Nội dung tiến trình phát triển có bằng chứng; sau này thay bằng bản build đã chấp nhận | Sinh tồn, map, chiến đấu, chiều sâu hệ thống, creative direction | Game **đang phát triển**, không lấy gameplay của repo main cũ làm kết quả mới |
| **EventFlow** | Lịch sử browser-local demo nếu nêu là lịch sử, cập nhật build mới khi có | Brief → nhu cầu → BOQ → human pricing → review | Rebuild chưa được đánh đồng với live SaaS |
| **Learning / Research** | Câu hỏi nghiên cứu, cách làm và tóm lược tự viết | Phân tích định tính, hướng dẫn Toán cao cấp 1:1 | Không công khai bản chép lời, dữ liệu người tham gia hoặc % điểm thiếu mẫu |

## 6. Các phép nối dự án CÓ ý nghĩa — thứ tạo ra cảm giác một SHOWTIME thống nhất

**Không nối tùy ý để chứng minh “đa tài”.** Mỗi phép nối phải giải thích một kỹ năng chuyển từ bối cảnh này sang bối cảnh khác.

| Từ | Sang | Vì sao đáng nối |
|---|---|---|
| **Sân khấu MCYT / BGHX / GDT** | **EventFlow** | Kinh nghiệm về chuẩn bị, cue, phạm vi và phối hợp thực tế có thể soi chiếu nhu cầu tạo công cụ sản xuất (không khẳng định quan hệ nhân quả cụ thể chưa được chủ xác nhận) |
| **Que Quá Quao** | **China Town** | Từ vận hành kênh liên tục sang một video quảng bá có nhóm, người dẫn, thông điệp và kết quả học phần |
| **China Town** | **Voice-over portfolio** | Cùng năng lực truyền tải thông điệp bằng giọng nói, nhưng các sắc thái và nhu cầu sản xuất khác nhau |
| **Live Performance** | **Music releases/composition** | Kết nối giọng hát trên sân khấu với vai trò trong thu âm và sáng tác |
| **MathPath** | **Tutoring / Thesis** | Lối tiếp cận hướng người học, cấu trúc vấn đề và đánh giá có bằng chứng; không nói MathPath đã được dùng trong ca gia sư |
| **APEX CHAOS** | **Ragnarok / Alphabet Engine** | Từ game playable sang tham vọng thiết kế hệ thống và dự án đang phát triển; phân biệt trạng thái nguồn |
| **ELP / Content experiments** | **Que Quá Quao** | Quan tâm đến framework nội dung và thiết kế cho audience; tránh nói các tài liệu ELP là workflow đã vận hành trên TikTok |

**Nguyên tắc liên kết:** cùng một dự án có thể cho thấy nhiều năng lực, nhưng chỉ là *một tác phẩm* trong kho; phần liên kết là đường mở thêm, không phải tính thêm thành tích.

## 7. Benchmark research (nguồn thực được đọc, lấy nguyên lý chứ không sao chép)

1. **Bruno Simon — https://bruno-simon.com/**: web portfolio là một trò chơi lái xe; site có controls/respawn/map để người dùng khám phá. Bài học: một tương tác được chọn đúng có thể tự chứng minh năng lực tạo game. Nhưng với SHOWTIME, **không nên bắt khách hàng/người tuyển dụng lái xe mới thấy TikTok hay event**.
2. **makemepulse — Benno's Light — https://www.makemepulse.com/case-study/bennos-light-claims-conference**: sáu chương, sự kiện tương tác bằng ánh sáng và một lớp tư liệu biên tập riêng; nội dung thực tế không bị nút/hotspot phá nhịp. Bài học: có thể có tương tác giàu cảm xúc nhưng người xem vẫn tìm được thông tin xác thực khi cần.
3. **makemepulse — work / case-study index — https://www.makemepulse.com/case-studies/**: nhiều medium (interactive, gaming, brand, film) vẫn nằm trong một hệ phân cấp case study và mục đích xem rõ; không bắt mỗi medium có một website riêng.
4. **makemepulse — craft reel note — https://www.makemepulse.com/news/craft-meets-ambition-cgi-reel**: chính studio mô tả rằng không phải tác phẩm nào cũng cần tương tác; đôi khi format truyền thống có giá trị hơn. SHOWTIME cần áp dụng điều này cho những video đã dựng đầy đủ: **giữ nguyên bản** thay vì buộc sản phẩm thành demo tương tác.
5. **Awwwards/industry 2026 roundups**: portfolio ấn tượng không có một công thức duy nhất; game portfolio hiệu quả khi bản thân website chứng minh được kỹ năng. Những đánh giá bên ngoài chỉ là nguồn đối chiếu, không phải đo lường khả năng chuyển đổi của SHOWTIME.

## 8. Thiết kế trải nghiệm KHÔNG đồng nghĩa thiết kế giao diện

**Chưa chốt**: palette, typography, motion art direction, bố cục màn hình, mô hình 3D, hệ component, framework, hosting hay code. Các quyết định này sẽ cần một vòng creative direction riêng; user đã phản đối các mockup chất lượng kém và **không cho phép assistant tự dựng HTML**.

**Đã chốt ở mức concept (đề xuất để sau này nghiệm thu):**
- Một SHOWTIME thống nhất với **frontstage / backstage / proof**.
- Tác phẩm media được xem/nghe **nguyên bản**, không trích cắt tùy tiện; có chọn ảnh.
- Hai nhịp khám phá (xem bằng chứng nhanh vs đào sâu), **không bắt buộc tham gia tương tác**.
- Interactivity phục vụ chính tác phẩm, không phải trang trí.
- Liên kết kỹ năng có căn cứ và giữ provenance.
- Dự án đang phát triển/phôi phải có nhãn trạng thái đúng để tránh hứa hẹn quá mức.

## 9. Acceptance gates cho bước concept, trước khi bất kỳ ai được dựng UI

- **Identity within 5 seconds:** không cần nghe âm, người xem hiểu đây là ai về nghề nghiệp và thấy một tác phẩm thật.
- **Evidence within 30 seconds:** có đường tới ít nhất hai sản phẩm/nguồn có thể kiểm chứng mà không phải giải puzzle hay xem intro dài.
- **Full-work respect:** toàn bộ video/voice sample được mở ở bản nguyên gốc; không có hành động tự ý cắt.
- **No showreel inflation:** không dựng montage khiến người xem nhầm video mẫu với chiến dịch đã thương mại hóa.
- **Video/audio accessibility:** phát âm thanh theo hành động của người xem; có lựa chọn không nghe và đường tới bản nguồn; giảm chuyển động cho người cần.
- **Mobile and fallback:** người xem bằng điện thoại, không có WebGL/WebGPU hoặc thiết bị yếu vẫn tiếp cận được chính tác phẩm.
- **No source confusion:** `Que Quá Quao` đúng chính tả và mốc 1,1M là owner-reported; `Ragnarok: The Last Island` đúng brand và vẫn chưa có phát hành được xác nhận.
- **Return to work:** bất kỳ chuyển cảnh nào cũng phải cho người xem quay về tác phẩm đang xem hoặc chọn tác phẩm khác.
- **No authority inflation:** label cá nhân/team/event và nguồn số liệu được viết rõ.
- **Practical production:** không được làm toàn bộ website phục tùng một 3D showpiece làm hỏng khả năng tải tác phẩm và đường liên hệ.

## 10. Bước tiếp theo sau tài liệu này

**Creative Direction Discovery**, nhưng chỉ sau khi chủ portfolio chọn hướng concept hoặc đưa ý kiến:
1. Nghiên cứu visual language/motion/typography tương ứng với A, không thiết kế bằng trí tưởng tượng thuần túy.
2. Tạo một **art-direction specification** có thể kiểm nghiệm: 2–3 hệ ngôn ngữ hình ảnh, reference đủ nguồn, nguyên lý chuyển động và cách xử lý media thực.
3. Trình bày để chủ portfolio chọn trước khi giao việc dựng UI/website cho đúng công cụ và chuẩn nghiệm thu.

**Hiện tại không có yêu cầu bổ sung tư liệu từ user; không mở lại audit Social/Media, không tự cắt video, không tự dựng HTML.**
