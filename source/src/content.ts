export type PanelId =
  | 'about'
  | 'orb'
  | 'piano'
  | 'rubik'
  | 'robot'
  | 'cinema'
  | 'stage'
  | 'products'
  | 'beacon'

export interface PanelItem {
  name: string
  meta: string
  desc: string
}

export interface PanelContent {
  id: PanelId
  kicker: string
  title: string
  subtitle: string
  body: string[]
  stats: { k: string; v: string }[]
  items: PanelItem[]
  tags: string[]
  accent: string
}

export const STUDIO = {
  name: 'ORBITA',
  tagline: 'Studio sản xuất sự kiện & sản phẩm số',
  person: 'Lâm Anh Khoa',
  role: 'Creative Director · Technical Producer',
  email: 'hello@orbita.studio',
  phone: '+84 90 123 4567',
  city: 'TP. Hồ Chí Minh · Hà Nội · Singapore',
}

export const PANELS: Record<PanelId, PanelContent> = {
  about: {
    id: 'about',
    kicker: 'XIN CHÀO, PHI HÀNH GIA',
    title: 'ORBITA Studio',
    subtitle: 'Chúng tôi biến một đêm diễn thành một hành tinh mà khán giả muốn ở lại.',
    body: [
      'Orbita là studio sáng tạo kiêm đội sản xuất kỹ thuật cho sự kiện trực tiếp và sản phẩm số. Từ concept, thiết kế ánh sáng, LED, âm thanh, đến phần mềm điều khiển show, ứng dụng vé và trải nghiệm AR — cùng một đội, cùng một ngôn ngữ thiết kế.',
      'Chiếc đĩa bay bạn đang đứng là portfolio: mỗi vật thể là một mảng năng lực. Hãy đi bộ, ngắm nhìn, nhấn vào chúng và nghe âm thanh thay đổi theo khoảng cách.',
    ],
    stats: [
      { k: 'Show đã sản xuất', v: '212' },
      { k: 'Khán giả trực tiếp', v: '1.8M+' },
      { k: 'Sản phẩm số', v: '14' },
      { k: 'Năm kinh nghiệm', v: '11' },
    ],
    items: [
      { name: 'Concept & Creative Direction', meta: 'Ý tưởng', desc: 'Storyboard, moodboard, pre-viz 3D trước khi dựng thật.' },
      { name: 'Live Production', meta: 'Sản xuất', desc: 'Sân khấu, LED, ánh sáng, âm thanh, laser, SFX, quản lý hiện trường.' },
      { name: 'Digital Products', meta: 'Công nghệ', desc: 'Vé điện tử, dashboard trực tiếp, AR dẫn đường, tương tác khán giả.' },
    ],
    tags: ['Events', 'Live Production', 'Creative Tech', 'Immersive'],
    accent: '#8fb4ff',
  },
  orb: {
    id: 'orb',
    kicker: 'VFX · LIGHTING · LASER',
    title: 'Singularity Orb',
    subtitle: 'Thiết kế ánh sáng & hiệu ứng thị giác.',
    body: [
      'Quả cầu đen hấp thụ mọi thứ và bắn ra những tia sáng — đó cũng là cách chúng tôi nghĩ về ánh sáng sân khấu: bóng tối là vật liệu, tia sáng là nét vẽ.',
      'Nhấn vào quả cầu để kích hoạt một đợt bùng nổ năng lượng. Mỗi tia tương ứng với một đèn beam/laser trong thiết kế thật, được lập trình cue-to-cue theo nhạc.',
    ],
    stats: [
      { k: 'Đèn điều khiển', v: '480+' },
      { k: 'Công suất laser', v: '60 W RGB' },
      { k: 'Show ánh sáng', v: '97' },
    ],
    items: [
      { name: 'Aurora Festival 2025', meta: 'Laser + Beam', desc: '240 beam tạo "mái vòm" ánh sáng trên 40.000 khán giả.' },
      { name: 'Lumen Gala', meta: 'Gala ra mắt', desc: 'Vũ đạo ánh sáng đồng bộ với dàn nhạc giao hưởng 60 người.' },
      { name: 'Nebula Drop', meta: 'Drone + Laser', desc: '300 drone phối hợp laser mô phỏng tinh vân trên sông Sài Gòn.' },
    ],
    tags: ['Lighting', 'Laser', 'VFX', 'Pixel mapping', 'grandMA3'],
    accent: '#b66bff',
  },
  piano: {
    id: 'piano',
    kicker: 'LIVE MUSIC · SPATIAL SOUND',
    title: 'Grand Piano',
    subtitle: 'Âm nhạc trực tiếp, âm thanh định vị 3D.',
    body: [
      'Cây đàn đang tự chơi bằng mẫu âm thanh của một cây grand piano thật. Đi xa, tiếng đàn nhỏ dần và tối đi; đi quanh, âm thanh quay theo tai bạn. Bạn cũng có thể nhấn trực tiếp lên phím để chơi cùng.',
      'Ở sự kiện thật, chúng tôi áp dụng cùng nguyên lý với hệ âm thanh L-Acoustics L-ISA: đặt nguồn âm đúng vị trí nghệ sĩ để khán giả "thấy" tiếng đàn đến từ đâu.',
    ],
    stats: [
      { k: 'Phím tương tác', v: '88' },
      { k: 'Mẫu âm', v: 'Salamander' },
      { k: 'Buổi hòa nhạc', v: '63' },
    ],
    items: [
      { name: 'Phantom Keys', meta: 'Recital + Mapping', desc: 'Piano solo với projection mapping lên thân đàn, 3.000 khách.' },
      { name: 'Nocturne Live', meta: 'Hòa nhạc đêm', desc: 'Sân khấu nổi trên hồ, âm thanh immersive 7.1.4.' },
      { name: 'Silent Hall', meta: 'Âm thanh không gian', desc: 'Triển lãm âm thanh đa kênh trong nhà hát bỏ hoang.' },
    ],
    tags: ['Live Music', 'Immersive Audio', 'L-ISA', 'Recording'],
    accent: '#ffd27a',
  },
  rubik: {
    id: 'rubik',
    kicker: 'SHOW CONTROL · LOGISTICS',
    title: 'Cube Solver',
    subtitle: 'Điều phối show phức tạp như giải một khối Rubik.',
    body: [
      'Một đêm diễn có hàng nghìn cue, hàng trăm con người và vài chục hệ thống phải xoay khớp với nhau. Khối Rubik này tự xáo trộn rồi tự giải — đúng như run-of-show: hỗn loạn trên giấy, trơn tru trên sân khấu.',
      'Nhấn vào khối để xáo trộn ngay lập tức và xem nó giải lại.',
    ],
    stats: [
      { k: 'Cue / show', v: '1.400' },
      { k: 'Nhân sự điều phối', v: '320' },
      { k: 'Sai lệch timecode', v: '< 1 frame' },
    ],
    items: [
      { name: 'Run-of-show Engine', meta: 'Tool nội bộ', desc: 'Timeline hợp nhất âm thanh – ánh sáng – video – pyro.' },
      { name: 'Backstage Radar', meta: 'Vận hành', desc: 'Bản đồ thời gian thực cho đội hậu đài và an ninh.' },
      { name: 'Load-in Planner', meta: 'Logistics', desc: 'Lên lịch dựng trong 36 giờ cho sân vận động.' },
    ],
    tags: ['Show Control', 'Timecode', 'Stage Management', 'Logistics'],
    accent: '#4dd8ff',
  },
  robot: {
    id: 'robot',
    kicker: 'INTERACTIVE · KINETIC · ROBOTICS',
    title: 'Colossus',
    subtitle: 'Cỗ máy khổng lồ làm khán giả dừng bước.',
    body: [
      'Colossus cao 12 mét, đầu luôn quay theo người đứng gần nhất, ngực là màn hình LED hiển thị dữ liệu sự kiện trực tiếp. Hãy đứng dưới chân và nhấn vào để nó chào bạn.',
      'Chúng tôi chế tạo các tác phẩm kinetic và robot biểu diễn cho khai trương trung tâm thương mại, triển lãm công nghệ và lễ hội ánh sáng.',
    ],
    stats: [
      { k: 'Chiều cao', v: '12 m' },
      { k: 'Trục chuyển động', v: '24' },
      { k: 'Lượt tương tác', v: '410K' },
    ],
    items: [
      { name: 'Colossus One', meta: 'Robot trình diễn', desc: 'Đầu tracking bằng camera, tay vẫy bằng điều khiển DMX.' },
      { name: 'Kinetic Rain', meta: 'Điêu khắc kinetic', desc: '1.200 quả cầu LED treo trên tời, tạo sóng chuyển động.' },
      { name: 'Meet the Machine', meta: 'Activation', desc: 'Gian hàng tương tác cho thương hiệu công nghệ tại CES Asia.' },
    ],
    tags: ['Robotics', 'Kinetic', 'Activation', 'Installation'],
    accent: '#ff8a3d',
  },
  cinema: {
    id: 'cinema',
    kicker: 'FILM · MOTION · AFTERMOVIE',
    title: 'Mini Cinema',
    subtitle: 'Rạp chiếu thu nhỏ cho những thước phim của studio.',
    body: [
      'Bước vào bên trong, ngồi xuống hàng ghế đỏ và xem showreel được dựng thời gian thực. Nhấn vào màn hình để chuyển giữa các tác phẩm.',
      'Studio quay và dựng aftermovie, teaser, tài liệu hậu trường và nội dung màn hình LED cho sân khấu — từ kịch bản đến màu phim.',
    ],
    stats: [
      { k: 'Aftermovie', v: '86' },
      { k: 'Lượt xem', v: '24M' },
      { k: 'Giải thưởng', v: '9' },
    ],
    items: [
      { name: 'AFTERGLOW', meta: 'Aftermovie · 2025', desc: 'Tổng kết lễ hội âm nhạc 3 ngày, quay 6K, 14 máy.' },
      { name: 'RUN OF SHOW', meta: 'Motion', desc: 'Phim giới thiệu quy trình sản xuất bằng typography động.' },
      { name: 'PARTICLES', meta: 'Visual', desc: 'Nội dung LED sân khấu tạo từ hệ hạt thời gian thực.' },
      { name: 'TUNNEL', meta: 'Immersive', desc: 'Phim vòm 360° cho dome 18 mét.' },
    ],
    tags: ['Aftermovie', 'Motion Design', 'LED Content', 'Color'],
    accent: '#ff4d4d',
  },
  stage: {
    id: 'stage',
    kicker: 'LIVE PRODUCTION · STAGE · LED',
    title: 'Main Stage',
    subtitle: 'Sân khấu thật, bàn điều khiển thật — bạn là người bấm cue.',
    body: [
      'Đến bàn FOH phía trước sân khấu và bấm các pad cue: đổi cảnh ánh sáng, bật nhạc, bắn pháo giấy. Đèn moving head, màn LED và đèn strobe sẽ phản hồi ngay.',
      'Orbita tự thiết kế và vận hành cả hệ thống: truss, LED, âm thanh line-array, ánh sáng, laser, pyro, đến đội kỹ thuật 40 người.',
    ],
    stats: [
      { k: 'LED lớn nhất', v: '1.200 m²' },
      { k: 'Công suất âm thanh', v: '480 kW' },
      { k: 'Thời gian dựng', v: '36 giờ' },
    ],
    items: [
      { name: 'Aurora Main Stage', meta: 'Festival', desc: 'Sân khấu 48 m, 3 ngày đêm, 40.000 khán giả mỗi đêm.' },
      { name: 'Neon Harbour', meta: 'Club tour', desc: 'Bộ stage-kit gọn gàng đi qua 12 thành phố trong 21 ngày.' },
      { name: 'Skyline Countdown', meta: 'Countdown', desc: 'Pháo hoa, laser và LED trên đỉnh tòa nhà 81 tầng.' },
    ],
    tags: ['Stage Design', 'LED', 'Sound', 'Pyro', 'Festival'],
    accent: '#ff3dcb',
  },
  products: {
    id: 'products',
    kicker: 'DIGITAL PRODUCTS',
    title: 'Product Lab',
    subtitle: 'Phần mềm phục vụ sự kiện, từ khoảnh khắc mua vé đến lúc ra về.',
    body: [
      'Năm màn hình đang xoay quanh tháp hologram là năm sản phẩm số của Orbita. Nhấn vào bất kỳ màn hình nào để đưa nó ra phía trước và xem giao diện chạy thật.',
      'Chúng tôi thiết kế, xây dựng và vận hành sản phẩm theo đúng nhịp của sự kiện: tải cực đại trong vài phút, không được phép sập.',
    ],
    stats: [
      { k: 'Vé xử lý / giờ', v: '38.000' },
      { k: 'Uptime ngày diễn', v: '99.99%' },
      { k: 'Người dùng', v: '1.2M' },
    ],
    items: [
      { name: 'TicketFlow', meta: 'Vé & check-in', desc: 'Vé QR xoay vòng chống chụp ảnh, check-in 1 giây.' },
      { name: 'LiveSync Dashboard', meta: 'Vận hành', desc: 'Bảng điều khiển thời gian thực: đám đông, nhiệt, hàng chờ.' },
      { name: 'Wayfinder AR', meta: 'Thực tế tăng cường', desc: 'Dẫn đường trong khuôn viên bằng AR, hiển thị lịch diễn.' },
      { name: 'Pulse Poll', meta: 'Tương tác', desc: 'Khán giả bình chọn bài tiếp theo — ánh sáng đổi theo kết quả.' },
      { name: 'CueDeck', meta: 'Công cụ show', desc: 'Giao diện cảm ứng điều khiển cue cho đạo diễn sân khấu.' },
    ],
    tags: ['Product Design', 'React', 'Realtime', 'AR', 'Ticketing'],
    accent: '#5dffb0',
  },
  beacon: {
    id: 'beacon',
    kicker: 'LIÊN HỆ',
    title: 'Signal Beacon',
    subtitle: 'Gửi một tín hiệu về Orbita.',
    body: [
      'Có một sự kiện cần "bùng nổ", một sản phẩm cần hiện thực hóa hoặc chỉ muốn trò chuyện về ánh sáng? Hãy phát tín hiệu — chúng tôi trả lời trong vòng 24 giờ.',
    ],
    stats: [
      { k: 'Phản hồi', v: '< 24h' },
      { k: 'Văn phòng', v: '3' },
      { k: 'Múi giờ', v: 'UTC+7' },
    ],
    items: [
      { name: STUDIO.email, meta: 'Email', desc: 'Dự án mới, hợp tác, báo giá.' },
      { name: STUDIO.phone, meta: 'Điện thoại / Zalo', desc: 'Dành cho việc gấp trong tuần diễn.' },
      { name: STUDIO.city, meta: 'Văn phòng', desc: 'Sẵn sàng bay đến mọi nơi có sân khấu.' },
    ],
    tags: ['Hợp tác', 'Báo giá', 'Tuyển dụng'],
    accent: '#6aa8ff',
  },
}
