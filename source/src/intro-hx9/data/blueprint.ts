export type SectionId = 'flight' | 'power' | 'life' | 'orbit' | 'comms' | 'log';

export interface CockpitSection {
  id: SectionId;
  index: string;
  code: string;
  label: string;
  labelVi: string;
  title: string;
  kicker: string;
  description: string;
  stats: { k: string; v: string; unit?: string }[];
  color: string;
  screen: {
    heading: string;
    sub: string;
    primary: string;
    unit: string;
    rows: { label: string; value: string; bar: number }[];
    readout: string;
  };
}

export const SECTIONS: CockpitSection[] = [
  {
    id: 'flight',
    index: '01',
    code: 'FLT',
    label: 'Flight',
    labelVi: 'Bay',
    title: 'Primary flight',
    kicker: 'Guidance / control law',
    description:
      'Triplex fly-by-wire command path with right-hand RHC attitude rate-command and left-hand 3-axis THC translation. Primary flight display sits on a 15° canted MIP inside the ±15° optimal sight cone.',
    stats: [
      { k: 'Velocity', v: '7 812', unit: 'm/s' },
      { k: 'Pitch', v: '+1.4', unit: '°' },
      { k: 'Bank', v: '−0.2', unit: '°' },
    ],
    color: '#7de6ff',
    screen: {
      heading: 'PRIMARY FLIGHT DISPLAY',
      sub: 'LANE A / RCAH NOMINAL',
      primary: '7 812',
      unit: 'M · S⁻¹',
      rows: [
        { label: 'ALTITUDE', value: '412.6 KM', bar: 0.62 },
        { label: 'VRT RATE', value: '+2.4 M/S', bar: 0.41 },
        { label: 'ATTITUDE', value: '+1.4 / −0.2°', bar: 0.5 },
        { label: 'LOAD FAC', value: '1.00 G', bar: 0.28 },
      ],
      readout: 'GUIDANCE · VECTOR 7B · LVLH CORRIDOR NOMINAL',
    },
  },
  {
    id: 'power',
    index: '02',
    code: 'PWR',
    label: 'Power',
    labelVi: 'Nguồn',
    title: 'Power architecture',
    kicker: 'Generation / distribution',
    description:
      'Dual redundant 540 V DC primary buses fed through solid-state power controllers and thermal pull-breakers on the overhead bridge. Cross-tie remains mechanically guarded until armed.',
    stats: [
      { k: 'Bus A', v: '98.2', unit: '%' },
      { k: 'Bus B', v: '96.7', unit: '%' },
      { k: 'Reserve', v: '31.4', unit: 'kWh' },
    ],
    color: '#ffc16b',
    screen: {
      heading: 'ELECTRICAL POWER',
      sub: 'BUS A / BUS B ISOLATED',
      primary: '184.6',
      unit: 'KWE · TOTAL',
      rows: [
        { label: 'GEN LOOP A', value: '96.4 %', bar: 0.96 },
        { label: 'GEN LOOP B', value: '93.1 %', bar: 0.93 },
        { label: 'LI-RESERVE', value: '31.4 KWH', bar: 0.68 },
        { label: 'RADIATOR', value: '284 K', bar: 0.44 },
      ],
      readout: 'CROSS-TIE SAFED · SSPC NOMINAL · 0 FAULTS',
    },
  },
  {
    id: 'life',
    index: '03',
    code: 'LSS',
    label: 'Life',
    labelVi: 'Sự sống',
    title: 'Life support',
    kicker: 'Atmosphere / suit loop',
    description:
      'Dual-bed amine CO₂ swing scrubber and suit umbilical manifold maintain a 101.3 kPa N₂/O₂ cabin atmosphere, with direct quick-disconnect suit demand supply on the port console.',
    stats: [
      { k: 'Cabin', v: '101.3', unit: 'kPa' },
      { k: 'O₂', v: '20.9', unit: '%' },
      { k: 'ΔT', v: '21.4', unit: '°C' },
    ],
    color: '#8ff0c3',
    screen: {
      heading: 'ENVIRONMENTAL CONTROL',
      sub: 'CABIN + SUIT LOOP A',
      primary: '101.3',
      unit: 'KPA · CABIN',
      rows: [
        { label: 'O₂ PART', value: '20.9 %', bar: 0.84 },
        { label: 'PP CO₂', value: '0.31 KPA', bar: 0.22 },
        { label: 'HUMIDITY', value: '42 %', bar: 0.42 },
        { label: 'SUIT FLOW', value: '12.4 L/M', bar: 0.64 },
      ],
      readout: 'AMINE BED B ACTIVE · UMBILICAL LOCKED · NO ALARMS',
    },
  },
  {
    id: 'orbit',
    index: '04',
    code: 'ORB',
    label: 'Orbit',
    labelVi: 'Quỹ đạo',
    title: 'Orbital track',
    kicker: 'Navigation / rendezvous',
    description:
      'Co-elliptic phasing trajectory toward Docking Shell 09 resolved from dual optical star trackers and relative LIDAR, with translational trim executed on the port-side 3-axis THC.',
    stats: [
      { k: 'Altitude', v: '412.6', unit: 'km' },
      { k: 'Inclination', v: '51.6', unit: '°' },
      { k: 'Range', v: '2 418', unit: 'm' },
    ],
    color: '#b9a8ff',
    screen: {
      heading: 'ORBITAL NAVIGATION',
      sub: 'STAR TRACKER / LIDAR LOCK',
      primary: '412.6',
      unit: 'KM · ALTITUDE',
      rows: [
        { label: 'INCLIN', value: '51.64 °', bar: 0.51 },
        { label: 'APOGEE', value: '413.4 KM', bar: 0.62 },
        { label: 'CLOSURE', value: '+2.4 M/S', bar: 0.33 },
        { label: 'REM ΔV', value: '118.2 M/S', bar: 0.74 },
      ],
      readout: 'BURN 02 · T−00:14:22 · APPROACH CORRIDOR GREEN',
    },
  },
  {
    id: 'comms',
    index: '05',
    code: 'COM',
    label: 'Comms',
    labelVi: 'Liên lạc',
    title: 'Comms & telemetry',
    kicker: 'Optical / Ka-band link',
    description:
      'Coherent optical crosslink paired with Ka-band phased-array fallback. Command frames are cryptographically authenticated across physically segregated port and starboard harness runs.',
    stats: [
      { k: 'Optical', v: '2.4', unit: 'Gb/s' },
      { k: 'Latency', v: '38', unit: 'ms' },
      { k: 'Packet', v: '0', unit: 'loss' },
    ],
    color: '#87d0ff',
    screen: {
      heading: 'COMMUNICATIONS',
      sub: 'OPTICAL A / KA-BAND STBY',
      primary: '2.4',
      unit: 'GBPS · DOWNLINK',
      rows: [
        { label: 'OPTICAL A', value: '99.9 %', bar: 0.99 },
        { label: 'KA-BAND B', value: 'STANDBY', bar: 0.32 },
        { label: 'LATENCY', value: '38 MS', bar: 0.38 },
        { label: 'RECORDER', value: '18 % USED', bar: 0.18 },
      ],
      readout: 'FRAME AUTH OK · 0 LOST PACKETS · TELEMETRY LOCKED',
    },
  },
  {
    id: 'log',
    index: '06',
    code: 'LOG',
    label: 'Log',
    labelVi: 'Nhật ký',
    title: 'Mission log',
    kicker: 'Events / configuration',
    description:
      'Every mechanical latch state, breaker position, bus tie transition and RCS burn command is time-stamped at source into the radiation-hardened flight data recorder.',
    stats: [
      { k: 'Entries', v: '1 248', unit: '' },
      { k: 'Uptime', v: '219', unit: 'd' },
      { k: 'Faults', v: '00', unit: 'open' },
    ],
    color: '#ffd3a0',
    screen: {
      heading: 'SHIPBOARD LOG',
      sub: 'FDR ARCHIVE 118 / LIVE',
      primary: 'T−00:14',
      unit: 'TO NEXT MANOEUVRE',
      rows: [
        { label: '09:42', value: 'CANOPY HOOKS 1–4 LOCKED', bar: 0.96 },
        { label: '09:38', value: 'BUS A/B CROSS-TIE SAFED', bar: 0.72 },
        { label: '09:21', value: 'SUIT O₂ QD / VERIFIED', bar: 0.54 },
        { label: '08:57', value: 'STAR TRACKER A+B / LOCK', bar: 0.42 },
      ],
      readout: 'FDR INTEGRITY OK · CRC-32 PASSED · 0 WRITE ERRORS',
    },
  },
];

