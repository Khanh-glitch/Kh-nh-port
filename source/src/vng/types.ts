export type StudioTheme = 'studio-dark' | 'gallery-warm' | 'cyber-neon';

export type ProjectorSlideId = 0 | 1 | 2 | 3;

export interface ProjectorSlideInfo {
  id: ProjectorSlideId;
  title: string;
  subtitle: string;
  accentHex: string;
}

export const PROJECTOR_SLIDES: ProjectorSlideInfo[] = [
  { id: 0, title: 'VNGGames Prompt To Play 2026', subtitle: 'AI GAME JAM · bài dự thi cá nhân', accentHex: '#E65A26' },
  { id: 1, title: '24-Hour Puzzle RPG', subtitle: 'Prototype puzzle-RPG trong 24 giờ · theo CV', accentHex: '#F18D55' },
  { id: 2, title: 'Pathfinding & Puzzles', subtitle: 'Gameplay tìm đường & cơ chế giải đố đa dạng', accentHex: '#38BDF8' },
  { id: 3, title: 'Top 26 — per Résumé', subtitle: 'Kết quả theo CV · cần nguồn từ ban tổ chức', accentHex: '#A78BFA' },
];

export interface CameraPreset {
  id: string;
  label: string;
  shortLabel: string;
  position: [number, number, number];
  target: [number, number, number];
  description: string;
}

export interface SceneItemMeta {
  id: string;
  name: string;
  category: 'Hero' | 'Audio & Optics' | 'Workstation' | 'Gadgets' | 'Studio Props';
  description: string;
  specs: string[];
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
  highlightColor?: string;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'overview',
    label: 'Toàn Cảnh Studio',
    shortLabel: 'Overview',
    position: [7.6, 5.4, 9.2],
    target: [0, 1.05, 0],
    description: 'Góc nhìn tổng thể bàn studio với Logo VNG trung tâm, Máy trình chiếu 4K và toàn bộ bộ sưu tập đồ công nghệ.',
  },
  {
    id: 'vng-logo',
    label: 'Logo VNG (Hero)',
    shortLabel: 'VNG Logo',
    position: [0.3, 2.25, 3.65],
    target: [0, 1.35, -1.55],
    description: 'Tượng đài Logo VNG chế tác CNC theo vector chính thức (#E65A26) với lõi titan và viền phát sáng.',
  },
  {
    id: 'projector',
    label: 'Máy Trình Chiếu 4K',
    shortLabel: 'Projector',
    position: [-1.15, 1.95, 3.35],
    target: [-2.95, 0.45, 1.05],
    description: 'Máy chiếu Laser 4K với thấu kính đa lớp sapphire, vòng lấy nét khía CNC, khe tản nhiệt đồng và chùm tia chiếu thật.',
  },
  {
    id: 'screen',
    label: 'Màn Chiếu Laser',
    shortLabel: 'Screen',
    position: [0.55, 2.25, 3.15],
    target: [3.35, 1.48, -0.65],
    description: 'Màn chiếu khung kính cao cấp đón trọn luồng sáng laser từ máy chiếu.',
  },
  {
    id: 'workstation',
    label: 'Bàn Phím & Chuột Custom',
    shortLabel: 'Desk Setup',
    position: [1.65, 2.15, 4.35],
    target: [0.15, 0.25, 1.85],
    description: 'Bàn phím cơ nhôm custom 75%, chuột không dây, DAC âm thanh và ly sứ VNG.',
  },
  {
    id: 'gadgets',
    label: 'Turntable, Camera & Sách',
    shortLabel: 'Stuff Pile',
    position: [-1.95, 2.15, 4.1],
    target: [-4.15, 0.35, 0.95],
    description: 'Đĩa than Turntable, máy ảnh Rangefinder 35mm, sách VNG và chậu sen đá.',
  },
];
