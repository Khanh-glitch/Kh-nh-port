// ORBITA · Main Stage SHOWTIME — dữ liệu sự kiện
// Nguồn sự thật: nhánh `portfolio/data-intake-2026-11-05` (portfolio-data/events, media-candidates,
// SHOWTIME_EVENT_CURATION.md) + kiểm chứng footage ngày 2026-11-09 (xem docs/stage/SHOWTIME_MEDIA_VERIFICATION.md).
// Nguyên tắc: số liệu cấp sự kiện luôn đi kèm phạm vi + nguồn; vai trò cá nhân chỉ gồm phạm vi chủ portfolio tự thuật.

const crewStage = 'assets/stage/mcyt-crew-stage.jpg'

export type ShowId = 'gdt' | 'mcyt' | 'bghx'

/**
 * 'review' — bản phát triển: cho phép ảnh báo chí đang chờ cấp phép hiển thị bằng cách tải trực tiếp
 *            từ CDN gốc (không sao chép vào repo), luôn kèm tên nguồn/tác giả.
 * 'public' — trước khi xuất bản: chỉ dùng tư liệu đã được cấp phép (embed YouTube chính thức, ảnh chủ sở hữu duyệt).
 *            Ảnh báo chí được thay bằng thẻ nguồn (source card).
 */
export const MEDIA_POLICY: 'review' | 'public' = 'review'

export type Clearance = 'press-pending' | 'official-thumb' | 'owner'

export interface Clip {
  yt: string
  start?: number
  title: string
  channel: string
  published: string
  verified: string
}

export interface Photo {
  url: string
  caption: string
  credit: string
  source: string
  clearance: Clearance
  /** 'foh': ảnh nổi riêng đối diện tấm thông tin ở khu FOH (không nằm ở hai cánh, không đưa vào slideshow LED) */
  placement?: 'foh'
  /** tỉ lệ khung/cao; mặc định 3:2 (ảnh báo chí) hoặc 16:9 (khung hình video) */
  aspect?: number
}

export interface Fact {
  value: string
  label: string
  scope: string
}

export type LookMode = 'chase' | 'fan' | 'columns'

export interface Look {
  bpm: number
  mode: LookMode
  colors: string[]
  accent: string
  haze: number
  groundFog: number
  co2: boolean
  confetti: boolean
  motes: 'sparks' | 'bokeh' | 'candles'
  beamWidth: number
  strobe: number
  beatScene: number
}

export interface Show {
  id: ShowId
  index: number
  title: string
  titleLines: string[]
  kicker: string
  dateLabel: string
  venue: string
  organizer: string
  thesis: string
  facts: Fact[]
  roleTitle: string
  roleLines: string[]
  roleNote: string
  clips: Clip[]
  photos: Photo[]
  sources: string[]
  look: Look
  chapters: string[]
}

