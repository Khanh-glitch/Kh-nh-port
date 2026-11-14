# HX-9: hồ sơ trên ba màn hình

`assets/immersive/src/portfolioData.js` là nguồn quản lí nội dung cho cả ba
màn hình và các liên kết truy cập bằng bàn phím. Khi cập nhật, chỉ công bố vai
trò và đường dẫn có thể kiểm chứng; không suy diễn chức danh, thâm niên, thành
tích, email, số điện thoại hoặc kết quả dự án chưa có nguồn.

## Cấu trúc dành cho nhà tuyển dụng

- **Trung tâm — giới thiệu & khám phá**: tên thật, ba lĩnh vực thể hiện trong
  portfolio, và nút vào thế giới để xem tác phẩm và phạm vi đóng góp.
- **Trái — bằng chứng công việc**: APEX CHAOS với liên kết bản demo đã có trong
  `source/src/content.ts`; CoravaMaris ghi rõ phạm vi *Audio / Pitch / Level
  Design*, không gán vai trò sản xuất video. Nguồn và giới hạn ở
  `docs/PORTFOLIO_MEDIA.md` mục Additional project credits.
- **Phải — liên hệ**: LinkedIn và GitHub theo `source/src/layout.ts`. Không dùng
  email hoặc số điện thoại mẫu trong `STUDIO` của `source/src/content.ts`.

Lựa chọn này theo nguyên tắc giới thiệu dễ quét, mô tả rõ phần đóng góp, có
bằng chứng/tác phẩm và thông tin liên hệ dễ tiếp cận: [UX recruiter portfolio
tips](https://www.toptal.com/designers/ux/ux-portfolio-tips-recruiter) và
[UX Design Institute](https://www.uxdesigninstitute.com/blog/hiring-managers-ux-portfolio/).
Không đặt số liệu thành tích nếu chưa có chứng cứ. `STUDIO` và một số `PANELS`
là nội dung mẫu không được xem là tiểu sử cá nhân.

Ba nội dung được vẽ vào texture trên chính mesh màn hình của HX-9. Click màn
trung tâm để vào đảo; màn trái mở demo APEX, màn phải mở LinkedIn hoặc GitHub.
Các liên kết HTML có thể dùng bàn phím và màn hình nhỏ, không phụ thuộc vào độ
chính xác khi chạm màn 3D. Trên web, mở liên kết bên ngoài bằng tab mới.

Ở khung dọc, hai màn phụ có thể nằm ngoài tầm nhìn buồng lái. Nút
**HỒ SƠ & TÁC PHẨM** mở bản tóm tắt dễ đọc; các liên kết bên dưới có kích
thước chạm tối thiểu 44px và vẫn hoạt động bằng bàn phím.

Kiểm tra trình duyệt thực hiện trên Chromium với WebGL phần mềm: nhấp trực
tiếp màn trái, hai lựa chọn màn phải và màn trung tâm; kiểm tra ba liên kết,
khung dọc 390px và luồng tiếp tục vào đảo. Đây không phải bằng chứng đo hiệu
năng GPU thật; các kết quả native trước đó vẫn được ghi trong README HX-9.
