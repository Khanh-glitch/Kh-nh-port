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
  evidence?: 'source' | 'private' | 'cv' | 'brief' | 'pending'
  kind?: 'game' | 'web' | 'music' | 'video' | 'social' | 'competition' | 'skill' | 'contact'
  visual?: { src: string; alt: string; caption: string }
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
  email: 'mencan308@gmail.com',
  phone: '+84 328 494 207',
  city: 'TP. Hồ Chí Minh, Việt Nam',
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
      { name:'EventFlow Pro',meta:'EVENT TOOLING',desc:'Workspace demo cho brief, cấu hình sản xuất, BOQ và đề xuất thương mại; chưa production-ready. Source repository hiện là riêng tư.',evidence:'private',kind:'web' },
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
      {name:'EventFlow Pro',meta:'WORKFLOW SYSTEM',desc:'Hệ thống demo có các luồng brief → nhu cầu sản xuất → BOQ → báo giá → đề xuất.',evidence:'private',kind:'web'},
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
      {name:'AI Music Production',meta:'MUSIC WORKFLOW',desc:'Quy trình tạo, chọn, chỉnh và kiểm duyệt các bản phối có hỗ trợ AI. Danh sách tác phẩm công khai cần xác minh.',evidence:'brief',kind:'music',visual:{src:'/03_music_vibes.jpg',alt:'Poster âm nhạc Music Led My Life trong kho media của portfolio',caption:'Poster âm nhạc trong kho tư liệu · chưa phải audio player hoặc bằng chứng phát hành'}},
      {name:'Audio-reactive Visualization',meta:'VISUALIZER',desc:'Khung trưng bày chuyển động dựa trên năng lượng và cấu trúc bản nhạc, không giả lập một cây đàn đang chơi cả bản phối.',evidence:'brief',kind:'music'},
    ],
    tags:['Music','AI-assisted','Arrangement','Audio reactive'],accent:'#ffd27a',
    slotNote:'Chưa có tệp audio và quyền công bố từng bài trong dữ liệu đã xác minh; không phát nhạc mẫu và nhận là tác phẩm thật.',
  },
  rubik: {
    id:'rubik',
    kicker:'EDUCATION · EVENT PRACTICE · RESEARCH',
    title:'Capability Cube',
    subtitle:'Từ học vấn UEH, thực tập sản xuất sự kiện đến game, AI và sản phẩm số.',
    body:[
      'Hành trình học tập bắt đầu tại Đại học Kinh tế TP. Hồ Chí Minh (UEH), chuyên ngành Quản trị dịch vụ sự kiện và giải trí, giai đoạn 2023–2026. CV tháng 10/2026 ghi mốc tốt nghiệp dự kiến; không trình bày là đã được cấp bằng.',
      'Các mặt Rubik liên kết học thuật, thực tế sản xuất sự kiện, thiết kế game và tư duy thử nghiệm. Sự liên thông này thể hiện cách tôi dùng trải nghiệm ngành sự kiện để phát triển công cụ và nội dung tương tác.',
    ],
    stats:[{k:'Học vấn',v:'UEH'},{k:'Giai đoạn theo CV',v:'2023–26'},{k:'Hướng',v:'Event · AI'}],
    items:[
      {name:'UEH · Quản trị dịch vụ sự kiện và giải trí',meta:'EDUCATION / CV',desc:'Đại học Kinh tế TP. Hồ Chí Minh, giai đoạn học 2023–2026 (dự kiến hoàn thành theo CV tháng 10/2026). Không khẳng định đã tốt nghiệp.',evidence:'cv',kind:'skill'},
      {name:'Thực tập sản xuất sự kiện · Sen Việt',meta:'EXPERIENCE / CV',desc:'Event Production Intern tại Sen Viet Communication Investment Company Limited; hỗ trợ lập kế hoạch, triển khai hiện trường, phối hợp các nhóm sản xuất, thiết kế và truyền thông. Theo CV cá nhân.',evidence:'cv',kind:'skill'},
      {name:'Khóa luận: Hình ảnh quảng bá sự kiện có AI tạo sinh',meta:'ACADEMIC RESEARCH',desc:'Đánh giá nội dung thị giác quảng bá sự kiện có sự tham gia của AI tạo sinh: so sánh nhóm phía sản xuất và người tham dự tại TP. Hồ Chí Minh. Tài liệu khóa luận đề ngày 26/10/2026.',evidence:'cv',kind:'skill'},
      {name:'Interactive Web / 3D',meta:'PORTFOLIO SOURCE',desc:'ORBITA với trải nghiệm buồng lái, đảo 3D, HUD và không gian khám phá dự án.',url:'https://github.com/Khanh-glitch/Kh-nh-port',evidence:'source',kind:'skill'},
      {name:'Game Design & Iteration',meta:'PORTFOLIO SOURCE',desc:'Các vòng thiết kế gameplay, xây dựng prototype, thử nghiệm tương tác và cải thiện UX trong các game cá nhân.',url:'https://github.com/Khanh-glitch/APEX-CHAOS',evidence:'source',kind:'skill'},
    ],
    tags:['UEH','Event production','Research','Vibecoding','Game design'],accent:'#4dd8ff',
  },
  robot: {
    id:'robot',
    kicker:'GAME PORTFOLIO · VNG GAMES PROMPT TO PLAY',
    title:'Colossus Game Lab',
    subtitle:'Các thế giới game và bài dự thi được kể bằng mô hình 3D, gameplay và mã nguồn thật.',
    body:[
      'Colossus triệu hồi APEX CHAOS và Ragnarok trên hai bệ. Bệ 3D là phương thức triển lãm, không được mô tả như một bản game đã hoàn thiện.',
      'CV Game Designer có ghi nhận VNGGames Prompt To Play 2026: Top 26 và một prototype puzzle-RPG hoàn thiện trong 24 giờ. Đây là kết quả do ứng viên ghi trong CV; cần chứng nhận/link từ ban tổ chức để xác minh độc lập.',
    ],
    stats:[{k:'Game',v:'APEX'},{k:'Game',v:'Ragnarok'},{k:'Cuộc thi / CV',v:'Top 26'}],
    items:[
      {name:'APEX CHAOS',meta:'BROWSER ARENA',desc:'Game trình duyệt với character abilities, combat mechanics, vật lý và sprite animations; có repo công khai.',url:'https://github.com/Khanh-glitch/APEX-CHAOS',evidence:'source',kind:'game'},
      {name:'Ragnarok · Soul of Hero',meta:'PIXEL SURVIVAL RPG',desc:'Game sinh tồn đang phát triển, các hệ thống gameplay và VFX triển khai theo workstreams.',url:'https://github.com/Khanh-glitch/Soul-of-Hero',evidence:'source',kind:'game'},
      {name:'Alphabet Engine',meta:'SYSTEMIC WORD COMBAT',desc:'Prototype roguelite chữ cái kết hợp thành từ và tạo ra vũ khí vật lý.',url:'https://github.com/Khanh-glitch/alphabet-engine',evidence:'source',kind:'game'},
      {name:'VNGGames Prompt To Play 2026',meta:'TOP 26 · THEO CV',desc:'CV cá nhân ghi Top 26; xây dựng prototype puzzle-RPG có pathfinding và nhiều cơ chế giải đố trong 24 giờ. Chưa có bằng chứng chính thức của BTC liên kết tại đây.',evidence:'cv',kind:'competition'},
    ],
    tags:['Game design','Prompt to Play 2026','Browser game','Pixel art'],accent:'#ff8a3d',
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
      {name:'Reel / Video Production',meta:'EDITING',desc:'Video ngắn, dựng và kiểm soát nhịp cho nền tảng social; chỉ công bố clip có quyền sử dụng.',evidence:'brief',kind:'video',visual:{src:'/02_social_debate_poster.jpg',alt:'Khung hình tư liệu social ngoài trời trong kho portfolio',caption:'Ảnh tư liệu social có trong bundle · không phải video reel hoặc chỉ số tăng trưởng'}},
      {name:'CapCut automation research',meta:'CREATIVE TOOLS',desc:'Thử nghiệm workflow sản xuất hàng loạt video ngắn; chưa công bố dưới dạng sản phẩm hoàn thiện.',evidence:'brief',kind:'video'},
    ],
    tags:['CapCut','TikTok','Editing','Motion','Reels'],accent:'#ff4d4d',
    slotNote:'Danh sách clip và URL kênh cần xác minh để bật player thật; không đưa video môi trường vào vai trò tác phẩm cá nhân.',
  },
  vng: {
    id:'vng',
    kicker:'VNGGAMES · PROMPT TO PLAY 2026',
    title:'Prompt To Play',
    subtitle:'Bài dự thi game jam: prototype puzzle-RPG trong 24 giờ.',
    body:[
      'Theo CV Game Designer của LÊ QUỐC KHÁNH: tham gia cuộc thi VNGGames Prompt To Play 2026, đạt Top 26 và phát triển một prototype puzzle-RPG chơi được trong vòng 24 giờ, kết hợp pathfinding với nhiều cơ chế giải đố.',
      'Khu VNG giới thiệu bối cảnh và cách làm sản phẩm trong cuộc thi, không phải kinh nghiệm làm nhân viên VNG. Top 26 là thông tin được công bố trong CV của chủ sở hữu, chưa được xác minh bằng kết quả chính thức của ban tổ chức.',
    ],
    stats:[{k:'Cuộc thi',v:'VNGGames'},{k:'Thời gian / CV',v:'24 giờ'},{k:'Kết quả / CV',v:'Top 26'}],
    items:[
      {name:'Prompt To Play 2026',meta:'AI GAME JAM / CV',desc:'Ứng viên ghi nhận Top 26. Kết quả cần chứng cứ BTC hoặc hình ảnh xác nhận trước khi gọi là độc lập xác minh.',evidence:'cv',kind:'competition',visual:{src:'/01_ai_prompt_to_play.jpg',alt:'Ảnh nhóm thảo luận quanh bàn máy tính trong kho tư liệu Prompt to Play',caption:'Ảnh tư liệu đã có trong portfolio · không thay thế xác nhận thứ hạng từ BTC'}},
      {name:'Puzzle-RPG prototype',meta:'24-HOUR GAME',desc:'Bài dự thi kết hợp tìm đường (pathfinding) và các cơ chế giải đố; mã nguồn/video gameplay của bài nộp cần được bổ sung đúng bản.',evidence:'cv',kind:'game'},
      {name:'Quy trình & tư liệu dự thi',meta:'CASE STUDY / GALLERY',desc:'Bố cục bốn slide giữ nguyên trên máy chiếu VNG: brief, thực hiện, prototype, kết quả. Không dựng bằng chứng giả hoặc lấy footage không liên quan.',evidence:'brief',kind:'competition'},
    ],
    tags:['VNGGames','Prompt To Play 2026','Puzzle-RPG','Game Jam'],accent:'#e65a26',
  },
  stage: {
    id:'stage',
    kicker:'LIVE SHOW · INTERACTIVE CASE STUDY',
    title:'Main Stage',
    subtitle:'Khám phá các chương trình đã được đối chiếu tư liệu qua bàn FOH 3D.',
    body:[
      'Main Stage là khu vực case study đã hoàn thiện. Chọn chương trình, chuyển scene và xem các bằng chứng hình ảnh/video được ghi rõ nguồn trong hệ thống FOH.',
      'Các con số gắn với một chương trình do bên tổ chức/báo chí công bố không được diễn giải thành thành tích cá nhân hoặc số show do tôi sản xuất.',
    ],
    stats:[{k:'Trình diễn',v:'3D FOH'},{k:'Tư liệu',v:'Verified'},{k:'Nguồn',v:'Show cases'}],
    items:[
      {name:'GET DOWNTOWN 2023: |SI:N|',meta:'CASE STUDY',desc:'Hồ sơ tại FOH gồm footage và ảnh tư liệu chính thức về chương trình tại UEH.',evidence:'source'},
      {name:'MỘT CHÚT YÊU THƯƠNG 3',meta:'CASE STUDY',desc:'Tư liệu chương trình và phần hỗ trợ cộng đồng, có nguồn độc lập trong kho case study.',evidence:'source'},
      {name:'BẢN GIAO HƯỞNG XANH',meta:'CASE STUDY',desc:'Tư liệu chương trình nghệ thuật với nguồn và quyền sử dụng được chú thích trong khu FOH.',evidence:'source'},
    ],
    tags:['Show case studies','Stage production','Video evidence','FOH'],
    accent:'#ff3dcb',
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
      {name:'EventFlow Pro',meta:'EVENT AGENCY WORKSPACE',desc:'Demo workflow brief → nhu cầu sản xuất → BOQ → quote → proposal PDF, cần tích hợp để vận hành production.',evidence:'private',kind:'web'},
      {name:'MathPath',meta:'LEARNING PLATFORM',desc:'Không gian học Toán cho Kinh tế và Quản trị, Living Board, bài luyện tập và tiến trình học.',evidence:'private',kind:'web'},
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
    subtitle:'Kết nối để trao đổi cơ hội tuyển dụng, sản phẩm hoặc dự án.',
    body:[
      'Các kênh liên hệ dưới đây được chủ sở hữu công bố trong CV ứng tuyển: email, điện thoại và LinkedIn. Bấm gửi tín hiệu để soạn email với lời nhắn của bạn.',
      'Truy cập hồ sơ GitHub để xem các dự án có mã nguồn công khai. Không hứa thời gian phản hồi hoặc gán doanh thu/khách hàng chưa được xác minh.',
    ],
    stats:[{k:'Email',v:'Direct'},{k:'Kết nối',v:'LinkedIn'},{k:'Dự án',v:'GitHub'}],
    items:[
      {name:'Email · LÊ QUỐC KHÁNH',meta:'CONTACT / CV',desc:'mencan308@gmail.com',url:'mailto:mencan308@gmail.com',evidence:'cv',kind:'contact'},
      {name:'LinkedIn · Quoc Khanh Le',meta:'PROFILE / CV',desc:'Hồ sơ LinkedIn được ghi trong CV của chủ sở hữu.',url:'https://www.linkedin.com/in/quockhanh-le/',evidence:'cv',kind:'contact'},
      {name:'GitHub · Khanh-glitch',meta:'OPEN SOURCE PROFILE',desc:'Các mã nguồn và dự án có quyền truy cập công khai.',url:'https://github.com/Khanh-glitch',evidence:'source',kind:'contact'},
    ],
    tags:['Work','Collaboration','Email','LinkedIn','GitHub'],accent:'#6aa8ff',
    action:{label:'LIÊN HỆ QUA EMAIL',url:'mailto:mencan308@gmail.com'},
  },
}
