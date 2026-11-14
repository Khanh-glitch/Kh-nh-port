# HX-9: thông tin cho nhà tuyển dụng

`assets/immersive/src/portfolioData.js` là trung tâm quản lí nội dung của ba
màn hình khoang lái, hồ sơ nhanh và các liên kết. Cập nhật dữ liệu ở đây rồi
chạy `node scripts/build-hx9-intro.mjs` để xuất bản import map.

## Cách chọn thông tin mở đầu

Các nguồn hướng dẫn tuyển dụng đề xuất giới thiệu ngắn, nêu rõ **đóng góp cá
nhân**, có ví dụ công việc và một bước tiếp theo dễ thực hiện. Ví dụ:
[ADPList — portfolio interview và one-pager](https://adplist.substack.com/p/the-best-portfolio-playbook-thats),
[Creativepool — vai trò dự án và lời kêu gọi hành động](https://creativepool.com/magazine/workshop/what-makes-a-digital-portfolio-stand-out-to-employers-and-agencies)
và [UX Design Institute — case study, liên hệ](https://www.uxdesigninstitute.com/blog/hiring-managers-ux-portfolio/).
Vì vậy màn trung tâm nói ngay Khánh làm gì; màn trái đưa hai tác phẩm ở hai
lĩnh vực; màn phải giúp liên hệ. Hồ sơ nhanh cung cấp thêm bối cảnh và đường
dẫn, không bắt nhà tuyển dụng đi hết đảo để biết phần đóng góp.

## Bản đồ thông tin trong repo

- **Một Chút Yêu Thương 3**: điều phối và theo dõi cánh sân khấu, cue và phối
  hợp kỹ thuật. `source/src/stage/shows.ts`, trường `roleTitle` và `roleLines`.
  Link recap là video của ban tổ chức để xem chương trình, không phải khẳng
  định video liệt kê vai trò cá nhân.
- **CoravaMaris**: Audio, Pitch/Presentation và Level Design. Xem mục
  Additional project credits trong `docs/PORTFOLIO_MEDIA.md` và
  `source/src/scene/Cinema.tsx`; video được gắn nhãn là video dự án.
- **Mùa Hạ Thứ 18**: sáng tác, theo `source/src/reality/tracks.ts`; liên kết
  tới reel gốc từ cùng cấu hình.
- **Thanh Âm Của Hòa Bình**: biên soạn mở đầu và chỉnh sửa hậu kỳ, theo
  `source/src/scene/Cinema.tsx` và credit trong `docs/PORTFOLIO_MEDIA.md`.
- **APEX CHAOS**: bản demo được dẫn trong `source/src/content.ts` và repo
  `Khanh-glitch/APEX-CHAOS`. Nút demo là đường dẫn trực tiếp; không gán thêm
  chức danh cá nhân mà nguồn dự án chưa ghi ở màn hình này.
- **LinkedIn và GitHub**: theo `source/src/layout.ts`.

Không ghép hồ sơ `STUDIO` có tên người khác vào hồ sơ Lê Quốc Khánh. Các mục
trên giữ đúng phạm vi đóng góp theo nội dung trong repo và tự thuật của chủ
portfolio; số liệu của một sự kiện không được tự động biến thành thành tích
cá nhân. Thông tin cá nhân khác có thể bổ sung vào nguồn tập trung khi phù hợp.

## Tương tác và kiểm tra

Ba nội dung được vẽ vào texture trên mesh màn hình thật của HX-9. Màn trung
tâm mở đảo; màn trái mở hồ sơ nhanh có các dự án và nguồn xem; màn phải mở
LinkedIn hoặc GitHub. Nút HTML tương đương dùng được bằng bàn phím. Trên màn
hình dọc, hồ sơ nhanh giúp đọc các màn phụ khi chúng nằm ngoài góc nhìn; các
nút liên kết có chiều cao chạm tối thiểu 44px.