export type ViewId = 'pilot' | 'command' | 'overhead' | 'detail';

export interface StudyView {
  id: ViewId;
  index: string;
  label: string;
  caption: string;
  fov: number;
  position: [number, number, number];
  target: [number, number, number];
}

export const STUDY_VIEWS: StudyView[] = [
  {
    id: 'pilot',
    index: 'A',
    label: 'Design eye',
    caption: 'DEP · 1.08 m over deck · 17° nose sight',
    fov: 62,
    position: [0, 0.135, 0.42],
    target: [0, -0.085, -0.72],
  },
  {
    id: 'command',
    index: 'B',
    label: 'Command reach',
    caption: 'RHC · THC · throttle arc ≤ 640 mm',
    fov: 56,
    position: [0.43, 0.15, 0.44],
    target: [-0.08, -0.22, -0.56],
  },
  {
    id: 'overhead',
    index: 'C',
    label: 'Overhead',
    caption: 'Spaceframe, monocoque seat & pedestal',
    fov: 62,
    position: [0.50, 0.49, 0.65],
    target: [-0.04, -0.32, -0.34],
  },
  {
    id: 'detail',
    index: 'D',
    label: 'Console macro',
    caption: 'Bezels, U-guards & milled alloy at 260 mm',
    fov: 42,
    position: [0.15, -0.05, -0.13],
    target: [-0.36, -0.21, -0.64],
  },
];

