/**
 * Portfolio source of truth. Only real owner, user-confirmed project names,
 * and repo-verified external links. No fictional studio customers, counts,
 * jobs, schools, awards, response SLAs or contact addresses.
 * STATUS "source" = original verified GitHub repository;
 * STATUS "brief" = project supplied by portfolio owner, evidence pending.
 */
export type PanelId =
  | 'about' | 'orb' | 'piano' | 'rubik' | 'robot' | 'apex'
  | 'ragnarok' | 'cinema' | 'stage' | 'products' | 'beacon' | 'vng'

export interface PanelItem {
  name: string
  meta: string
  desc: string
  url?: string
  evidence?: 'source' | 'brief' | 'pending'
  kind?: 'game' | 'web' | 'music' | 'video' | 'social' | 'competition' | 'skill' | 'contact'
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
  name: 'LÊ QUỐC KHÁNH',
  tagline: 'AI-assisted creative building · Interactive experiences',
  person: 'LÊ QUỐC KHÁNH',
  role: 'Vibecoder · Interactive 3D · Game & Web Prototyping',
  // Verified personal contact has not been supplied; never send to a fake inbox.
  email: '',
  phone: '',
  city: 'Việt Nam',
}
export const PANELS: Record<PanelId, PanelContent> = {
  about: {
    id: 'about',
    kicker: 'HỒ SƠ NGƯỜI SÁNG TẠO',
    title: 'LÊ QUỐC KHÁNH',
    subtitle: 'AI-assisted builder · game, web và trải nghiệm tương tác',
    body: [
      'Tôi sử dụng AI như cộng sự để biến ý tưởng thành prototype có thể chạy, trải nghiệm tương tác có thể mở và các quy trình sản xuất có thể kiểm chứng.',
      'Portfolio này là một không gian 3D dẫn tới từng dự án. Xem sản phẩm, chức năng, trạng thái thực tế và bằng chứng — thay vì chỉ xem những lời giới thiệu.',
    ],
    stats: [
      { k:'Hình thức xây dựng', v:'AI-assisted' },
      { k:'Trưng bày', v:'Interactive 3D' },
      { k:'Mảng trọng tâm', v:'Game · Web' },
    ],
    items: [
      { name:'ORBITA · 3D Portfolio',meta:'EXPERIENCE',desc:'Không gian 3D có buồng lái vũ trụ, đảo và các khu trưng bày dự án.',url:'https://github.com/Khanh-glitch/Kh-nh-port',evidence:'source',kind:'web' },
      { name:'EventFlow Pro',meta:'EVENT TOOLING',desc:'Workspace demo cho brief, cấu hình sản xuất, BOQ và đề xuất thương mại; chưa production-ready.',url:'https://github.com/Khanh-glitch/eventflow-pro',evidence:'source',kind:'web' },
      { name:'APEX CHAOS',meta:'BROWSER GAME',desc:'Game đấu trường trình duyệt, bộ engine và tài sản game riêng.',url:'https://github.com/Khanh-glitch/APEX-CHAOS',evidence:'source',kind:'game' },
    ],
    tags:['Vibecoding','AI-assisted','Interactive 3D','Creative systems'], accent:'#8fb4ff',
  },
  orb: {
    id: 'orb',
    kicker:'PHƯƠNG PHÁP · CREATIVE SYSTEMS',
    title:'Creative Engine',
    subtitle:'Cách biến ý tưởng và mô tả trải nghiệm thành sản phẩm có thể thử.',
    body:[
      'Điểm mạnh của tôi không phải là tự nhận viết tay mọi dòng code, mà là định nghĩa sản phẩm, chỉ đạo công cụ AI, thử nghiệm, so sánh và tổ chức nhiều vòng sửa cho tới khi trải nghiệm có cơ sở.',
      'Quả cầu là điểm trung tâm để hiểu phương pháp làm việc; bằng chứng nằm ở các dự án thực có thể truy cập từ đây.',
    ],
    stats:[{k:'Tiếp cận',v:'Prototype'},{k:'Phương pháp',v:'Iterative'},{k:'Chứng cứ',v:'Source'}],
    items:[
      {name:'ORBITA',meta:'INTERACTIVE PORTFOLIO',desc:'Không gian trình diễn WebGL, điều hướng 3D và tương tác GPU.',url:'https://github.com/Khanh-glitch/Kh-nh-port',evidence:'source',kind:'web'},
      {name:'EventFlow Pro',meta:'WORKFLOW SYSTEM',desc:'Hệ thống demo có các luồng brief → nhu cầu sản xuất → BOQ → báo giá → đề xuất.',url:'https://github.com/Khanh-glitch/eventflow-pro',evidence:'source',kind:'web'},
      {name:'Alphabet Engine',meta:'SYSTEMIC GAME',desc:'Roguelite autobattler nơi ký tự hợp thành từ và tạo vũ khí.',url:'https://github.com/Khanh-glitch/alphabet-engine',evidence:'source',kind:'game'},
    ],
    tags:['Concept','AI prompting','Source audit','Iteration'],accent:'#b66bff',
  },
  piano: {
    id:'piano',
    kicker:'MUSIC · AUDIO · VISUALIZER',
    title:'Music Lab',
    subtitle:'Trưng bày tác phẩm nhạc hoàn chỉnh, không nhầm phần piano môi trường với bản phối.',
    body:[
      'Cây piano trong thế giới 3D là một nhạc cụ tương tác của môi trường. Nó không tự đại diện cho một sản phẩm nhạc đa nhạc cụ của tôi.',
      'Hướng trình bày chuẩn là mỗi ca khúc có player phát bản phối đầy đủ, thông tin vai trò sản xuất, hình ảnh chuyển động đồng bộ audio và bằng chứng được phép công bố.',
    ],
    stats:[{k:'Trải nghiệm',v:'Audio'},{k:'Bản phối',v:'Full track'},{k:'Trạng thái media',v:'Chờ xác minh'}],
    items:[
      {name:'AI Music Production',meta:'MUSIC WORKFLOW',desc:'Quy trình tạo, chọn, chỉnh và kiểm duyệt các bản phối có hỗ trợ AI. Danh sách tác phẩm công khai cần xác minh.',evidence:'brief',kind:'music'},
      {name:'Audio-reactive Visualization',meta:'VISUALIZER',desc:'Khung trưng bày chuyển động dựa trên năng lượng và cấu trúc bản nhạc, không giả lập một cây đàn đang chơi cả bản phối.',evidence:'brief',kind:'music'},
    ],
    tags:['Music','AI-assisted','Arrangement','Audio reactive'],accent:'#ffd27a',
    slotNote:'Chưa có tệp audio và quyền công bố từng bài trong dữ liệu đã xác minh; không phát nhạc mẫu và nhận là tác phẩm thật.',
  },
  rubik: {
    id:'rubik',
    kicker:'NĂNG LỰC · HỌC VẤN · HÀNH TRÌNH',
    title:'Capability Cube',
    subtitle:'Mỗi mặt khối Rubik là một nhóm năng lực và chứng cứ.',
    body:[
      'Dùng hình ảnh một khối Rubik được giải để kể quá trình học, thử nghiệm và phối hợp các công cụ: học kỹ thuật, hiểu sản phẩm, kiểm định kết quả và hoàn thiện UX.',
      'Học vấn chính quy và chứng chỉ sẽ chỉ được công bố khi đối chiếu CV/tài liệu xác thực; không tự đặt tên trường, bằng cấp hay số năm kinh nghiệm.',
    ],
    stats:[{k:'Thực hành',v:'Vibecoding'},{k:'Định hướng',v:'Product'},{k:'Bằng chứng',v:'Repositories'}],
    items:[
      {name:'Workflow & Product Reasoning',meta:'THỰC HÀNH',desc:'Định nghĩa yêu cầu, chia nhỏ sản phẩm, kiểm tra source và chứng cứ nghiệm thu.',evidence:'brief',kind:'skill'},
      {name:'Interactive Web / 3D',meta:'SẢN PHẨM',desc:'ORBITA, React, Three.js và WebGL trong portfolio đang triển khai.',url:'https://github.com/Khanh-glitch/Kh-nh-port',evidence:'source',kind:'skill'},
      {name:'Game Design & Iteration',meta:'DỰ ÁN',desc:'Gameplay, hệ thống tương tác, game prototype và vòng lặp thử nghiệm.',url:'https://github.com/Khanh-glitch/Soul-of-Hero',evidence:'source',kind:'skill'},
      {name:'Học vấn & chứng chỉ',meta:'XÁC THỰC',desc:'Chưa có đủ hồ sơ bằng cấp/trường/mốc thời gian để công bố chính xác.',evidence:'pending',kind:'skill'},
    ],
    tags:['Learning','Process','Product thinking','Portfolio evidence'],accent:'#4dd8ff',
  },
  robot: {
    id:'robot',
    kicker:'GAME PORTFOLIO · PROMPT TO PLAY',
    title:'Colossus Game Lab',
    subtitle:'Trạm triển lãm các thế giới game và hành trình làm game với AI.',
    body:[
      'Kích hoạt Colossus để triệu hồi APEX CHAOS và Ragnarok trên hai bệ 3D. Các game thật có source riêng; mô hình trình diễn trên đảo không được gọi là game hoàn chỉnh.',
      'Các cuộc thi và thử thách Prompt to Play thuộc hành trình thiết kế game, không nên bị trình bày như một giải thưởng khi chưa có chứng cứ kết quả.',
    ],
    stats:[{k:'Game',v:'APEX'},{k:'Game',v:'Ragnarok'},{k:'Phương pháp',v:'AI-assisted'}],
    items:[
      {name:'APEX CHAOS',meta:'BROWSER ARENA',desc:'Dự án game trình duyệt có engine, tài sản và các chế độ chơi; xem repo để đánh giá đúng phạm vi.',url:'https://github.com/Khanh-glitch/APEX-CHAOS',evidence:'source',kind:'game'},
      {name:'Ragnarok · Soul of Hero',meta:'PIXEL SURVIVAL RPG',desc:'Game pixel sinh tồn đang phát triển, các hệ thống gameplay và VFX được triển khai theo workstreams.',url:'https://github.com/Khanh-glitch/Soul-of-Hero',evidence:'source',kind:'game'},
      {name:'Alphabet Engine',meta:'WORD COMBAT ROGUELITE',desc:'Prototype roguelite sử dụng chữ cái, từ và tương tác chiến đấu hệ thống.',url:'https://github.com/Khanh-glitch/alphabet-engine',evidence:'source',kind:'game'},
      {name:'Prompt to Play',meta:'GAME JAM / COMPETITION',desc:'Hành trình thi và làm game có AI hỗ trợ; hồ sơ thành tích/chứng nhận cần đối chiếu trước khi công bố.',evidence:'brief',kind:'competition'},
    ],
    tags:['Game design','Browser game','Pixel art','Prompt to Play'],accent:'#ff8a3d',
  },
  apex: {
    id:'apex',
    kicker:'GAME · BROWSER ARENA',
    title:'APEX CHAOS',
    subtitle:'Game đấu trường trình duyệt với engine và bộ tài sản riêng.',
    body:[
      'Dự án APEX CHAOS có mã nguồn game trên GitHub. Robot NEWBOT và các pha trình diễn 3D tại Colossus là cách trực quan hóa nội dung game.',
      'Đánh giá gameplay và chế độ chơi ở sản phẩm gốc; không đồng nhất bệ trình diễn với một phiên bản game đầy đủ.',
    ],
    stats:[{k:'Nền tảng',v:'Browser'},{k:'Nhánh',v:'Game'},{k:'Tài liệu',v:'Source'}],
    items:[
      {name:'APEX CHAOS · Source',meta:'REPOSITORY',desc:'Mã nguồn engine game, giao diện và asset đã được xuất bản trên GitHub.',url:'https://github.com/Khanh-glitch/APEX-CHAOS',evidence:'source',kind:'game'},
      {name:'NEWBOT',meta:'GAME CHARACTER',desc:'Robot chiến đấu được tái hiện tại khu Colossus; thao tác với bệ để xem bản trình diễn.',evidence:'brief',kind:'game'},
    ],
    tags:['Game','NEWBOT','AI-assisted iteration'],accent:'#ff941f',
    action:{label:'XEM SOURCE APEX CHAOS',url:'https://github.com/Khanh-glitch/APEX-CHAOS'},
  },
  ragnarok: {
    id:'ragnarok',
    kicker:'GAME · PIXEL SURVIVAL · IN DEVELOPMENT',
    title:'Ragnarok: The Last Island',
    subtitle:'Thế giới RPG sinh tồn pixel đang được phát triển.',
    body:[
      'Soul-of-Hero chứa công việc hệ thống gameplay, tài nguyên, bản đồ, chiến đấu và VFX. Dự án vẫn đang triển khai; không gắn nhãn final hoặc playable release khi chưa có bản nghiệm thu.',
      'Mô hình đảo nổi được Colossus dựng lên để người xem hình dung thế giới, không thay thế bằng chứng của phiên bản game thực.',
    ],
    stats:[{k:'Thể loại',v:'Survival RPG'},{k:'Phong cách',v:'Pixel art'},{k:'Trạng thái',v:'Development'}],
    items:[
      {name:'Soul-of-Hero',meta:'REPOSITORY',desc:'Mã nguồn và lịch sử triển khai game trên GitHub.',url:'https://github.com/Khanh-glitch/Soul-of-Hero',evidence:'source',kind:'game'},
      {name:'Gameplay & VFX',meta:'R&D',desc:'Các cơ chế sống còn, bản đồ, boss và hiệu ứng đang được thử nghiệm, so sánh và nghiệm thu.',evidence:'brief',kind:'game'},
    ],
    tags:['Godot','Pixel art','Survival','World systems'],accent:'#5dffb0',
    action:{label:'XEM SOURCE SOUL OF HERO',url:'https://github.com/Khanh-glitch/Soul-of-Hero'},
  },
  cinema: {
    id:'cinema',
    kicker:'VIDEO · SHORT FORM · SOCIAL STORYTELLING',
    title:'Motion & Social Lab',
    subtitle:'Nơi trưng bày reel, video ngắn, hậu kỳ và hành trình phát triển kênh.',
    body:[
      'Mini Cinema là khu dành cho video, hậu kỳ và nội dung social. Các tác phẩm cần có footage thực, vai trò edit rõ ràng và link được kiểm chứng; các khung reel tạo sẵn của môi trường không phải bằng chứng sản phẩm cá nhân.',
      'Kênh TikTok Quê Quá Quao sẽ nằm trong nhánh social tại đây: từ ý tưởng nội dung, format, nhịp dựng đến thử nghiệm tăng trưởng. Chưa có đường dẫn kênh đã xác minh trong source.',
    ],
    stats:[{k:'Định dạng',v:'Short form'},{k:'Kênh',v:'TikTok'},{k:'Nội dung',v:'Video'}],
    items:[
      {name:'Quê Quá Quao',meta:'TIKTOK / SOCIAL',desc:'Dự án kênh nội dung đã có ý tưởng; cần xác minh URL kênh, clip mẫu và vai trò để hiển thị preview đúng sản phẩm.',evidence:'brief',kind:'social'},
      {name:'Reel / Video Production',meta:'EDITING',desc:'Video ngắn, dựng và kiểm soát nhịp cho nền tảng social; chỉ công bố clip có quyền sử dụng.',evidence:'brief',kind:'video'},
      {name:'CapCut automation research',meta:'CREATIVE TOOLS',desc:'Thử nghiệm workflow sản xuất hàng loạt video ngắn; chưa công bố dưới dạng sản phẩm hoàn thiện.',evidence:'brief',kind:'video'},
    ],
    tags:['CapCut','TikTok','Editing','Motion','Reels'],accent:'#ff4d4d',
    slotNote:'Danh sách clip và URL kênh cần xác minh để bật player thật; không đưa video môi trường vào vai trò tác phẩm cá nhân.',
  },
  vng: {
    id:'vng',
    kicker:'VNG · COMPETITION ENTRY',
    title:'VNG Project Gallery',
    subtitle:'Trưng bày bài dự thi và quá trình sáng tạo liên quan đến cuộc thi tại VNG.',
    body:[
      'Khu vực VNG đã có mô hình studio, máy chiếu và bộ điều khiển slide 3D. Portfolio sẽ dùng vị trí này cho bài dự thi, quá trình thực hiện và chứng cứ đúng của cuộc thi.',
      'Đây là câu chuyện về một cuộc thi tại VNG, không phải khẳng định từng làm nhân viên VNG hoặc đạt giải thưởng khi chưa có chứng cứ.',
    ],
    stats:[{k:'Bối cảnh',v:'Competition'},{k:'Trưng bày',v:'3D Gallery'},{k:'Chứng cứ',v:'Pending'}],
    items:[
      {name:'Bài dự thi tại VNG',meta:'COMPETITION',desc:'Tên cuộc thi, brief, bài nộp, vai trò và kết quả cần được xác minh bằng tư liệu gốc.',evidence:'brief',kind:'competition'},
      {name:'Work Process & Evidence',meta:'CASE STUDY',desc:'Bố cục 4 slide có sẵn; cần thay nội dung placeholder bằng ảnh, video và liên kết chính xác.',evidence:'pending',kind:'competition'},
    ],
    tags:['VNG','Competition','Project evidence'],accent:'#e65a26',
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
    id:'products',
    kicker:'WEB · PLATFORMS · CREATIVE TOOLS',
    title:'Product Lab',
    subtitle:'Các sản phẩm web và nền tảng thật — từ công cụ sản xuất đến trải nghiệm học tập.',
    body:[
      'Các màn hình hologram là điểm vào những sản phẩm có mã nguồn đã xác minh. Chúng không đại diện cho những ứng dụng vé giả với số liệu tăng trưởng được bịa ra.',
      'EventFlow Pro là browser-local product demo đã kiểm thử, CHƯA production-ready. MathPath là workspace học tập. ORBITA chính là portfolio 3D này.',
    ],
    stats:[{k:'Dự án',v:'EventFlow'},{k:'Ứng dụng',v:'MathPath'},{k:'Trải nghiệm',v:'ORBITA'}],
    items:[
      {name:'EventFlow Pro',meta:'EVENT AGENCY WORKSPACE',desc:'Demo workflow brief → nhu cầu sản xuất → BOQ → quote → proposal PDF, cần tích hợp để vận hành production.',url:'https://github.com/Khanh-glitch/eventflow-pro',evidence:'source',kind:'web'},
      {name:'MathPath',meta:'LEARNING PLATFORM',desc:'Không gian học Toán cho Kinh tế và Quản trị, Living Board, bài luyện tập và tiến trình học.',url:'https://github.com/Khanh-glitch/MathPath',evidence:'source',kind:'web'},
      {name:'ORBITA Portfolio',meta:'3D EXPERIENCE',desc:'Portfolio WebGL có phi thuyền mở đầu và thế giới 3D tương tác, là chính trải nghiệm đang xem.',url:'https://github.com/Khanh-glitch/Kh-nh-port',evidence:'source',kind:'web'},
      {name:'Alphabet Engine',meta:'SYSTEMIC GAME ENGINE',desc:'Prototype trò chơi chữ trở thành vũ khí và tạo hệ thống chiến đấu phản ứng dây chuyền.',url:'https://github.com/Khanh-glitch/alphabet-engine',evidence:'source',kind:'game'},
      {name:'APEX CHAOS',meta:'BROWSER GAME',desc:'Game đấu trường trình duyệt; màn hình hologram là cổng dẫn tới hồ sơ và mã nguồn game, không phải ảnh chụp ứng dụng giả.',url:'https://github.com/Khanh-glitch/APEX-CHAOS',evidence:'source',kind:'game'},
    ],
    tags:['EventFlow','Next.js','React','WebGL','Systems'],accent:'#5dffb0',
  },
  beacon: {
    id:'beacon',
    kicker:'CONTACT · COLLABORATION',
    title:'Signal Beacon',
    subtitle:'Kết nối để trao đổi dự án, cơ hội hoặc hợp tác.',
    body:[
      'Liên hệ qua các kênh chính thức được xác minh. Email/điện thoại cá nhân chưa được cung cấp nên hệ thống sẽ không gửi thư tới một địa chỉ mẫu hoặc hứa phản hồi trong 24 giờ.',
    ],
    stats:[{k:'Hồ sơ',v:'GitHub'},{k:'Kết nối',v:'Online'},{k:'Email',v:'Chưa xác minh'}],
    items:[
      {name:'GitHub · Khanh-glitch',meta:'VERIFIED CONTACT',desc:'Hồ sơ, dự án và lịch sử mã nguồn công khai.',url:'https://github.com/Khanh-glitch',evidence:'source',kind:'contact'},
      {name:'Email cá nhân',meta:'CẦN XÁC MINH',desc:'Cần địa chỉ do chính chủ cung cấp; không dùng hello@orbita.studio.',evidence:'pending',kind:'contact'},
    ],
    tags:['Work','Collaboration','GitHub'],accent:'#6aa8ff',
    action:{label:'MỞ HỒ SƠ GITHUB',url:'https://github.com/Khanh-glitch'},
  },
}
