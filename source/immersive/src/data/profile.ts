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

  title: { vi: 'Kỹ sư Frontend', en: 'Frontend Engineer' } as L10n,
  focus: ['React', 'TypeScript', 'WebGL'],
  availability: { vi: 'Sẵn sàng nhận việc', en: 'Open to work' } as L10n,

  headline: {
    vi: 'Xây dựng giao diện web nhanh, sắc nét và giàu tương tác.',
    en: 'I build fast, crisp, highly interactive web interfaces.',
  } as L10n,
  summary: {
    vi: 'Hơn 4 năm phát triển sản phẩm web với React, TypeScript và WebGL — chú trọng hiệu năng, trải nghiệm và chất lượng mã.',
    en: '4+ years shipping web products with React, TypeScript and WebGL — focused on performance, UX and code quality.',
  } as L10n,

  stats: [
    { value: '4+', label: { vi: 'Năm kinh nghiệm', en: 'Years experience' } },
    { value: '20+', label: { vi: 'Dự án triển khai', en: 'Projects shipped' } },
    { value: '5', label: { vi: 'Kỹ sư dẫn dắt', en: 'Engineers led' } },
    { value: '98', label: { vi: 'Điểm Lighthouse', en: 'Lighthouse avg.' } },
  ] as { value: string; label: L10n }[],

  facts: [
    {
      label: { vi: 'Địa điểm', en: 'Location' },
      value: { vi: 'TP. Hồ Chí Minh · UTC+7', en: 'Ho Chi Minh City · UTC+7' },
    },
    {
      label: { vi: 'Hình thức', en: 'Work mode' },
      value: { vi: 'Remote · Hybrid · Onsite', en: 'Remote · Hybrid · Onsite' },
    },
    {
      label: { vi: 'Học vấn', en: 'Education' },
      value: { vi: 'Cử nhân CNTT · 2020', en: 'B.Sc. in IT · 2020' },
    },
    {
      label: { vi: 'Ngôn ngữ', en: 'Languages' },
      value: { vi: 'Tiếng Việt · English', en: 'Vietnamese · English' },
    },
  ] as { label: L10n; value: L10n }[],

  experience: [
    {
      period: { vi: '2023 — nay', en: '2023 — now' },
      role: 'Senior Frontend Engineer',
      org: 'Nova Labs',
      note: {
        vi: 'Dẫn dắt nhóm 5 kỹ sư, xây dựng design system; giảm 40% thời gian tải trang.',
        en: 'Lead a team of 5 and built the design system; cut page load time by 40%.',
      },
    },
    {
      period: { vi: '2021 — 2023', en: '2021 — 2023' },
      role: 'Frontend Developer',
      org: 'Orbit Studio',
      note: {
        vi: 'Phát triển 12+ web app và landing page tương tác cho khách hàng quốc tế.',
        en: 'Shipped 12+ interactive web apps and landing pages for global clients.',
      },
    },
    {
      period: { vi: '2020 — 2021', en: '2020 — 2021' },
      role: 'Web Developer',
      org: 'Freelance',
      note: {
        vi: 'Thiết kế và lập trình website trọn gói cho doanh nghiệp vừa và nhỏ.',
        en: 'Designed and built end-to-end websites for small and mid-size businesses.',
      },
    },
  ] as { period: L10n; role: string; org: string; note: L10n }[],

  projects: [
    {
      name: 'Aurora Analytics',
      tag: 'SaaS',
      metric: '−40% TTI',
      note: {
        vi: 'Dashboard dữ liệu thời gian thực · React, D3',
        en: 'Real-time data dashboard · React, D3',
      },
    },
    {
      name: 'Stellar Commerce',
      tag: 'E-commerce',
      metric: '+27% CVR',
      note: {
        vi: 'Storefront headless, tối ưu Core Web Vitals · Next.js',
        en: 'Headless storefront, Core Web Vitals tuned · Next.js',
      },
    },
    {
      name: 'Nebula Showroom',
      tag: 'WebGL',
      metric: '60 FPS',
      note: {
        vi: 'Trưng bày sản phẩm 3D trên trình duyệt · Three.js',
        en: '3D product showroom in the browser · Three.js',
      },
    },
  ] as { name: string; tag: string; metric: string; note: L10n }[],

  stack: [
    { label: 'UI', items: ['React', 'TypeScript', 'Next.js'] },
    { label: 'Style', items: ['Tailwind CSS', 'Sass', 'Figma'] },
    { label: '3D / FX', items: ['Three.js', 'GLSL', 'GSAP'] },
    { label: 'Backend', items: ['Node.js', 'GraphQL', 'PostgreSQL'] },
    { label: 'Tools', items: ['Git', 'CI/CD', 'Vitest', 'Docker'] },
  ],

  contact: {
    email: 'khanh@example.com',
    phone: '+84 900 000 000',
    linkedin: { label: 'linkedin.com/in/username', url: 'https://www.linkedin.com/' },
    github: { label: 'github.com/username', url: 'https://github.com/' },
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
  verified: { vi: 'Đã xác thực', en: 'Verified' },
  photoAlt: { vi: 'Ảnh chân dung Lê Quốc Khánh', en: 'Portrait of Le Quoc Khanh' },
  overview: { vi: 'Tổng quan', en: 'Overview' },
  facts: { vi: 'Thông tin nhanh', en: 'Quick facts' },
  experience: { vi: 'Kinh nghiệm', en: 'Experience' },
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
  responds: { vi: 'Phản hồi trong 24 giờ', en: 'Replies within 24 hours' },
  bootTitle: { vi: 'Khởi động hệ thống', en: 'System start-up' },
  bootEngines: { vi: 'Động cơ', en: 'Engines' },
  bootNav: { vi: 'Định vị', en: 'Navigation' },
  bootPilot: { vi: 'Xác thực phi công', en: 'Pilot auth' },
  skip: { vi: 'Bỏ qua', en: 'Skip' },
} satisfies Record<string, L10n>;