export interface DossierPanel {
  id: string;
  label: string;
  heading: string;
  body: string;
  points: { title: string; detail: string }[];
}

export const DOSSIER: DossierPanel[] = [
  {
    id: 'geometry',
    label: '01 / Geometry',
    heading: 'Load paths, sections & assembly',
    body:
      'Every component is generated from structural cross-sections rather than stacked box primitives: rotation-minimizing-frame (RMF) C- and I-beams, thick-shell pressure skins, pocketed CNC bezels with negative bevel compensation, and multi-station composite lofts.',
    points: [
      {
        title: 'Closed canopy spaceframe & window forgings',
        detail:
          'Swept 7075-T6 A-pillars, header bow, B-pillar arch and twin crown longerons meet at bolted gussets. Multi-pane windows sit inside 42 mm stepped frames with compressed EPDM bulb seals and over-center hook latches.',
      },
      {
        title: 'Optical glareshield & 3-segment wrap MIP',
        detail:
          'Per MIL-STD-1472H wrap-around console criteria, outboard MFD wings cant 24° inward while the central PFD tilts 15° toward the Design Eye Point under a 155 mm deep anti-glare optical baffle.',
      },
      {
        title: 'Kinematics & mechanical sub-assemblies',
        detail:
          'Slotted dual-lever throttle quadrant, spoked pitch trim wheel, parallelogram rudder/toe-brake linkage, left 3-axis rectilinear THC, right sculpted pistol-grip RHC, and a 9-station CFRP seat on hydraulic shock struts.',
      },
    ],
  },
  {
    id: 'human',
    label: '02 / Human',
    heading: 'Calibrated to one seated pilot',
    body:
      'All station coordinates are referenced to a single seated operator datum (SRP at z = +0.34 m, Design Eye Point 1.075 m above deck). Controls, displays, pedals and overhead breakers simultaneously satisfy seated reach and sight-line cones.',
    points: [
      {
        title: 'Design Eye Point & sight-lines',
        detail:
          'Primary flight display sits ~760 mm from the forward eye-box at −14.5° sight depression (NASA/TM-2014-218659), while the glareshield brow preserves a 17° downward over-the-nose sight-line (FAR 25.773).',
      },
      {
        title: 'Inceptors & high-G forearm support',
        detail:
          'Following NASA Orion entry handling studies (NTRS 20110013203 & 20220014186), the starboard RHC is paired with an X-axis forearm rest; the port 3-axis THC and center throttles lie inside the 640 mm functional reach envelope.',
      },
      {
        title: 'Leg kinematics & overhead reach',
        detail:
          'Rudder/brake pedals sit at 1.01 m functional leg distance from SRP (MIL-STD-1472G Table B-VI). The overhead breaker/bus bridge sits 1.16 m above SRP, within 5th-percentile seated gripping reach.',
      },
    ],
  },
  {
    id: 'materials',
    label: '03 / Materials',
    heading: 'Manufacturing marks, not uniform gloss',
    body:
      'Each material reflects how its real aerospace counterpart is made: cycloidal CNC face-mill toolpaths, isotropic sand/bead-blasted castings, dielectric powder-coated panel paint, 2×2 twill CFRP under epoxy clearcoat, and woven ripstop/herringbone textiles.',
    points: [
      {
        title: 'Milled, cast, anodized & painted alloys',
        detail:
          '7075-T6 machined fittings carry subtle trochoidal mill marks and crisp 39° creased chamfers; cast window rings and stirrups carry isotropic granular stipple; fascia panels carry satin polyurethane orange-peel.',
      },
      {
        title: 'Autoclave CFRP & Ti-6Al-4V hardware',
        detail:
          'Tangent-space 2×2 twill normal maps resolve individual warp/weft carbon tows on the seat monocoque and pedestal shell, isolated from aluminium tracks by bead-blasted titanium trusses.',
      },
      {
        title: 'Elastomers, optical glass & textiles',
        detail:
          'Compressed 60-Shore-A silicone bulb seals, beveled fused-silica glass edges, Nomex ripstop upholstery with cloth sheen, and MIL-W-4088 herringbone 5-point harness webbing remain distinct at 250 mm macro inspection.',
      },
    ],
  },
  {
    id: 'validation',
    label: '04 / Method',
    heading: 'Independent grey-clay & PBR verification',
    body:
      'Geometry was audited first in untextured neutral grey clay across six interior cameras (design eye, oblique reach, overhead, macro console, seat/aft bulkhead and footwell linkage) to eliminate primitive slabs, floating parts and collisions before material shading.',
    points: [
      {
        title: 'Grey silhouette & section audit',
        detail:
          'Stripping all textures, emissives and space backdrops verifies that structural flanges, recessed bezels, switch guards, harness hardware and pedal linkages read purely through 3D form.',
      },
      {
        title: 'Technical standards & heritage surveyed',
        detail:
          'Informed by MIL-STD-1472G/H, NASA-STD-3001 Vol. 2, NASA NTRS Orion/Shuttle RHC-THC & HUD studies, and mechanical layouts of Crew Dragon, Soyuz Kazbek, Boeing 737NG and A-10C.',
      },
      {
        title: 'Engineering study scope',
        detail:
          'Interactive procedural 3D industrial design study. Dimensions combine published human-factors standards with design synthesis; not flight-certified CAD or structural FEA.',
      },
    ],
  },
];

