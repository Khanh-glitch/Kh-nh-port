import pilotPhoto from '../assets/pilot.jpg';

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  TOÀN BỘ NỘI DUNG HỒ SƠ NẰM Ở FILE NÀY.
 *  Mọi số liệu, công ty, dự án, liên hệ bên dưới là DỮ LIỆU MẪU —
 *  hãy thay bằng thông tin thật của bạn. Ảnh: src/assets/pilot.jpg
 * ─────────────────────────────────────────────────────────────────────────
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
    vi: 'Xây dựng giao diện web nhanh, sắc nét và giàu tương tác.',
    en: 'I build fast, crisp, highly interactive web interfaces.',
  } as L10n,
  summary: {
    vi: 'Portfolio tương tác về thiết kế trải nghiệm, công cụ sáng tạo AI, sự kiện và game prototype.',
    en: 'Interactive portfolio featuring experience design, AI-assisted creative tools, events and game prototypes.',
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
      label: { vi: 'Học vấn', en: 'Education' },
      value: { vi: 'Đang cập nhật hồ sơ', en: 'Résumé details pending' },
    },
    {
      label: { vi: 'Ngôn ngữ', en: 'Languages' },
      value: { vi: 'Tiếng Việt', en: 'Vietnamese' },
    },
  ] as { label: L10n; value: L10n }[],

  experience: [
    {period:{vi:'PORTFOLIO',en:'PORTFOLIO'},role:'ORBITA',org:'Interactive 3D',note:{vi:'Thiết kế triển lãm dự án trong thế giới 3D.',en:'Interactive 3D project exhibition.'}},
    {period:{vi:'PROJECT',en:'PROJECT'},role:'Event Flow',org:'Creative tooling',note:{vi:'Thử nghiệm công cụ hỗ trợ quy trình sự kiện.',en:'Event workflow tooling experiment.'}},
    {period:{vi:'PROJECT',en:'PROJECT'},role:'Soul of Heroes',org:'Game prototyping',note:{vi:'Thử nghiệm game, hệ thống gameplay và VFX.',en:'Game systems and VFX prototype.'}},
  ] as { period: L10n; role: string; org: string; note: L10n }[],

  projects: [
    {name:'ORBITA',tag:'3D PORTFOLIO',metric:'LIVE',note:{vi:'Triển lãm dự án 3D · trình duyệt.',en:'Browser-based interactive 3D exhibition.'}},
    {name:'Soul of Heroes',tag:'GAME',metric:'PROTOTYPE',note:{vi:'Thiết kế gameplay, môi trường và hiệu ứng.',en:'Gameplay, environments and visual effects.'}},
    {name:'Event Flow',tag:'EVENT TECH',metric:'PROJECT',note:{vi:'Công cụ thử nghiệm cho quy trình sự kiện.',en:'Experimentation with event workflows.'}},
  ] as { name: string; tag: string; metric: string; note: L10n }[],

  stack: [
    {label:'AI',items:['AI-assisted building','Prompt workflows','Prototyping']},
    {label:'3D / FX',items:['Three.js','WebGL','GLSL']},
    {label:'Web',items:['React','TypeScript','HTML / CSS']},
    {label:'Creative',items:['Visual design','Interaction design','Game concepts']},
    {label:'Workflow',items:['GitHub','Iteration','Testing']},
  ],

  contact: {
    email: '',
    phone: '',
    linkedin: { label: 'LinkedIn · đang cập nhật', url: '' },
    github: { label: 'github.com/Khanh-glitch', url: 'https://github.com/Khanh-glitch' },
  },

  links: {
    /** Đường dẫn tới portfolio chi tiết. Nút "Vào portfolio" sẽ nhảy siêu không gian rồi mở link này. */
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