const yt = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`

export const SHOWS: Show[] = [
  {
    id: 'gdt',
    index: 0,
    title: 'GET DOWNTOWN 2023: |SI:N|',
    titleLines: ['GET DOWNTOWN', '2023 · |SI:N|'],
    kicker: 'LIVE CONCERT · UEH',
    dateLabel: '09 · 12 · 2023',
    venue: 'Hội trường A1.16, Đại học Kinh tế TP.HCM',
    organizer: 'CLB Giai Điệu Trẻ – UEH',
    thesis: '“The Scene You Have Ever Seen” — một rạp phim kí ức đi qua tuổi thơ, tuổi mới lớn và trưởng thành, khép lại bằng finale The Greatest Showman.',
    facts: [
      { value: '~1.000', label: 'khán giả', scope: 'Ước tính do UEH công bố, không phải số vé kiểm toán' },
      { value: '4+', label: 'tháng chuẩn bị', scope: 'Thời gian của cả ban tổ chức' },
      { value: '3', label: 'chương điện ảnh', scope: 'Childhood · Teenage · Adulthood → finale (recap UEH Youth)' },
    ],
    roleTitle: 'Hậu cần · Logistics · Xử lý rủi ro',
    roleLines: ['Hậu cần và logistics giai đoạn tiền sự kiện', 'Nhận diện và xử lý rủi ro trước giờ diễn', 'Hỗ trợ các đầu việc ngoài lề trước sự kiện'],
    roleNote: 'Phạm vi do tôi tự thuật. Không đảm nhận sáng tạo, đạo diễn hay quản lý nghệ sĩ.',
    clips: [
      { yt: 'oG1Yj6ENUPU', title: 'THE GREATEST SHOWMAN — finale', channel: 'Clb Giai Điệu Trẻ', published: '08/02/2024', verified: 'Thẻ mở đầu UEH/GDT + nhà tài trợ EnerZ; sân khấu hội trường UEH' },
      { yt: '1k_NlkZvfGQ', title: '[FIX CAM] RIO', channel: 'Clb Giai Điệu Trẻ', published: '22/02/2024', verified: 'Cùng thẻ mở đầu; LED rừng nhiệt đới, mandala' },
      { yt: 'pFGYdSZpVfQ', title: '[FIX CAM] IU ARTEAM', channel: 'Clb Giai Điệu Trẻ', published: '22/02/2024', verified: 'Cùng thẻ mở đầu; khách mời IU Arteam (khớp dữ liệu)' },
    ],
    photos: [
      { url: yt('oG1Yj6ENUPU'), caption: 'Finale “The Greatest Showman” — những thước phim cuối của rạp GET DOWNTOWN 2023', credit: 'Khung hình video chính thức · Clb Giai Điệu Trẻ', source: 'youtube.com/watch?v=oG1Yj6ENUPU', clearance: 'official-thumb' },
      { url: yt('1k_NlkZvfGQ'), caption: 'Tiết mục RIO trên LED rừng nhiệt đới, beam xanh lá xuyên khói', credit: 'Khung hình video chính thức · Clb Giai Điệu Trẻ', source: 'youtube.com/watch?v=1k_NlkZvfGQ', clearance: 'official-thumb' },
      { url: yt('pFGYdSZpVfQ'), caption: 'Khách mời IU Arteam trên sân khấu |SI:N|', credit: 'Khung hình video chính thức · Clb Giai Điệu Trẻ', source: 'youtube.com/watch?v=pFGYdSZpVfQ', clearance: 'official-thumb' },
    ],
    sources: ['UEH Youth — recap chính thức (17/01/2024)', 'Kênh YouTube Clb Giai Điệu Trẻ'],
    look: { bpm: 124, mode: 'chase', colors: ['#c6ff1a', '#ff2bd6', '#2bd9ff', '#ff3b2f'], accent: '#c6ff1a', haze: 1, groundFog: 0.15, co2: true, confetti: true, motes: 'sparks', beamWidth: 0.8, strobe: 1, beatScene: 0 },
    chapters: ['CHILDHOOD', 'TEENAGE', 'ADULTHOOD', 'FINALE'],
  },
  {
    id: 'mcyt',
    index: 1,
    title: 'MỘT CHÚT YÊU THƯƠNG 3',
    titleLines: ['Một Chút', 'Yêu Thương 3'],
    kicker: 'CHƯƠNG TRÌNH NGHỆ THUẬT THIỆN NGUYỆN',
    dateLabel: '08 · 01 · 2026',
    venue: 'Nhà hát Bến Thành, TP.HCM',
    organizer: 'CLB Doanh nhân và Pháp luật',
    thesis: 'Đêm nhạc kết hợp biểu diễn, câu chuyện an toàn giao thông và hỗ trợ nạn nhân tai nạn giao thông.',
    facts: [
      { value: '500', label: 'suất hỗ trợ × 2 triệu đ', scope: 'Hỗ trợ nạn nhân TNGT do chương trình công bố — không phải ngân sách sản xuất' },
      { value: '135tr+', label: 'đồng quyên góp tại chỗ', scope: 'Báo chí đưa tin; không cộng dồn với số liệu khác' },
      { value: '2.000', label: 'mũ bảo hiểm trao tặng', scope: 'Chương trình công bố; không cộng với 2.500 mũ huy động khi phát động' },
    ],
    roleTitle: 'Điều phối & theo dõi cánh sân khấu',
    roleLines: [
      'Theo dõi thứ tự nghệ sĩ, diễn viên ra vào',
      'Theo dõi thời điểm chuẩn bị từng tiết mục',
      'Theo dõi cue sân khấu',
      'Hướng dẫn vị trí trên sân khấu cho nghệ sĩ khi cần',
      'Liên lạc bộ đàm với đạo diễn, stage manager, kỹ thuật để phối hợp cue',
    ],
    roleNote: 'Phạm vi do tôi tự thuật. Không phải show caller hay đạo diễn chương trình.',
    clips: [{ yt: 'qVI16ejLXS0', title: 'Nhìn lại đêm nhạc Một Chút Yêu Thương 3', channel: 'CLB Doanh Nhân & Pháp Luật', published: '09/01/2026', verified: 'Kênh ban tổ chức; backdrop MCYT, hợp xướng, tiết mục, phần trao hỗ trợ' }],
    photos: [
      { url: 'https://htv.mediacdn.vn/155334506109014016/2026/1/9/z7411572742714fdd0c657ab99534f7e1f929700992136-17679271691261574188140.jpg', caption: 'Giọng ca nữ cùng hợp xướng trên nền LED trời mây và khói lạnh', credit: 'Ảnh: HTV', source: 'htv.vn', clearance: 'press-pending' },
      { url: 'https://htv.mediacdn.vn/155334506109014016/2026/1/9/z7411572750811d421041e9ffb9577edf18856a53b43e0-1767929413618935070206.jpg', caption: 'Ca sĩ và vũ đoàn trên nền LED trái tim', credit: 'Ảnh: HTV', source: 'htv.vn', clearance: 'press-pending' },
      { url: 'https://mtg.1cdn.vn/2026/01/09/z7411508144189_28da533d4ec3685cb76a623179e41311.jpg', caption: 'Tiết mục biểu diễn trong làn khói sân khấu', credit: 'Ảnh: 1thegioi.vn', source: '1thegioi.vn', clearance: 'press-pending' },
      { url: 'https://mtg.1cdn.vn/2026/01/09/z7411508122105_f092a342690f68ec8c75d8f4b6fec4b4.jpg', caption: 'Giao lưu cùng Khắc Triệu và Cẩm Vân', credit: 'Ảnh: 1thegioi.vn', source: '1thegioi.vn', clearance: 'press-pending' },
      { url: 'https://mtg.1cdn.vn/2026/01/09/z7411508154797_efb526ba1f9a35d357157fe1c0e91975.jpg', caption: 'Ca sĩ cùng vũ đoàn trên nền trái tim hồng', credit: 'Ảnh: 1thegioi.vn', source: '1thegioi.vn', clearance: 'press-pending' },
      { url: 'https://mtg.1cdn.vn/2026/01/09/z7411508160057_49edf7e71f5d287c8a45238bcff0e54d.jpg', caption: 'Khoảnh khắc đóng góp trên sân khấu', credit: 'Ảnh: 1thegioi.vn', source: '1thegioi.vn', clearance: 'press-pending' },
      {
        url: crewStage,
        caption: 'Những người đứng sau đêm diễn — khoảnh khắc trên sân khấu Một Chút Yêu Thương 3',
        credit: 'Ảnh tư liệu do chủ portfolio cung cấp',
        source: 'Chủ portfolio (đã đồng ý công bố, 05/11/2026)',
        clearance: 'owner',
        placement: 'foh',
        aspect: 4 / 3,
      },
    ],
    sources: ['PLO · SGGP · 1thegioi.vn · HTV (01/2026)', 'Kênh YouTube CLB Doanh Nhân & Pháp Luật'],
    look: { bpm: 66, mode: 'fan', colors: ['#ffffff', '#ff5fb4', '#b48cff', '#7fd4ff'], accent: '#ff5fb4', haze: 0.7, groundFog: 1, co2: false, confetti: false, motes: 'bokeh', beamWidth: 1.15, strobe: 0, beatScene: 3 },
    chapters: ['MỞ MÀN', 'CÂU CHUYỆN', 'SẺ CHIA', 'KHÉP LẠI'],
  },
  {
    id: 'bghx',
    index: 2,
    title: 'BẢN GIAO HƯỞNG XANH',
    titleLines: ['Bản Giao', 'Hưởng Xanh'],
    kicker: 'CHƯƠNG TRÌNH NGHỆ THUẬT · THÁNG CÔNG NHÂN',
    dateLabel: '28 · 04 · 2026',
    venue: 'Cung Văn hóa Lao động TP.HCM – cơ sở Bình Trưng',
    organizer: 'Liên đoàn Lao động TP.HCM',
    thesis: 'Chương trình nghệ thuật trong lễ khai mạc Tháng Công nhân lần thứ 18 — sân khấu ngoài trời, hợp xướng và sân khấu hóa “Nhịp sống công nhân”.',
    facts: [
      { value: '~2.000', label: 'người tham dự', scope: 'Toàn bộ lễ khai mạc, không riêng khán giả chương trình nghệ thuật' },
      { value: '12', label: 'mái ấm công đoàn', scope: 'Kết quả chăm lo của toàn chương trình' },
      { value: '1.500', label: 'phiếu phúc lợi đoàn viên', scope: 'Toàn chương trình, không phải tác động cá nhân' },
    ],
    roleTitle: 'Điều phối & theo dõi cánh sân khấu',
    roleLines: [
      'Điều phối hoạt động ở cánh sân khấu',
      'Theo dõi thứ tự và di chuyển của nghệ sĩ, diễn viên',
      'Theo dõi cue và thời điểm chuẩn bị tiết mục',
      'Liên lạc bộ đàm với đạo diễn, stage manager, kỹ thuật',
    ],
    roleNote: 'Phạm vi do tôi tự thuật. Không suy ra đơn vị chủ quản từ hồ sơ thầu.',
    clips: [
      { yt: '79u-e-5xUg8', title: 'Bản Giao Hưởng Xanh 2026 — You Raise Me Up', channel: 'ALEX NGUYỄN OFFICIAL', published: '29/04/2026', verified: 'Hợp xướng áo trắng cầm nến, cây lớn trên LED, khói — khớp ảnh NLĐO' },
      { yt: '_wCx5rKuhUA', start: 1700, title: 'Livestream khai mạc & chương trình nghệ thuật (từ 28:20)', channel: 'Công đoàn TP. Hồ Chí Minh', published: '28/04/2026', verified: 'Kênh ban tổ chức; phần nghệ thuật bắt đầu sau màn chờ key visual' },
    ],
    photos: [
      { url: 'https://nld.mediacdn.vn/thumb_w/698/291774122806476800/2026/4/28/z7772327182954005129ff9df0873effebc2e99f7869a8-17773781952751259789478.jpg', caption: 'Hợp xướng, sân khấu hóa “Nhịp sống công nhân”', credit: 'Ảnh: Hoàng Triều / NLĐO', source: 'nld.com.vn', clearance: 'press-pending' },
      { url: yt('79u-e-5xUg8'), caption: 'Tiết mục hợp xướng mở màn dưới tán cây và ánh nến', credit: 'Khung hình video · ALEX NGUYỄN OFFICIAL', source: 'youtube.com/watch?v=79u-e-5xUg8', clearance: 'official-thumb' },
      { url: 'https://nld.mediacdn.vn/thumb_w/698/291774122806476800/2026/4/28/z7772327171850e03c2b9679ff0bc4038c405df9a60fda-17773781952511367554682.jpg', caption: 'Người lao động dự lễ khai mạc — gần 2.000 người tham gia toàn sự kiện', credit: 'Ảnh: Hoàng Triều / NLĐO', source: 'nld.com.vn', clearance: 'press-pending' },
    ],
    sources: ['NLĐO · PLO · Nhân Dân · TTBC TP.HCM (04/2026)', 'Kênh YouTube Công đoàn TP.HCM'],
    look: { bpm: 72, mode: 'columns', colors: ['#e8fbff', '#5ff2c8', '#7aa8ff', '#b79cff'], accent: '#5ff2c8', haze: 0.9, groundFog: 0.85, co2: false, confetti: false, motes: 'candles', beamWidth: 1, strobe: 0, beatScene: 3 },
    chapters: ['HỢP XƯỚNG', 'NHỊP SỐNG', 'GIAO HƯỞNG', 'XANH'],
  },
]

export const photoAllowed = (p: Photo) => MEDIA_POLICY === 'review' || p.clearance !== 'press-pending'