export const SOURCES = [
  { n: '01', label: 'MIL-STD-1472G/H · Human Engineering Design Criteria (Seated Consoles, Reach & Controls)', meta: 'US DoD' },
  { n: '02', label: 'NASA-STD-3001 Vol. 2 & NTRS 20110013203 / 20220014186 · Orion RHC/THC & Entry Crew Station', meta: 'NASA NTRS' },
  { n: '03', label: 'NASA/TM-2014-218659 & TP-2000-210284 · Primary Display Cone (15°) & Glareshield Sightline (17°)', meta: 'NASA Langley' },
  { n: '04', label: 'SpaceX Crew Dragon & Soyuz MS ("Kazbek" Seat, Pressure Hatch & Umbilical Architecture)', meta: 'Spaceflight reference' },
  { n: '05', label: 'Boeing 737NG Flight Deck · P7 Glareshield, MCP, Angled CDU & Slotted Control Stand', meta: 'Transport reference' },
  { n: '06', label: 'A-10C / ACES II Cockpit · Hinged Switch Guarding, Recessed MFD Bezels & Rudder Linkage', meta: 'Tactical reference' },
];

export const VIEW_COPY: Record<ViewId, { title: string; body: string }> = {
  pilot: {
    title: 'Design eye',
    body: 'Seated DEP datum: 15° canted MIP, 24° wrap-around MFDs, 155 mm optical glareshield and open upper canopy.',
  },
  command: {
    title: 'Command reach',
    body: 'Starboard RHC with forearm support, port 3-axis THC and slotted dual-throttle pedestal inside seated reach.',
  },
  overhead: {
    title: 'Overhead study',
    body: 'Closed 7075-T6 canopy spaceframe, 9-station CFRP seat monocoque, shock struts and tapered control stand.',
  },
  detail: {
    title: 'Console macro',
    body: 'Hollow CNC bezels, tactile OSB keys, hinged U-channel guards and cycloidal mill toolpaths at 260 mm.',
  },
};
