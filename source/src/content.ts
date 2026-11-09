export type PanelId =
  | 'about'
  | 'orb'
  | 'piano'
  | 'rubik'
  | 'robot'
  | 'apex'
  | 'ragnarok'
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
  action?: { label: string; url: string }
  slotNote?: string
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
    kicker: 'GAME SHOWCASE · LASER SUMMONING · PROMPT TO PLAY',
    title: 'Colossus',
    subtitle: 'Cỗ máy triệu hồi thế giới game bằng tia laser.',
    body: [
      'Colossus đóng vai trò trạm trình diễn game ngay trên đĩa bay: khi được kích hoạt, robot xoay thân, hướng hai tay phát tia laser xuống hai bệ phóng để dựng hình 3D theo thời gian thực cho APEX CHAOS và Ragnarok: The Last Island.',
      'Khu vực này cũng gắn với hành trình làm game có AI hỗ trợ (vibecoding) và trải nghiệm Prompt to Play — nơi ý tưởng thiết kế được biến thành sản phẩm chơi được và kiểm thử trực tiếp.',
    ],
    stats: [
      { k: 'Thế giới triệu hồi', v: '02' },
      { k: 'Chế độ dựng hình', v: '3D Laser' },
      { k: 'Chiều cao', v: '12 m' },
    ],
    items: [
      { name: 'APEX CHAOS · NEWBOT', meta: 'Bệ trái · Playable Demo', desc: 'Mô hình 3D đầy đủ của NEWBOT cùng hai kỹ năng đặc trưng A1 Dash Lock & A2 Armor Surge.' },
      { name: 'Ragnarok: The Last Island', meta: 'Bệ phải · Pixel Survival', desc: 'Tiểu cảnh đảo sinh tồn 3D giữ trọn chất pixel-art với vòng lặp đánh quái – nhặt đồ – đốt lửa trại.' },
      { name: 'Prompt to Play', meta: 'AI-Assisted Jam', desc: 'Định hướng game design & phối hợp nhóm tạo prototype tương tác trong thời gian giới hạn.' },
    ],
    tags: ['Game Showcase', 'Laser Fabrication', 'AI-Assisted', 'Prompt to Play'],
    accent: '#ff8a3d',
    slotNote: 'Kiến trúc trưng bày đã sẵn sàng để gắn luồng bot tự chơi và cho phép người xem tiếp quản điều khiển trực tiếp trong giai đoạn tiếp theo.',
  },
  apex: {
    id: 'apex',
    kicker: 'GAME 01 · 2D ARENA COMBAT · PLAYABLE DEMO',
    title: 'APEX CHAOS',
    subtitle: 'Choose a fighter. Change the fight.',
    body: [
      'APEX CHAOS là game đấu trường 2D chạy trên trình duyệt với bản sắc nhân vật rõ nét, cơ chế nhặt vũ khí đa dạng và các chế độ Solo vs BOT, Local 1v1 và BOT WAVE PvE.',
      'Nhân vật đang đứng trước mặt bạn là NEWBOT — cỗ máy bị vứt bỏ tại Scrap Basin nhưng tự lắp lại mình để chiến đấu. Hãy nhấn vào NEWBOT để kích hoạt chiêu thức A1 Target Lock Dash, A2 Armor Core Surge hoặc Arsenal Overdrive.',
    ],
    stats: [
      { k: 'Nhân vật tiêu biểu', v: 'NEWBOT' },
      { k: 'Chế độ chơi', v: 'Solo · 1v1 · Wave' },
      { k: 'Trạng thái', v: 'Playable Demo' },
    ],
    items: [
      { name: 'A1 · Target Lock & Dash', meta: 'Kỹ năng 1', desc: 'Khóa mục tiêu bằng tia ngắm hổ phách, lao tới kẹp giáp với cặp càng cơ khí khổng lồ.' },
      { name: 'A2 · Armor Core Surge', meta: 'Kỹ năng 2', desc: 'Mở các tấm giáp vai & hàm, kích hoạt đường năng lượng và khiên lõi Scrap.' },
      { name: 'Scrap Basin Arsenal', meta: 'Hệ thống chiến đấu', desc: 'Phát triển theo hướng AI-assisted, tập trung vào cảm giác ra đòn, nhịp đấu và cân bằng nhân vật.' },
    ],
    tags: ['APEX CHAOS', 'NEWBOT', 'Arena Combat', 'HTML5 Demo'],
    accent: '#ff941f',
    action: { label: 'CHƠI DEMO APEX CHAOS ↗', url: 'https://apex-chaos.pages.dev/' },
    slotNote: 'Sẵn sàng tích hợp: Bot tự đấu trong Scrap Basin & chế độ người xem tiếp quản điều khiển.',
  },
  ragnarok: {
    id: 'ragnarok',
    kicker: 'GAME 02 · PIXEL SURVIVAL RPG · IN DEVELOPMENT',
    title: 'Ragnarok: The Last Island',
    subtitle: 'Một hòn đảo nơi mọi lựa chọn sinh tồn đều để lại hậu quả.',
    body: [
      'Ragnarok: The Last Island (repo Soul-of-Hero) là dự án game nhập vai – sinh tồn góc nhìn từ trên xuống theo phong cách pixel-art, kết hợp khám phá, khai thác tài nguyên, chế tạo, chiến đấu và đối đầu biến cố theo mùa.',
      'Tiểu cảnh đảo nổi 3D này tái hiện trực tiếp nhịp sống trên đảo: anh hùng tự di chuyển cày tài nguyên, né đòn quái thú, tung nhát chém PixelFX, mở rương báu và hồi phục bên đống lửa trại. Nhấn vào đảo để triệu hồi Boss Surge & đổi bầu không khí đảo.',
    ],
    stats: [
      { k: 'Phong cách', v: 'Pixel-Art 2.5D' },
      { k: 'Nền tảng', v: 'Godot 4.7 / Web' },
      { k: 'Trạng thái', v: 'In Development' },
    ],
    items: [
      { name: 'Vòng lặp Sinh tồn & Cày đồ', meta: 'Core Loop', desc: 'Thu thập quặng & tinh thể, hạ quái vật đảo, nhặt vật phẩm rơi và nâng cấp trang bị.' },
      { name: 'PixelFX & Đấu Boss', meta: 'Combat Identity', desc: 'Dấu hiệu báo đòn (tell), lướt né, hiệu ứng chém pixel sắc nét và hệ thống Elder Boss.' },
      { name: 'Hệ thống Mùa & Hậu quả', meta: 'World Rules', desc: 'Nhịp ngày/đêm, chuyển mùa và sinh thái tài nguyên ảnh hưởng trực tiếp tới chiến thuật.' },
    ],
    tags: ['Ragnarok', 'Soul-of-Hero', 'Pixel Art', 'Survival RPG'],
    accent: '#5dffb0',
    action: { label: 'XEM REPO SOUL-OF-HERO ↗', url: 'https://github.com/Khanh-glitch/Soul-of-Hero' },
    slotNote: 'Sẵn sàng tích hợp: Bot auto-grind & takeover trực tiếp ngay trên đảo nổi.',
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
