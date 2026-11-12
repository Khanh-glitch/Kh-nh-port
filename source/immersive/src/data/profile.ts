import pilotPhoto from '../assets/pilot.jpg';

/**
 * Hồ sơ dự án của LÊ QUỐC KHÁNH. Chỉ dùng tên, sản phẩm và nguồn
 * đã được xác minh. Ảnh phi công là ảnh AI minh họa.
 * Không đặt công ty, bằng cấp, giải thưởng, số năm hay email giả.
 */

export type Lang = 'vi' | 'en';
export type L10n = Record<Lang, string>;

export const profile = {
  name: 'LÊ QUỐC KHÁNH',
  callsign: 'LQK-01',
  photo: pilotPhoto,
  timezone: 'Asia/Ho_Chi_Minh',

  title: { vi: 'AI creative builder · Thiết kế trải nghiệm', en: 'AI creative builder · Experience design' } as L10n,
  focus: ['Vibe coding', 'Interactive 3D', 'Creative AI'],
  availability: { vi: 'Sẵn sàng nhận việc', en: 'Open to work' } as L10n,

  headline: {
    vi: 'Biến ý tưởng thành game prototype, công cụ web và trải nghiệm 3D có thể kiểm chứng.',
    en: 'Building testable game prototypes, web tools and interactive 3D experiences with AI.',
  } as L10n,
  summary: {
    vi: 'Tôi là một vibecoder: tập trung vào ý tưởng, thiết kế luồng sản phẩm, điều phối AI và thử nghiệm thực tế. Khám phá ORBITA, EventFlow Pro, APEX CHAOS và Soul of Hero.',
    en: 'I am an AI-assisted builder focused on product thinking, orchestration, iteration and real tests. Explore ORBITA, EventFlow Pro, APEX CHAOS and Soul of Hero.',
  } as L10n,

  stats: [
    { value: '3D', label: { vi: 'Không gian tương tác', en: 'Interactive worlds' } },
    { value: 'AI', label: { vi: 'Công cụ sáng tạo', en: 'Creative tools' } },
    { value: 'GAME', label: { vi: 'Prototype game', en: 'Game prototyping' } },
    { value: 'EVENT', label: { vi: 'Trải nghiệm sự kiện', en: 'Event experiences' } },
  ] as { value: string; label: L10n }[],

  facts: [
    {
      label: { vi: 'Địa điểm', en: 'Location' },
      value: { vi: 'Việt Nam · UTC+7', en: 'Vietnam · UTC+7' },
    },
    {
      label: { vi: 'Hình thức', en: 'Work mode' },
      value: { vi: 'Remote · Hybrid · Onsite', en: 'Remote · Hybrid · Onsite' },
    },
    {
      label: { vi: 'Phương pháp', en: 'Approach' },
      value: { vi: 'Vibecoding · kiểm thử theo bằng chứng', en: 'AI-assisted · evidence-driven testing' },
    },
    {
      label: { vi: 'Ngôn ngữ', en: 'Languages' },
      value: { vi: 'Tiếng Việt', en: 'Vietnamese' },
    },
  ] as { label: L10n; value: L10n }[],

  // Project work, not unverified employment history.
  experience: [
    {period:{vi:'DỰ ÁN',en:'PROJECT'},role:'ORBITA',org:'Interactive portfolio',note:{vi:'Thiết kế hệ thống dẫn đường trong không gian 3D và khởi động bằng phi thuyền.',en:'A 3D navigable experience with a spaceship-first entry.'}},
    {period:{vi:'DỰ ÁN',en:'PROJECT'},role:'EventFlow Pro',org:'Event operations tooling',note:{vi:'Demo quy trình brief, nhu cầu sản xuất, BOQ, báo giá và proposal; chưa triển khai production.',en:'Brief-to-production demo, BOQ, quotes and proposal workflow; not production-ready.'}},
    {period:{vi:'DỰ ÁN',en:'PROJECT'},role:'APEX CHAOS',org:'Browser game',note:{vi:'Game đấu trường trình duyệt với engine và tài sản game riêng.',en:'A browser arena game with dedicated gameplay runtime and assets.'}},
    {period:{vi:'DỰ ÁN',en:'PROJECT'},role:'Soul of Hero',org:'Pixel survival RPG',note:{vi:'Game sinh tồn đang phát triển, tập trung vào gameplay và VFX.',en:'In-development pixel survival game systems and VFX.'}},
  ] as { period: L10n; role: string; org: string; note: L10n }[],

  projects: [
    {name:'ORBITA',tag:'3D PORTFOLIO',metric:'INTERACTIVE',note:{vi:'Phi thuyền và đảo 3D trưng bày dự án có thể tương tác.',en:'Interactive spaceship-and-island 3D project exhibition.'}},
    {name:'EventFlow Pro',tag:'EVENT TECH',metric:'DEMO',note:{vi:'Workspace browser-local đã kiểm thử, chưa production-ready.',en:'Tested browser-local workspace demo; not production-ready.'}},
    {name:'APEX CHAOS',tag:'BROWSER GAME',metric:'GAME',note:{vi:'Game đấu trường có mã nguồn và engine riêng.',en:'Arena game with published source and runtime.'}},
    {name:'MathPath',tag:'LEARNING WEB',metric:'PROJECT',note:{vi:'Ứng dụng học Toán với Living Board và tiến trình học.',en:'Math learning workspace with Living Board and progress.'}},
    {name:'Soul of Hero',tag:'SURVIVAL GAME',metric:'DEVELOPMENT',note:{vi:'Game pixel survival RPG đang phát triển.',en:'In-development pixel survival RPG.'}},
  ] as { name: string; tag: string; metric: string; note: L10n }[],

  stack: [
    {label:'AI',items:['AI-assisted building','Prompt workflows','Prototyping']},
    {label:'3D / FX',items:['Three.js','WebGL','GLSL']},
    {label:'Web',items:['React','TypeScript','HTML / CSS']},
    {label:'Creative',items:['Experience design','Audio/visual concepts','Game design']},
    {label:'Workflow',items:['GitHub','Iteration','Testing']},
  ],

  contact: {
    email: '',
    phone: '',
    linkedin: { label: '', url: '' },
    github: { label: 'github.com/Khanh-glitch', url: 'https://github.com/Khanh-glitch' },
  },

  links: {
    /** The in-page CTA jumps into the embedded 3D island; no external link needed. */
    portfolio: '',
    /** Đường dẫn file CV (PDF). Để trống thì nút thứ hai sẽ là "Liên hệ" (mailto). */
    cv: '',
  },
};

export const ui = {
  pilot: { vi: 'Phi công', en: 'Pilot' },
  pilotId: { vi: 'Hồ sơ', en: 'Pilot ID' },
  verified: { vi: 'Ảnh minh họa', en: 'Illustrative portrait' },
  photoAlt: { vi: 'Ảnh AI minh họa phi công', en: 'Illustrative AI pilot portrait' },
  overview: { vi: 'Tổng quan', en: 'Overview' },
  facts: { vi: 'Thông tin nhanh', en: 'Quick facts' },
  experience: { vi: 'Hành trình dự án', en: 'Project journey' },
  projects: { vi: 'Dự án tiêu biểu', en: 'Featured projects' },
  stack: { vi: 'Công nghệ', en: 'Tech stack' },
  contact: { vi: 'Liên hệ', en: 'Contact' },
  enter: { vi: 'Vào portfolio', en: 'Enter portfolio' },
  jumping: { vi: 'Đang nhảy…', en: 'Jumping…' },
  cv: { vi: 'Tải CV', en: 'Download CV' },
  reach: { vi: 'Liên hệ', en: 'Contact' },
  copy: { vi: 'Sao chép', en: 'Copy' },
  copied: { vi: 'Đã chép', en: 'Copied' },
  throttle: { vi: 'Ga', en: 'Thr' },
  throttleLong: { vi: 'Cần ga', en: 'Throttle' },
  boost: { vi: 'Tăng tốc', en: 'Boost' },
  hints: {
    vi: 'Chuột: lái · W/S: ga · Space: tăng tốc',
    en: 'Mouse: steer · W/S: throttle · Space: boost',
  },
  destination: { vi: 'Đích đến', en: 'Destination' },
  heading: { vi: 'Hướng', en: 'HDG' },
  localTime: { vi: 'Giờ địa phương', en: 'Local time' },
  language: { vi: 'Ngôn ngữ', en: 'Language' },
  velocity: { vi: 'Vận tốc', en: 'Velocity' },
  radar: { vi: 'Radar', en: 'Radar' },
  noticeTitle: { vi: 'Chưa thiết lập đích đến', en: 'Destination not set' },
  noticeBody: {
    vi: 'Thêm đường dẫn portfolio vào links.portfolio trong src/data/profile.ts để hoàn tất bước nhảy.',
    en: 'Add your portfolio URL to links.portfolio in src/data/profile.ts to complete the jump.',
  },
  dismiss: { vi: 'Đóng', en: 'Dismiss' },
  responds: { vi: 'Liên hệ đang cập nhật', en: 'Contact details pending' },
  bootTitle: { vi: 'Khởi động hệ thống', en: 'System start-up' },
  bootEngines: { vi: 'Động cơ', en: 'Engines' },
  bootNav: { vi: 'Định vị', en: 'Navigation' },
  bootPilot: { vi: 'Xác thực phi công', en: 'Pilot auth' },
  skip: { vi: 'Bỏ qua', en: 'Skip' },
} satisfies Record<string, L10n>;
