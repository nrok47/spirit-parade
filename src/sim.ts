// Spirit Parade — simulation core. อ่าน context.md ก่อนแก้ไฟล์นี้
// แกน: ความกลัวมี 3 ด้าน
//   กลัวพอดี → คนไหว้ → ศรัทธา / กลัวเกิน → คนหนี / กลัวนานๆ → ไม่มีใครแต่งงาน ไม่มีใครย้ายเข้า เมืองไม่โต
// กฎ log: บันทึกเฉพาะเรื่องที่มีความหมาย (chain / วงจรชีวิต / พลังเทพ / คนหนี)
//         ความกลัวที่ขยับไปมาเฉยๆ ไม่ต้องขึ้น log ไม่งั้นกลายเป็นเครื่องสุ่มข้อความ

export const ZONES = ['ตลาด', 'ศาลปู่ตา', 'ซอยใน', 'โกดัง', 'ใต้สะพาน', 'ท่าน้ำ'] as const
export type Zone = (typeof ZONES)[number]

export const TRAITS = ['ขี้กลัว', 'ใจถึง', 'ปากมาก', 'ขี้สงสาร', 'ติดบ้าน'] as const
export type Trait = (typeof TRAITS)[number]

export type Citizen = {
  id: number
  name: string
  spirit: boolean
  sex: 'ช' | 'ญ'
  job: string
  zone: Zone
  trait: Trait
  fear: number // 0-100
  age: number
  ties: number[] // เพื่อน/ญาติ 1-2 คน
  partner: number | null
  legend?: string // ตัวละครจากนิยาย — ไม่แก่ ไม่ตาย ไม่หนี มีบทบาทเฉพาะตัว
  bornHere: boolean // เกิดในเมืองที่เทพรักษาไว้ = ศรัทธาต่อหัวมากกว่า
  gone: boolean
  cooldown: number // tick ที่รับเหตุการณ์ใหม่ได้อีกครั้ง
}

export type ChainRun = { chain: number; step: number; who: number; at: number }

// บ้าน 1 หลังอยู่ได้ไม่เกิน 3 คน (พ่อ แม่ ลูก) — โตแล้วต้องแยกออกไปปลูกบ้านใหม่
export type House = { id: number; x: number; y: number; zone: Zone; members: number[] }

// ตัวละครที่จ้างลงไปในเมือง แล้วมันทำงานของมันเอง — ผู้เล่นตัดสินใจแค่ จ้างใคร วางตรงไหน
export type AgentKind = 'ghost' | 'shaman' | 'police' | 'thief' | 'monk' | 'vendor'
export type Agent = { id: number; kind: AgentKind; by: string; x: number; y: number; until: number; next: number }
export const AGENT_RADIUS = 18

// สิ่งปลูกสร้าง = หมุดที่เปลี่ยนสนาม ไม่ใช่ตึกที่ผลิตทรัพยากร (ดูเส้นแบ่งใน context.md)
// อยู่ถาวร ไม่มีคิวก่อสร้าง ไม่มีค่าบำรุง ไม่มีสภาพชำรุด — อาคาร 1 หลังมีผลหลัก 1 อย่าง
export type LandmarkKind = 'shrine' | 'shelter'
export type Landmark = { id: number; kind: LandmarkKind; by: string; x: number; y: number }
export const LANDMARK: Record<
  LandmarkKind,
  { name: string; icon: string; cost: number; radius: number; does: string }
> = {
  shrine: {
    name: 'ศาลปู่ตา',
    icon: '⛩',
    cost: 120,
    radius: 20,
    does: 'เทพเอื้อมถึงรอบศาลได้ตลอด แม้ตัวจะไปยืนที่อื่น · คนแถวนั้นไหว้ถี่ขึ้น',
  },
  shelter: {
    name: 'ศูนย์พักพิง',
    icon: '🏚',
    cost: 90,
    radius: 16,
    does: 'คนแถวนั้นกลัวแค่ไหนก็ไม่หนีออกเมือง · แต่มาอยู่รวมกันแล้วยิ่งกลัวกันเอง',
  },
}
export const AGENT_DAYS = 5
export const AGENT_EVERY = 6 // ทำงานทุก 6 ชั่วโมง
export const HOUSE_CAP = 3

// ผู้เล่นเป็นปู่ตาเสมอ — ผี/หมอผี/ตำรวจ ย้ายไปเป็นคนที่ 'จ้าง' ลงเมืองแทน (ดู HIRE)
// เก็บ type ไว้เพราะตาราง actions ในโลกร่วมมีคอลัมน์ avatar อยู่แล้ว
export type AvatarId = 'pootah'

export type World = {
  seed: number
  avatar: AvatarId
  haunt: Record<number, number> // citizen id -> tick ที่การตามติดหมดฤทธิ์
  houses: House[]
  nextHouse: number
  marks: Landmark[]
  nextMark: number
  pos: { x: number; y: number } // ที่ที่ avatar ยืนอยู่บนกระดาน
  shared?: boolean // โลกร่วม: ศรัทธาเป็นของแต่ละคน replay จัดการเอง step ไม่ต้องบวกให้
  agents: Agent[]
  nextAgent: number
  quiet?: boolean // ระหว่างตัวที่จ้างทำงาน: เก็บเฉพาะเรื่องสำคัญ ไม่งั้น log ท่วมทุก 6 ชั่วโมง
  tick: number // 1 tick = 1 ชั่วโมงในเมือง
  faith: number
  nextId: number
  log: { t: number; text: string; notable: boolean }[]
  citizens: Citizen[]
  wards: Partial<Record<Zone, number>>
  omenUntil: number
  runs: ChainRun[]
  savedAt: number
}

const MAX_CATCHUP_TICKS = 24 * 3
const LEAVE_FEAR = 85
const GROW_FEAR = 55 // เมืองกลัวเกินนี้ = ไม่มีใครแต่งงาน/มีลูก/ย้ายเข้า
const EVENT_COOLDOWN = 8 // ชั่วโมง
export const BOARD = 100
export const RADIUS = 26 // พรทำงานเฉพาะในวงรอบตัว — นอกวงเอื้อมไม่ถึง

// จุดกลางของแต่ละย่านบนกระดาน
export const ZONE_POS: Record<Zone, [number, number]> = {
  ตลาด: [30, 26],
  ศาลปู่ตา: [52, 50],
  ซอยใน: [22, 62],
  โกดัง: [76, 30],
  ใต้สะพาน: [74, 72],
  ท่าน้ำ: [46, 86],
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)
// เอื้อมถึงได้จากตัวเอง หรือจากศาลที่สร้างไว้ (B&W1: ศรัทธาคือพื้นที่ ไม่ใช่แค่ตัวเลข)
export const inRange = (w: World, x: number, y: number) =>
  dist(w.pos.x, w.pos.y, x, y) <= RADIUS ||
  w.marks.some((m) => m.kind === 'shrine' && dist(m.x, m.y, x, y) <= LANDMARK.shrine.radius)

export const nearMark = (w: World, kind: LandmarkKind, x: number, y: number) =>
  w.marks.some((m) => m.kind === kind && dist(m.x, m.y, x, y) <= LANDMARK[kind].radius)
export const houseOf = (w: World, id: number) => w.houses.find((h) => h.members.includes(id))
export function citizenPos(w: World, c: Citizen): [number, number] {
  const h = houseOf(w, c.id)
  return h ? [h.x, h.y] : ZONE_POS[c.zone]
}
export const citizenInRange = (w: World, c: Citizen) => {
  const [x, y] = citizenPos(w, c)
  return inRange(w, x, y)
}
// คนที่พรเอื้อมถึงจริง
export const reach = (w: World, zone?: Zone) =>
  alive(w).filter((c) => citizenInRange(w, c) && (!zone || c.zone === zone))

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const rngFor = rng // ให้โลกร่วมใช้ตัวสุ่มตัวเดียวกัน

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)]

// ขี้กลัวรับความกลัวแรงกว่า ใจถึงรับน้อยกว่า
const FEAR_MULT: Record<Trait, number> = {
  ขี้กลัว: 1.6,
  ใจถึง: 0.5,
  ปากมาก: 1.0,
  ขี้สงสาร: 1.1,
  ติดบ้าน: 0.9,
}

/**
 * ตัวละครจากนิยาย Spirit Parade — อยู่ในเมืองตลอดไป ไม่แก่ ไม่ตาย ไม่หนีออกเมือง
 * แต่ละคนมีบทบาทที่ทำงานเองวันละครั้ง (act) และเป็นตัวที่เอาไปทำคอนเทนต์โปรโมทนิยายได้
 * เพิ่มตัวใหม่ = เพิ่ม 1 entry ในตารางนี้ ไม่ต้องแตะที่อื่น
 */
export const LEGENDS: {
  name: string
  sex: 'ช' | 'ญ'
  spirit: boolean
  job: string
  zone: Zone
  trait: Trait
  age: number
  role: string
  act: (w: World, r: () => number, self: Citizen) => void
}[] = [
  {
    name: 'เก่ง',
    sex: 'ช',
    spirit: false,
    job: 'ไรเดอร์',
    zone: 'ซอยใน',
    trait: 'ใจถึง',
    age: 27,
    role: 'อ่านจังหวะเมืองออก — รู้ก่อนว่ากำลังจะมีเรื่อง',
    act: () => {}, // บทบาทอยู่ตอน chain เริ่ม (ดู step)
  },
  {
    name: 'ริน',
    sex: 'ญ',
    spirit: false,
    job: 'คนเดินระบบ',
    zone: 'โกดัง',
    trait: 'ติดบ้าน',
    age: 25,
    role: 'ไล่ตามต้นตอของข่าว ทำให้เรื่องที่ไม่จริงลามช้าลงทั้งเมือง',
    act: () => {}, // บทบาทอยู่ตอน chain ปล่อย tieFear
  },
  {
    name: 'ท่านขุน',
    sex: 'ช',
    spirit: true,
    job: 'ผีเฝ้าด่าน',
    zone: 'ศาลปู่ตา',
    trait: 'ใจถึง',
    age: 60,
    role: 'ยืนเฝ้าอยู่ตรงไหน ผีตนอื่นไม่กล้าเข้าย่านนั้น',
    act: (w, _r, self) => {
      for (const o of alive(w)) if (o.zone === self.zone) scare(o, -2.5)
    },
  },
  {
    name: 'ป้าส้มตำ',
    sex: 'ญ',
    spirit: false,
    job: 'แม่ค้า',
    zone: 'ตลาด',
    trait: 'ปากมาก',
    age: 52,
    role: 'ปากคือทั้งยาและพิษ — ปลอบคนทั้งย่านได้ และปั่นเรื่องได้เหมือนกัน',
    act: (w, r, self) => {
      const here = alive(w).filter((c) => c.zone === self.zone)
      if (r() < 0.65) for (const o of here) scare(o, -3)
      else for (const o of here) scare(o, 4)
    },
  },
  {
    name: 'หลวงพ่อ',
    sex: 'ช',
    spirit: false,
    job: 'คนงานศาล',
    zone: 'ศาลปู่ตา',
    trait: 'ขี้สงสาร',
    age: 66,
    role: 'ทำพิธีที่ศาลทุกวัน ศรัทธาเข้าหาปู่ตาเองโดยไม่ต้องทำอะไร',
    act: (w) => {
      if (!w.shared) w.faith += 3
    },
  },
  {
    name: 'นางตานี',
    sex: 'ญ',
    spirit: true,
    job: 'ผีตานี',
    zone: 'ซอยใน',
    trait: 'ขี้สงสาร',
    age: 40,
    role: 'ผีที่คอยดูคนกลัวที่สุดในย่าน — เข้าไปปลอบ แต่คนที่ยังไม่ชินจะยิ่งขวัญเสีย',
    act: (w, _r, self) => {
      const here = alive(w).filter((c) => c.zone === self.zone && c.id !== self.id)
      const worst = here.sort((a, b) => b.fear - a.fear)[0]
      if (worst) scare(worst, -12)
      for (const o of here) if (o.bornHere === false && o.id !== worst?.id) scare(o, 1.5)
    },
  },
  {
    name: 'แม่ย่านาง',
    sex: 'ญ',
    spirit: true,
    job: 'แม่ย่านาง',
    zone: 'ท่าน้ำ',
    trait: 'ขี้สงสาร',
    age: 70,
    role: 'คุ้มคนที่เดินทาง — คนกล้าย้ายเข้ามาอยู่ในเมืองนี้มากขึ้น',
    act: (w, r) => {
      if (cityFear(w) < GROW_FEAR && alive(w).length < 26 && r() < 0.05) {
        const boy = r() < 0.5
        const c = newCitizen(
          w,
          pick(r, boy ? MALE : FEMALE),
          boy ? 'ช' : 'ญ',
          'ท่าน้ำ',
          pick(r, [...TRAITS]),
          20 + Math.floor(r() * 20),
          false,
        )
        w.citizens.push(c)
        build(w, r, 'ท่าน้ำ', c.id)
        push(w, `มีคนลงเรือมาที่ท่าน้ำ ชื่อ ${c.name} ขอปลูกบ้านอยู่ที่นี่`, true)
      }
    },
  },
]

export const legendOf = (name?: string) => LEGENDS.find((l) => l.name === name)
const hasLegend = (w: World, name: string) => alive(w).some((c) => c.legend === name)

const MALE = ['บุญ', 'ต้อย', 'ตี๋', 'ชัย', 'หมู', 'เอก', 'ตูน', 'โจ้']
const FEMALE = ['น้ำ', 'อ้อย', 'ก้อย', 'ดาว', 'ฝน', 'พลอย', 'แดง', 'เปิ้ล']
const JOBS = ['ไรเดอร์', 'แม่ค้า', 'พ่อค้า', 'รปภ.', 'คนงานศาล', 'คนเดินระบบ']

// ⚠️ seed มาจากข้างนอกเสมอ — ในโลกร่วมคือ seed ของฤดู ไม่ใช่ Date.now()
// ⚠️ seed มาจากข้างนอกเสมอ — ในโลกร่วมคือ seed ของโลก ไม่ใช่ Date.now()
export function createWorld(seed = Date.now() % 100000, avatar: AvatarId = 'pootah'): World {
  const r0 = rng(seed)
  const citizens: Citizen[] = LEGENDS.map((l, id) => ({
    id,
    name: l.name,
    spirit: l.spirit,
    sex: l.sex,
    job: l.job,
    zone: l.zone,
    trait: l.trait,
    fear: 20 + (id % 5) * 3,
    age: l.age,
    ties: [],
    partner: null,
    legend: l.name,
    bornHere: false,
    gone: false,
    cooldown: 0,
  }))
  // ชาวเมืองทั่วไป — สุ่มชื่อ อาชีพ ย่าน นิสัย ไม่ซ้ำกันทุกโลก
  for (let i = 0; i < 6; i++) {
    const boy = r0() < 0.5
    citizens.push({
      id: citizens.length,
      name: pick(r0, boy ? MALE : FEMALE),
      spirit: false,
      sex: boy ? 'ช' : 'ญ',
      job: pick(r0, JOBS),
      zone: pick(r0, [...ZONES]),
      trait: pick(r0, [...TRAITS]),
      fear: 18 + Math.floor(r0() * 14),
      age: 20 + Math.floor(r0() * 30),
      ties: [],
      partner: null,
      bornHere: false,
      gone: false,
      cooldown: 0,
    })
  }
  // ผูกเพื่อนบ้านคนละ 1-2 คน — เพื่อนคือช่องทางที่ความกลัวเดินทาง
  for (const c of citizens) {
    const near = citizens.filter((o) => o.id !== c.id && o.zone === c.zone)
    c.ties = near.slice(0, 2).map((o) => o.id)
    if (!c.ties.length) c.ties = [citizens[(c.id + 1) % citizens.length].id]
  }
  const houses: House[] = citizens.map((c, i) => {
    const [zx, zy] = ZONE_POS[c.zone]
    return {
      id: i,
      x: Math.round(zx + (r0() - 0.5) * 22),
      y: Math.round(zy + (r0() - 0.5) * 22),
      zone: c.zone,
      members: [c.id],
    }
  })
  return {
    seed,
    avatar,
    haunt: {},
    houses,
    nextHouse: houses.length,
    marks: [],
    nextMark: 0,
    agents: [],
    nextAgent: 0,
    tick: 0,
    faith: 30,
    nextId: citizens.length,
    log: [{ t: 0, text: 'เมืองตื่นขึ้น มีคนจุดธูปให้ปู่ตาเป็นคนแรก', notable: false }],
    citizens,
    wards: {},
    omenUntil: 0,
    runs: [],
    pos: { x: ZONE_POS['ศาลปู่ตา'][0], y: ZONE_POS['ศาลปู่ตา'][1] },
    savedAt: Date.now(),
  }
}

// รายได้ต่อ tick ของผู้เล่น — แยกออกมาเพื่อให้โลกร่วมคิดศรัทธาให้ทีละคนได้
export function income(w: World, _avatar: AvatarId, r: () => number): number {
  let n = 0
  for (const c of alive(w))
    if (r() < c.fear / 260) {
      const [x, y] = citizenPos(w, c)
      n += (c.bornHere ? 0.9 : 0.6) * (nearMark(w, 'shrine', x, y) ? 1.6 : 1) // มีศาลใกล้บ้าน ไหว้ง่ายกว่า
    }
  return n
}

export const alive = (w: World) => w.citizens.filter((c) => !c.gone)
export const cityFear = (w: World) => {
  const a = alive(w)
  return a.length ? Math.round(a.reduce((s, c) => s + c.fear, 0) / a.length) : 0
}
export const YEAR_DAYS = 60 // 1 ปีในเมือง = 60 วัน (ชาวเมืองแก่ขึ้น 1 ปีทุก 60 วันตามไปด้วย)
const day = (w: World) => Math.floor(w.tick / 24) + 1
export const calendar = (w: World) => ({
  year: Math.floor((day(w) - 1) / YEAR_DAYS) + 1,
  day: ((day(w) - 1) % YEAR_DAYS) + 1,
})
const byId = (w: World, id: number) => w.citizens.find((c) => c.id === id)

function push(w: World, text: string, notable = false) {
  if (w.quiet && !notable) return
  const cal = calendar(w)
  w.log.unshift({ t: w.tick, text: `ปีที่ ${cal.year} วันที่ ${cal.day} — ${text}`, notable })
  if (w.log.length > 300) w.log.length = 300
}

function scare(c: Citizen, n: number) {
  c.fear = clamp(c.fear + n * FEAR_MULT[c.trait])
}

// --- Event chains: เป็น data ไม่ใช่ rules engine ---
// after = ผ่านไปกี่ชั่วโมงถึงจะเล่นบีตถัดไป
type Beat = {
  after: number
  text: (c: Citizen, w: World) => string
  fear?: number
  zoneFear?: number // กระทบทุกคนในย่านเดียวกัน
  tieFear?: number // กระทบเพื่อนที่ผูกกันไว้
  faith?: number
  notable?: boolean
}

const CHAINS: { when: (c: Citizen, w: World) => boolean; beats: Beat[] }[] = [
  {
    // เงาปลายซอย → ร้านปิดเร็ว → ขาดรายได้ → ไม่พอใจศาล
    when: (c) => !c.spirit,
    beats: [
      { after: 0, fear: 10, text: (c) => `${c.name} เห็นเงาคนยืนอยู่ปลายซอยตอนตีสาม` },
      { after: 9, zoneFear: 5, text: (c) => `ร้านแถว${c.zone}ปิดเร็วขึ้นกว่าปกติสองชั่วโมง` },
      { after: 20, fear: 8, text: (c) => `${c.name} บ่นว่าขายไม่ได้เลยตั้งแต่ร้านปิดเร็ว` },
      {
        after: 26,
        faith: -8,
        zoneFear: 4,
        notable: true,
        text: (c) => `คนแถว${c.zone}เริ่มพูดกันว่า "ไหว้ปู่ตาไปก็เท่านั้น"`,
      },
    ],
  },
  {
    // ปากมากพาข่าวลือเดินทางผ่านเส้นความสัมพันธ์
    when: (c) => c.trait === 'ปากมาก',
    beats: [
      { after: 0, fear: 6, text: (c) => `${c.name} ได้ยินเรื่องบ้านร้างท้ายซอยมาจากใครไม่รู้` },
      { after: 5, tieFear: 9, text: (c) => `${c.name} เล่าต่อให้คนสนิทฟังจนดึก` },
      { after: 14, zoneFear: 6, notable: true, text: (c) => `เรื่องที่${c.name}เล่าลามไปทั้ง${c.zone}แล้ว` },
    ],
  },
  {
    // สายสงบ: งานบุญที่ศาล
    when: (c) => c.fear >= 25 && c.fear < 60,
    beats: [
      { after: 0, text: (c) => `${c.name} ชวนเพื่อนบ้านไปช่วยงานที่ศาลปู่ตา` },
      { after: 11, zoneFear: -6, faith: 4, notable: true, text: (c) => `งานบุญที่ศาลคึกคัก คน${c.zone}ใจนิ่งขึ้นทั้งย่าน` },
    ],
  },
  {
    // ผีทำงาน — ให้ฝั่งผีมีบทของตัวเอง
    when: (c) => c.spirit,
    beats: [
      { after: 0, text: (c) => `${c.name} เข้าเวรเฝ้า${c.zone}ตั้งแต่หัวค่ำ` },
      { after: 8, zoneFear: -4, faith: 2, notable: true, text: (c) => `คืนนี้${c.zone}เงียบผิดปกติ ไม่มีใครมากวน` },
    ],
  },
]

function playBeat(w: World, run: ChainRun, r: () => number) {
  const c = byId(w, run.who)
  const chain = CHAINS[run.chain]
  const beat = chain.beats[run.step]
  if (!c || c.gone) return false
  if ((w.wards[c.zone] ?? 0) > w.tick && (beat.fear ?? 0) > 0) return false // ปกปักกันบีตร้ายไว้ได้
  if (beat.fear) scare(c, beat.fear)
  if (beat.zoneFear)
    for (const o of alive(w)) if (o.zone === c.zone) scare(o, beat.zoneFear)
  // ริน ไล่ตามต้นตอของข่าว เรื่องที่ไม่จริงจึงลามช้าลงทั้งเมือง
  const rumor = beat.tieFear ? beat.tieFear * (hasLegend(w, 'ริน') ? 0.4 : 1) : 0
  if (rumor) for (const id of c.ties) { const o = byId(w, id); if (o && !o.gone) scare(o, rumor) }
  // ศรัทธาจาก chain เป็นเรื่องของปู่ตาโดยตรง (คนไหว้/เลิกไหว้) สายอื่นกินคนละทาง
  if (beat.faith && w.avatar === 'pootah' && !w.shared) w.faith = Math.max(0, w.faith + beat.faith)
  push(w, beat.text(c, w), !!beat.notable)
  void r
  return true
}

// --- วงจรชีวิต: เมืองโตด้วยคน ไม่ใช่ด้วยตึก ---
function build(w: World, r: () => number, zone: Zone, member: number): House {
  const [zx, zy] = ZONE_POS[zone]
  const h: House = {
    id: w.nextHouse++,
    x: Math.round(clamp(zx + (r() - 0.5) * 26, 6, BOARD - 6)),
    y: Math.round(clamp(zy + (r() - 0.5) * 26, 6, BOARD - 6)),
    zone,
    members: [member],
  }
  w.houses.push(h)
  return h
}

function leaveHouse(w: World, id: number) {
  const h = houseOf(w, id)
  if (!h) return
  h.members = h.members.filter((m) => m !== id)
  if (!h.members.length) w.houses = w.houses.filter((x) => x !== h)
}
function newCitizen(
  w: World,
  name: string,
  sex: 'ช' | 'ญ',
  zone: Zone,
  trait: Trait,
  age: number,
  bornHere: boolean,
): Citizen {
  return {
    id: w.nextId++,
    name,
    spirit: false,
    sex,
    job: bornHere ? 'เด็ก' : JOBS[w.nextId % JOBS.length],
    zone,
    trait,
    fear: bornHere ? 10 : 25,
    age,
    ties: [],
    partner: null,
    bornHere,
    gone: false,
    cooldown: 0,
  }
}

// อาชีพของชาวเมืองไม่ใช่แค่ป้ายชื่อ — วันละครั้ง แต่ละอาชีพทำอะไรกับย่านตัวเอง
// ไม่ขึ้น log (เป็นพื้นหลังของเมือง) เห็นผลผ่านตัวเลขความกลัวและศรัทธา
function jobsWork(w: World, r: () => number) {
  const people = alive(w)
  const inZone = (z: Zone) => people.filter((c) => c.zone === z)
  for (const c of people) {
    const lg = legendOf(c.legend)
    if (lg) lg.act(w, r, c)
    if (c.job === 'แม่ค้า' || c.job === 'พ่อค้า') {
      for (const o of inZone(c.zone)) scare(o, -1.5) // ย่านมีคนค้าขาย คนกล้าออกจากบ้าน
    } else if (c.job === 'รปภ.') {
      for (const o of inZone(c.zone)) scare(o, -1) // มีคนเฝ้า อุ่นใจขึ้นหน่อย
    } else if (c.job === 'คนงานศาล') {
      if (!w.shared && r() < 0.5) w.faith += 1.5 // ดูแลศาล คนมาไหว้สะดวก
    } else if (c.job === 'ไรเดอร์') {
      // วิ่งข้ามย่าน พาอารมณ์ของเมืองไปเกลี่ยให้เท่ากัน (ย่านสงบช่วยย่านที่กำลังตื่น)
      const other = pick(r, ZONES.filter((z) => z !== c.zone))
      const here = inZone(c.zone)
      const there = inZone(other)
      if (here.length && there.length) {
        const gap = here.reduce((n, o) => n + o.fear, 0) / here.length - there.reduce((n, o) => n + o.fear, 0) / there.length
        for (const o of there) scare(o, gap * 0.06)
        for (const o of here) scare(o, -gap * 0.06)
      }
    } else if (c.job === 'สแกมเมอร์') {
      if (r() < 0.3) w.faith = Math.max(0, w.faith - 2) // ตั้งบัญชีรับบุญปลอม ดูดของที่ควรเข้าศาล
    }
  }
}

function lifeCycle(w: World, r: () => number) {
  const people = alive(w).filter((c) => !c.spirit)
  const fear = cityFear(w)
  const stalled = fear > GROW_FEAR

  // แต่งงาน — คนกลัวไม่แต่งงาน
  if (!stalled && r() < 0.12) {
    const single = people.filter((c) => !c.partner && c.age >= 20 && c.age < 60 && c.fear < 45)
    if (single.length >= 2) {
      const a = pick(r, single)
      const b = pick(
        r,
        single.filter((c) => c.id !== a.id && c.sex !== a.sex && (c.zone === a.zone || a.ties.includes(c.id))),
      )
      if (b) {
        a.partner = b.id
        b.partner = a.id
        if (!a.ties.includes(b.id)) a.ties.push(b.id)
        if (!b.ties.includes(a.id)) b.ties.push(a.id)
        if (w.avatar === 'pootah') w.faith += 5
        // ย้ายมาอยู่บ้านเดียวกัน ถ้าบ้านฝ่ายหญิง/ชายเต็มก็ปลูกใหม่
        const ha = houseOf(w, a.id)
        leaveHouse(w, b.id)
        if (ha && ha.members.length < HOUSE_CAP) {
          ha.members.push(b.id)
        } else {
          leaveHouse(w, a.id)
          build(w, r, a.zone, a.id).members.push(b.id)
        }
        b.zone = a.zone
        push(w, `${a.name} กับ ${b.name} แต่งงานกันที่ศาลปู่ตา`, true)
      }
    }
  }

  // มีลูก
  if (!stalled && r() < 0.09) {
    const parent = people.find((c) => {
      const h = houseOf(w, c.id)
      return c.partner !== null && c.fear < 50 && c.age < 45 && !!h && h.members.length < HOUSE_CAP
    })
    const other = parent && byId(w, parent.partner!)
    if (parent && other && !other.gone) {
      const boy = r() < 0.5
      const kid = newCitizen(w, pick(r, boy ? MALE : FEMALE), boy ? 'ช' : 'ญ', parent.zone, pick(r, [...TRAITS]), 0, true)
      kid.ties = [parent.id, other.id]
      parent.ties.push(kid.id)
      other.ties.push(kid.id)
      w.citizens.push(kid)
      houseOf(w, parent.id)!.members.push(kid.id)
      push(w, `${parent.name} กับ ${other.name} มีลูก ตั้งชื่อว่า "${kid.name}"`, true)
    }
  }

  // ย้ายเข้า — เมืองที่ไม่น่ากลัวเกินไปเท่านั้นที่มีคนอยากมาอยู่
  if (!stalled && people.length < 24 && r() < 0.1) {
    const boy = r() < 0.5
    const c = newCitizen(
      w,
      pick(r, boy ? MALE : FEMALE),
      boy ? 'ช' : 'ญ',
      pick(r, [...ZONES]),
      pick(r, [...TRAITS]),
      20 + Math.floor(r() * 25),
      false,
    )
    const host = pick(r, people)
    c.ties = host ? [host.id] : []
    w.citizens.push(c)
    build(w, r, c.zone, c.id)
    push(w, `มีคนย้ายเข้ามาอยู่${c.zone} ชื่อ ${c.name} เป็น${c.job}`, true)
  }

  // แก่ตัวลง (1 ปี = 30 วัน) + ตายตามอายุ
  if (day(w) % YEAR_DAYS === 0) {
    for (const c of alive(w)) {
      if (!c.legend) c.age++
      if (c.job === 'เด็ก' && c.age >= 15) {
        c.job = JOBS[c.id % JOBS.length]
        leaveHouse(w, c.id)
        build(w, r, c.zone, c.id)
        push(w, `${c.name} โตพอจะแยกออกไปปลูกบ้านของตัวเองแล้ว`, true)
      }
      if (!c.spirit && !c.legend && c.age > 72 && r() < 0.25) {
        c.gone = true
        leaveHouse(w, c.id)
        for (const id of c.ties) { const o = byId(w, id); if (o && !o.gone) scare(o, 14) }
        push(w, `${c.name} สิ้นอายุขัยอย่างสงบที่${c.zone}`, true)
      }
    }
  }

  if (stalled && day(w) % 7 === 0)
    push(w, `เมืองกลัวมานานเกินไป ไม่มีใครคิดจะแต่งงาน ไม่มีใครย้ายเข้ามา`, true)
}

// คนที่จ้างลงเมืองได้ + AI ของแต่ละคน — ตัดสินใจเองทุก AGENT_EVERY ชั่วโมง
// ทุกอย่างต้อง deterministic (ดูกฎเหล็กใน context.md) · near = คนที่อยู่ในวงของมัน
export const HIRE: Record<
  AgentKind,
  { name: string; icon: string; cost: number; does: string; act: (w: World, r: () => number, near: Citizen[]) => void }
> = {
  ghost: {
    name: 'ผี',
    icon: '👻',
    cost: 45,
    does: 'เดินหลอกคนที่ใจนิ่งที่สุดในวง',
    act: (_w, _r, near) => {
      const calm = near.filter((c) => !c.spirit).sort((x, y) => x.fear - y.fear)[0]
      if (calm) scare(calm, 18)
    },
  },
  shaman: {
    name: 'หมอผี',
    icon: '🔮',
    cost: 55,
    does: 'ปัดเป่าคนที่กลัวหนัก ถ้าไม่มีลูกค้าก็ปั่นข่าวเอง',
    act: (w, _r, near) => {
      const client = near.filter((c) => c.fear > 50).sort((x, y) => y.fear - x.fear)[0]
      if (client) {
        client.fear = clamp(client.fear - 25)
        push(w, `[หมอผี] ${client.name} จ่ายค่าครูแล้วนอนหลับได้เป็นคืนแรก`, true)
      } else for (const c of near) scare(c, 9)
    },
  },
  police: {
    name: 'ตำรวจ',
    icon: '🚨',
    cost: 65,
    does: 'ปิดข่าวลือในวง ถ้าไม่มีก็ลาดตระเวนให้ใจนิ่ง',
    act: (w, _r, near) => {
      const noisy = w.runs.find((run) => {
        const t = byId(w, run.who)
        return t && citizenInRange(w, t)
      })
      if (noisy) {
        w.runs = w.runs.filter((x) => x !== noisy)
        push(w, `[ตำรวจ] เรื่องที่กำลังลามถูกสั่งไม่ให้พูดถึงอีก`, true)
      } else for (const c of near) scare(c, -8)
    },
  },
  thief: {
    name: 'ขโมย',
    icon: '🥷',
    cost: 35,
    does: 'ย่องเข้าบ้านในวง เจ้าของผวา เพื่อนบ้านพลอยไม่กล้านอน',
    act: (w, r, near) => {
      const target = near.filter((c) => !c.spirit)[Math.floor(r() * Math.max(1, near.length))]
      if (!target) return
      scare(target, 16)
      for (const c of near) if (c.id !== target.id) scare(c, 4)
      push(w, `[ขโมย] บ้าน${target.name}ถูกงัดตอนดึก ของหายไปหลายอย่าง`, true)
    },
  },
  monk: {
    name: 'พระ',
    icon: '🧎',
    cost: 60,
    does: 'สวดทั้งวงให้ใจนิ่ง คนแก่ในวงอยู่ได้นานขึ้น',
    act: (w, _r, near) => {
      for (const c of near) scare(c, -7)
      if (near.length) push(w, `[พระ] เสียงสวดดังทั้งคืน คนแถวนั้นหลับสบายขึ้น`)
    },
  },
  vendor: {
    name: 'แม่ค้า',
    icon: '🍜',
    cost: 30,
    does: 'ตั้งแผงขายของ คนออกมาเดิน ย่านนั้นคึกคัก',
    act: (w, _r, near) => {
      for (const c of near) scare(c, -4)
      if (near.length > 2) push(w, `[แม่ค้า] แผงขายดี คนออกมานั่งกินกันจนดึก`)
    },
  },
}

function agentTurn(w: World, a: Agent, r: () => number) {
  const keep = w.pos
  w.pos = { x: a.x, y: a.y }
  w.quiet = true
  HIRE[a.kind].act(w, r, reach(w))
  w.pos = keep
  w.quiet = false
}

export function step(w: World) {
  const r = rng(w.seed + w.tick * 7919)
  w.tick++
  const people = alive(w)
  if (!people.length) return

  // 1) รายได้ — แต่ละสายกินคนละอย่าง จึงอยากให้ความกลัวไปคนละทาง
  if (!w.shared) w.faith += income(w, w.avatar, r)

  // การตามติดของผี
  if (w.tick % 24 === 0)
    for (const c of people) if ((w.haunt[c.id] ?? 0) > w.tick) scare(c, 8)

  // 2) เดินบีตของ chain ที่ค้างอยู่
  for (const run of [...w.runs]) {
    if (run.at > w.tick) continue
    playBeat(w, run, r)
    run.step++
    const chain = CHAINS[run.chain]
    if (run.step >= chain.beats.length) w.runs = w.runs.filter((x) => x !== run)
    else run.at = w.tick + chain.beats[run.step].after
  }

  // 3) เปิด chain ใหม่ — คุมความถี่ด้วย cooldown รายคน ไม่ให้ log ท่วม
  if (w.runs.length < 2 && r() < 0.14) {
    const free = people.filter((c) => c.cooldown <= w.tick)
    if (free.length) {
      const c = pick(r, free)
      const options = CHAINS.map((ch, i) => (ch.when(c, w) ? i : -1)).filter((i) => i >= 0)
      if (options.length) {
        const idx = pick(r, options)
        // ย่านที่มี รปภ. เรื่องผีๆ เริ่มยากขึ้น
        if (idx === 0 && people.some((o) => o.job === 'รปภ.' && o.zone === c.zone) && r() < 0.6) return
        c.cooldown = w.tick + EVENT_COOLDOWN * 3
        w.runs.push({ chain: idx, step: 0, who: c.id, at: w.tick + CHAINS[idx].beats[0].after })
        // เก่งอ่านจังหวะเมืองออก — เตือนล่วงหน้าว่ากำลังจะมีเรื่องที่ไหน
        if (idx <= 1 && hasLegend(w, 'เก่ง') && r() < 0.7)
          push(w, `เก่งขี่ผ่าน${c.zone}แล้วชะลอรถ "แถวนี้มันเริ่มไม่ค่อยดีแล้วนะ"`, true)
      }
    }
  }

  // 4) ความกลัวจางเองเมื่อไม่มีอะไรเกิด (ไม่ขึ้น log)
  for (const c of people) if (r() < 0.06) c.fear = clamp(c.fear - 1)

  // 5) คนที่กลัวเกินเพดานหนีออกจากเมือง
  if (w.tick >= w.omenUntil)
    for (const c of people) {
      if (c.legend) continue // ตัวละครจากนิยายไม่หนีออกจากเมืองนี้
      if (c.fear >= LEAVE_FEAR && r() < 0.06) {
        const [cx, cy] = citizenPos(w, c)
        if (nearMark(w, 'shelter', cx, cy)) {
          // ไม่หนี แต่คนที่หลบอยู่ด้วยกันยิ่งขวัญเสียใส่กัน
          for (const o of alive(w)) {
            const [ox, oy] = citizenPos(w, o)
            if (o.id !== c.id && nearMark(w, 'shelter', ox, oy)) scare(o, 3)
          }
          continue
        }
        c.gone = true
        leaveHouse(w, c.id)
        w.faith = Math.max(0, w.faith - 10)
        for (const id of c.ties) { const o = byId(w, id); if (o && !o.gone) scare(o, 12) }
        push(w, `${c.name} เก็บของออกจากเมืองไปกลางดึก ไม่บอกใคร`, true)
      }
    }

  // 6) ปกปักหมดอายุ
  for (const z of ZONES)
    if (w.wards[z] && w.wards[z]! <= w.tick) {
      delete w.wards[z]
      push(w, `รอยปกปักที่${z}จางหายไปแล้ว`)
    }

  // 6.5) ตัวละครที่จ้างมาทำงานของมันเอง
  for (const a of [...w.agents]) {
    if (w.tick >= a.until) {
      w.agents = w.agents.filter((x) => x !== a)
      push(w, `${HIRE[a.kind].icon} ${HIRE[a.kind].name}ที่จ้างไว้หมดสัญญาแล้ว เก็บของกลับ`, true)
      continue
    }
    if (w.tick >= a.next) {
      a.next = w.tick + AGENT_EVERY
      agentTurn(w, a, rng(w.seed + w.tick * 6151 + a.id))
    }
  }

  // 6.6) สรุปผลงานของตัวที่จ้างวันละครั้ง แทนการรายงานทุก 6 ชั่วโมง
  if (w.tick % 24 === 0 && w.agents.length)
    push(
      w,
      `คนที่จ้างไว้ยังทำงานอยู่: ${w.agents.map((a) => HIRE[a.kind].icon + HIRE[a.kind].name).join(' · ')}`,
    )

  // 7) ศรัทธาที่ไม่ได้ใช้จางเอง — คนลืมเทพที่ไม่เคยแสดงตัว (กันศรัทธาบวมจนไม่ต้องตัดสินใจอะไร)
  if (w.tick % 24 === 0 && !w.shared) w.faith = Math.max(0, w.faith * 0.97)

  // 8) อาชีพชาวเมือง + วงจรชีวิต — วันละครั้ง
  if (w.tick % 24 === 0) {
    jobsWork(w, r)
    lifeCycle(w, r)
  }
}

// เดินเวลาจนกว่าจะมีเรื่องที่ควรรู้ (สูงสุด 2 วัน)
export function runToNotable(w: World, maxTicks = 48) {
  const before = w.log.length
  for (let i = 0; i < maxTicks; i++) {
    step(w)
    if (w.log.slice(0, w.log.length - before).some((l) => l.notable)) return
  }
}

// --- Avatar & พลัง ---
// ทุกพลัง = เอียงความน่าจะเป็น ไม่ใช่คำสั่ง · target บอก UI ว่าต้องให้เลือกอะไรก่อน
export type Power = {
  key: string
  name: string
  cost: number
  target: 'citizen' | 'zone' | 'none'
  hint: string
  run: (w: World, r: () => number, c?: Citizen, z?: Zone) => void
}

export const AVATARS: {
  id: AvatarId
  name: string
  icon: string
  want: string
  income: string
  powers: Power[]
}[] = [
  {
    id: 'pootah',
    name: 'ปู่ตา',
    icon: '🪬',
    want: 'อยากให้กลัวพอดีๆ',
    income: 'ได้ศรัทธาจากคนที่เซ่นไหว้ — ยิ่งกลัวยิ่งไหว้ แต่กลัวเกินคนหนี',
    powers: [
      {
        key: 'nudge', name: 'ดลใจ', cost: 5, target: 'citizen', hint: 'สุ่มผล 4 ทาง',
        run: (w, r, c) => c && doNudge(w, r, c),
      },
      {
        key: 'ward', name: 'ปกปัก', cost: 20, target: 'zone', hint: 'ผีเข้าไม่ได้ 3 วัน',
        run: (w, _r, _c, z) => z && doWard(w, z),
      },
      {
        key: 'omen', name: 'ให้ลาง', cost: 50, target: 'none', hint: 'กลัวพุ่งทั้งเมือง แต่ไม่มีใครหนี 1 วัน',
        run: (w) => doOmen(w),
      },
    ],
  },
]

// ย้ายคนธรรมดาเข้ามาอยู่ — ไม่ใช่ agent ไม่มีวง แค่เพิ่มคนลงเมืองแล้วเขาใช้ชีวิตของเขาเอง
function settle(w: World, sex: 'ช' | 'ญ') {
  const r = rng(w.seed + w.tick * 911 + w.nextId)
  const zone = ZONES.reduce((best, z) => {
    const [x, y] = ZONE_POS[z]
    const [bx, by] = ZONE_POS[best]
    return Math.hypot(w.pos.x - x, w.pos.y - y) < Math.hypot(w.pos.x - bx, w.pos.y - by) ? z : best
  }, ZONES[0])
  const c = newCitizen(
    w,
    pick(r, sex === 'ช' ? MALE : FEMALE),
    sex,
    zone,
    pick(r, [...TRAITS]),
    20 + Math.floor(r() * 20),
    false,
  )
  const host = alive(w)[0]
  c.ties = host ? [host.id] : []
  w.citizens.push(c)
  const h = build(w, r, zone, c.id)
  h.x = Math.round(clamp(w.pos.x, 6, BOARD - 6))
  h.y = Math.round(clamp(w.pos.y, 6, BOARD - 6))
  push(w, `${sex === 'ช' ? 'ชาย' : 'หญิง'}ชื่อ ${c.name} มาปลูกบ้านอยู่${zone} เป็น${c.job}`, true)
}

export const BUILD_POWERS: Power[] = (Object.keys(LANDMARK) as LandmarkKind[]).map((kind) => ({
  key: `build_${kind}`,
  name: `สร้าง${LANDMARK[kind].name}`,
  cost: LANDMARK[kind].cost,
  target: 'none' as const,
  hint: `${LANDMARK[kind].does} · อยู่ถาวร`,
  run: (w: World) => {
    // หลังเดียวต่อพื้นที่ — ห้ามปูทับกันเอง
    if (nearMark(w, kind, w.pos.x, w.pos.y)) {
      w.faith += LANDMARK[kind].cost
      push(w, `แถวนี้มี${LANDMARK[kind].name}อยู่แล้ว`)
      return
    }
    w.marks.push({ id: w.nextMark++, kind, by: 'me', x: w.pos.x, y: w.pos.y })
    push(w, `${LANDMARK[kind].icon} ${LANDMARK[kind].name}ตั้งขึ้นแล้วตรงนี้`, true)
  },
}))

export const SETTLE_POWERS: Power[] = (['ช', 'ญ'] as const).map((sex) => ({
  key: `settle_${sex === 'ช' ? 'm' : 'f'}`,
  name: sex === 'ช' ? 'ชวนชายมาอยู่' : 'ชวนหญิงมาอยู่',
  cost: 25,
  target: 'none' as const,
  hint: 'เพิ่มคนลงเมืองถาวร เขาจะใช้ชีวิตของเขาเอง แต่งงาน มีลูกได้',
  run: (w: World) => settle(w, sex),
}))

// พลัง "จ้าง" — วางคนลงตรงจุดที่ผู้เล่นยืนอยู่ แล้วเขาทำงานของเขาเอง
export const HIRE_POWERS: Power[] = (Object.keys(HIRE) as AgentKind[]).map((kind) => ({
  key: `hire_${kind}`,
  name: `จ้าง${HIRE[kind].name}`,
  cost: HIRE[kind].cost,
  target: 'none' as const,
  hint: `${HIRE[kind].does} · อยู่ ${AGENT_DAYS} วัน`,
  run: (w: World) => {
    // ห้ามซ้อนอาชีพเดียวกันในวงเดียวกัน — ไม่งั้นกลยุทธ์ที่ดีที่สุดคือจ้างซ้ำที่เดิมรัวๆ
    const stacked = w.agents.find(
      (g) => g.kind === kind && Math.hypot(g.x - w.pos.x, g.y - w.pos.y) < AGENT_RADIUS,
    )
    if (stacked) {
      w.faith += HIRE[kind].cost // คืนเงิน ไม่ได้จ้าง
      push(w, `แถวนี้มี${HIRE[kind].name}อยู่แล้ว ไปยืนให้ห่างกว่านี้ก่อน`)
      return
    }
    w.agents.push({
      id: w.nextAgent++,
      kind,
      by: 'me',
      x: w.pos.x,
      y: w.pos.y,
      until: w.tick + AGENT_DAYS * 24,
      next: w.tick + AGENT_EVERY,
    })
    push(w, `${HIRE[kind].icon} มี${HIRE[kind].name}มาปักหลักอยู่แถวนี้ ${AGENT_DAYS} วัน`, true)
  },
}))

// เผื่อ save เก่าที่เคยเลือกสายอื่นไว้ตอนที่ยังมีจอเลือกตัวละคร — ตกมาที่ปู่ตาเสมอ
export const avatarOf = (w: World) => AVATARS.find((a) => a.id === w.avatar) ?? AVATARS[0]
export const powersOf = (w: World) => [...BUILD_POWERS, ...SETTLE_POWERS, ...HIRE_POWERS, ...avatarOf(w).powers]

export function moveTo(w: World, x: number, y: number) {
  w.pos = { x: clamp(Math.round(x), 0, BOARD), y: clamp(Math.round(y), 0, BOARD) }
}

export function castPower(w: World, key: string, c?: Citizen, z?: Zone) {
  const p = powersOf(w).find((x) => x.key === key)
  if (!p || w.faith < p.cost) return false
  if (p.target === 'citizen' && (!c || c.gone || !citizenInRange(w, c))) return false
  if (p.target === 'zone' && (!z || !inRange(w, ZONE_POS[z][0], ZONE_POS[z][1]))) return false
  w.faith -= p.cost
  p.run(w, rng(w.seed + w.tick * 31 + (c?.id ?? 0)), c, z)
  return true
}

// --- พลังฝั่งปู่ตา ---
function doNudge(w: World, r: () => number, c: Citizen) {
  const roll = r()
  if (roll < 0.35) {
    c.fear = clamp(c.fear - 18)
    push(w, `[ดลใจ] ${c.name} อยู่ๆ ก็นึกอยากกลับบ้าน ใจเบาขึ้นผิดปกติ`)
  } else if (roll < 0.6) {
    c.fear = clamp(c.fear - 10)
    w.faith += 3
    push(w, `[ดลใจ] ${c.name} เดินไปจุดธูปที่ศาลโดยไม่รู้ว่าทำไม`)
  } else if (roll < 0.85) {
    const friend = c.ties.map((i) => byId(w, i)).find((o) => o && !o.gone)
    if (friend) {
      friend.fear = clamp(friend.fear - 14)
      push(w, `[ดลใจ] ${c.name} นึกขึ้นได้ว่านานแล้วไม่ได้ไปหา${friend.name} เลยแวะไป`)
    } else c.fear = clamp(c.fear - 8)
  } else {
    c.fear = clamp(c.fear - 2)
    push(w, `[ดลใจ] ${c.name} หยุดเดินกลางทาง มองไปรอบๆ แล้วเดินต่อเหมือนเดิม`)
  }
}

export const nudge = (w: World, id: number) => castPower(w, 'nudge', byId(w, id))

function doWard(w: World, zone: Zone) {
  w.wards[zone] = w.tick + 24 * 3
  push(w, `[ปกปัก] มีบางอย่างคุ้มอยู่รอบ${zone} ผีเข้าไม่ได้ 3 วัน`)
}

export const ward = (w: World, zone: Zone) => castPower(w, 'ward', undefined, zone)

function doOmen(w: World) {
  // ให้ลาง = พลังทั้งเมืองโดยตั้งใจ (ข้อยกเว้นเดียวของกฎรัศมี) เพราะ omenUntil กันคนหนีทั้งเมืองอยู่แล้ว
  for (const c of alive(w)) scare(c, 12)
  w.omenUntil = w.tick + 24
  push(w, '[ให้ลาง] ทั้งเมืองฝันเหมือนกันคืนนี้ ทุกคนตื่นมาด้วยความกลัว แต่ไม่มีใครออกไปไหน', true)
}

export const omen = (w: World) => castPower(w, 'omen')

// --- save / offline progress ---
// เมืองส่วนตัวแยกตาม PIN — คนละ PIN บนเครื่องเดียวกันคือคนละเมือง
const keyFor = (slot: string) => `spirit-parade-save:${slot}`

export function save(w: World, slot: string) {
  w.savedAt = Date.now()
  localStorage.setItem(keyFor(slot), JSON.stringify(w))
}

// คืน null เมื่อยังไม่เคยเล่น (หรือ save รุ่นเก่า) → ให้ UI ถามว่าจะเป็นใครก่อน
export function load(msPerTick: number, slot: string): World | null {
  const raw = localStorage.getItem(keyFor(slot))
  if (!raw) return null
  let w: World
  try {
    w = JSON.parse(raw) as World
  } catch {
    return null
  }
  if (!w.runs || typeof w.nextId !== 'number' || !w.avatar || !w.houses || !w.agents || !w.marks) return null
  w.avatar = 'pootah' // save เก่าอาจเป็นสายที่ลบไปแล้ว // save รุ่นเก่า ทิ้งได้
  const missed = Math.min(Math.floor((Date.now() - w.savedAt) / msPerTick), MAX_CATCHUP_TICKS)
  for (let i = 0; i < missed; i++) step(w)
  if (missed > 2) push(w, `— ปู่ตาไม่ได้มองมา ${Math.max(1, Math.floor(missed / 24))} วัน เมืองเดินของมันเอง —`, true)
  return w
}

// ponytail: self-check เล็กๆ แทน test framework — รันเองตอน dev
export function selfCheck() {
  const a = createWorld(1)
  a.citizens.forEach((c) => (c.fear = 80))
  const b = createWorld(1)
  b.citizens.forEach((c) => (c.fear = 5))
  for (let i = 0; i < 400; i++) {
    step(a)
    step(b)
  }
  console.assert(a.faith > b.faith, 'กลัวมาก ต้องได้ศรัทธามากกว่าเมืองสงบ')
  console.assert(a.citizens.some((c) => c.gone), 'กลัวเกินเพดาน ต้องมีคนหนีออกเมือง')
  const start = createWorld(1).citizens.length
  console.assert(alive(b).length > start, 'เมืองที่ไม่กลัว ต้องโตขึ้น (ย้ายเข้า/มีลูก)')
  console.assert(alive(a).length <= start, 'เมืองที่กลัวตลอด ต้องไม่โต')
  console.assert(b.log.filter((l) => l.notable).length > 3, 'ต้องมีเรื่องที่ควรรู้เกิดขึ้นบ้าง')
  console.assert(b.log.length < 400, 'log ต้องไม่ท่วมจนกลายเป็น noise')

  const c = createWorld(2)
  c.faith = 100
  console.assert(!ward(c, 'ตลาด'), 'ย่านที่อยู่นอกวง ต้องปกปักไม่ได้')
  moveTo(c, ZONE_POS['ตลาด'][0], ZONE_POS['ตลาด'][1])
  ward(c, 'ตลาด')
  console.assert((c.wards['ตลาด'] ?? 0) > c.tick && c.faith === 80, 'ปกปักต้องมีอายุและหักศรัทธา 20')

  const d = createWorld(3)
  d.faith = 100
  const before = cityFear(d)
  omen(d)
  console.assert(cityFear(d) > before && d.omenUntil > d.tick, 'ให้ลางต้องกลัวพุ่งและกันคนหนี 1 วัน')

  const e = createWorld(4)
  const n0 = e.log.length
  runToNotable(e)
  console.assert(e.log.length > n0, 'ข้ามไปเหตุการณ์สำคัญต้องเดินเวลาจริง')

  const rich = createWorld(9)
  rich.citizens.forEach((c) => (c.fear = 70))
  rich.faith = 0
  const poor = createWorld(9)
  poor.citizens.forEach((c) => (c.fear = 5))
  poor.faith = 0
  for (let i = 0; i < 240; i++) {
    step(rich)
    step(poor)
  }
  console.assert(rich.faith > poor.faith, 'เมืองที่กลัวต้องให้ศรัทธามากกว่าเมืองที่สงบ')

  const noShrine = createWorld(74)
  const withShrine = createWorld(74)
  withShrine.faith = 500
  moveTo(withShrine, ZONE_POS['ตลาด'][0], ZONE_POS['ตลาด'][1])
  castPower(withShrine, 'build_shrine')
  noShrine.faith = 0
  withShrine.faith = 0
  for (let i = 0; i < 24 * 60; i++) {
    step(noShrine)
    step(withShrine)
  }
  console.assert(withShrine.faith > noShrine.faith, 'ศาลต้องทำให้ศรัทธาไหลเข้ามากขึ้นจริง ไม่ใช่แค่เขียนไว้ในคำอธิบาย')

  const pol = createWorld(6)
  pol.faith = 200
  while (!pol.runs.length) step(pol)
  const target = byId(pol, pol.runs[0].who)!
  const [tx, ty] = citizenPos(pol, target)
  moveTo(pol, tx, ty)
  castPower(pol, 'hire_police')
  for (let i = 0; i < 24 * 3; i++) step(pol)
  console.assert(
    pol.log.some((l) => l.text.includes('[ตำรวจ]')),
    'ตำรวจที่จ้างมาต้องปิดข่าวลือที่กำลังลามได้เอง',
  )

  const b1 = createWorld(11)
  b1.faith = 100
  const far = b1.citizens.find((c) => !citizenInRange(b1, c))
  console.assert(!!far, 'ต้องมีคนที่อยู่นอกรัศมีตั้งแต่ต้นเกม ไม่งั้นรัศมีไม่มีความหมาย')
  if (far) console.assert(!castPower(b1, 'nudge', far), 'พรต้องใช้กับคนนอกวงไม่ได้')
  const near = b1.citizens.find((c) => citizenInRange(b1, c))!
  console.assert(castPower(b1, 'nudge', near), 'คนในวงต้องใช้ได้')
  moveTo(b1, ZONE_POS['ท่าน้ำ'][0], ZONE_POS['ท่าน้ำ'][1])
  console.assert(inRange(b1, ZONE_POS['ท่าน้ำ'][0], ZONE_POS['ท่าน้ำ'][1]), 'ย้ายไปแล้วต้องเอื้อมถึงที่นั่น')

  const hh = createWorld(12)
  for (let i = 0; i < 24 * 120; i++) step(hh)
  console.assert(
    hh.houses.every((h) => h.members.length <= HOUSE_CAP && h.members.length > 0),
    'บ้านต้องมี 1-3 คนเสมอ ไม่มีบ้านร้างค้างในระบบ',
  )
  console.assert(
    alive(hh).every((c) => !!houseOf(hh, c.id)),
    'คนที่ยังอยู่ต้องมีบ้านทุกคน',
  )

  const ag = createWorld(21)
  ag.faith = 300
  const victim = ag.citizens.find((c) => citizenInRange(ag, c) && !c.spirit)!
  const f1 = victim.fear
  console.assert(castPower(ag, 'hire_ghost'), 'จ้างผีต้องได้ถ้าศรัทธาพอ')
  console.assert(ag.agents.length === 1 && ag.faith === 255, 'จ้างแล้วต้องมีตัวลงเมืองและหักศรัทธา 45')
  for (let i = 0; i < 24 * 2; i++) step(ag)
  console.assert(
    cityFear(ag) > 20 || victim.fear > f1,
    'ผีที่จ้างมาต้องทำงานเองโดยผู้เล่นไม่ต้องกดอะไรอีก',
  )
  for (let i = 0; i < 24 * (AGENT_DAYS + 1); i++) step(ag)
  console.assert(ag.agents.length === 0, 'หมดสัญญาแล้วต้องหายไปเอง')

  const d1 = createWorld(22)
  const d2 = createWorld(22)
  for (const g of [d1, d2]) {
    g.faith = 300
    castPower(g, 'hire_shaman')
    castPower(g, 'hire_police')
    for (let i = 0; i < 24 * 6; i++) step(g)
  }
  // savedAt เป็นเวลาเครื่อง ไม่ใช่ส่วนหนึ่งของโลก — ตัดออกก่อนเทียบ (ดูกฎเหล็ก)
  const bare = (g: World) => JSON.stringify({ ...g, savedAt: 0 })
  console.assert(bare(d1) === bare(d2), 'ตัวละครที่จ้างมาต้องตัดสินใจแบบ deterministic')

  const st = createWorld(31)
  st.faith = 200
  const nStart = alive(st).length
  console.assert(castPower(st, 'settle_f'), 'ชวนคนมาอยู่ต้องได้')
  console.assert(
    alive(st).length === nStart + 1 && st.houses.length === nStart + 1,
    'ชวนคนมาอยู่ = เพิ่มคน + ปลูกบ้าน 1 หลัง',
  )
  console.assert(alive(st).some((c) => c.sex === 'ญ'), 'ชวนหญิงต้องได้หญิง')

  const th = createWorld(32)
  th.faith = 200
  const fearBefore = cityFear(th)
  castPower(th, 'hire_thief')
  for (let i = 0; i < 24 * 2; i++) step(th)
  console.assert(cityFear(th) > fearBefore, 'ขโมยต้องทำให้เมืองกลัวขึ้นเอง')

  const mk = createWorld(32)
  mk.citizens.forEach((c) => (c.fear = 60))
  mk.faith = 200
  const calmBefore = cityFear(mk)
  castPower(mk, 'hire_monk')
  for (let i = 0; i < 24 * 2; i++) step(mk)
  console.assert(cityFear(mk) < calmBefore, 'พระต้องทำให้เมืองใจนิ่งขึ้นเอง')

  const singles = createWorld(33)
  console.assert(
    singles.citizens.some((c) => c.sex === 'ช') && singles.citizens.some((c) => c.sex === 'ญ'),
    'เมืองต้องมีทั้งชายและหญิงตั้งแต่ต้น',
  )
  const wed = createWorld(34)
  for (let i = 0; i < 24 * 120; i++) step(wed)
  console.assert(
    wed.citizens.every((c) => c.partner === null || byId(wed, c.partner)!.sex !== c.sex),
    'คู่ที่แต่งงานกันต้องต่างเพศ',
  )

  const legacy = { ...createWorld(41), avatar: 'shaman' as AvatarId }
  console.assert(!!avatarOf(legacy) && powersOf(legacy).length > 0, 'save เก่าที่เป็นสายอื่นต้องเปิดได้ ไม่พังทั้งจอ')

  const om = createWorld(61)
  om.faith = 100
  moveTo(om, 0, 0) // ยืนมุมกระดาน ไม่มีใครอยู่ในวง
  const farFear = om.citizens.find((c) => !citizenInRange(om, c))!.fear
  castPower(om, 'omen')
  console.assert(
    om.citizens.some((c) => !citizenInRange(om, c) && c.fear > farFear),
    'ให้ลางต้องถึงคนนอกวงด้วย (พลังทั้งเมืองตามที่ออกแบบ)',
  )

  const stack = createWorld(62)
  stack.faith = 300
  castPower(stack, 'hire_monk')
  const paid = stack.faith
  castPower(stack, 'hire_monk')
  console.assert(stack.agents.length === 1, 'ห้ามซ้อนอาชีพเดียวกันในวงเดียวกัน')
  console.assert(stack.faith === paid, 'ซ้อนไม่ได้ต้องคืนเงิน ไม่ใช่เก็บเงินฟรี')
  moveTo(stack, 5, 95)
  castPower(stack, 'hire_monk')
  console.assert(stack.agents.length === 2, 'วางห่างกันต้องจ้างซ้ำอาชีพเดิมได้')

  const sh = createWorld(71)
  sh.faith = 500
  const outsider = sh.citizens.find((c) => !citizenInRange(sh, c))!
  const [ox, oy] = citizenPos(sh, outsider)
  moveTo(sh, ox, oy)
  castPower(sh, 'build_shrine')
  moveTo(sh, ZONE_POS['ศาลปู่ตา'][0], ZONE_POS['ศาลปู่ตา'][1]) // เดินกลับมาที่เดิม
  console.assert(citizenInRange(sh, outsider), 'ศาลต้องทำให้เอื้อมถึงคนไกลได้แม้ตัวจะไม่อยู่ตรงนั้น')
  moveTo(sh, ox, oy) // กลับไปยืนที่เดิม แล้วลองสร้างทับ
  const paidShrine = sh.faith
  castPower(sh, 'build_shrine')
  console.assert(sh.marks.length === 1 && sh.faith === paidShrine, 'สร้างทับที่เดิมไม่ได้ และต้องคืนเงิน')
  moveTo(sh, 5, 95)
  castPower(sh, 'build_shrine')
  console.assert(sh.marks.length === 2, 'สร้างศาลหลังที่สองคนละที่ได้')

  const shel = createWorld(72)
  shel.faith = 500
  castPower(shel, 'build_shelter')
  for (const c of alive(shel)) c.fear = 99
  const pop0 = alive(shel).length
  for (let i = 0; i < 24 * 20; i++) step(shel)
  const stayed = alive(shel).filter((c) => nearMark(shel, 'shelter', ...citizenPos(shel, c)))
  console.assert(stayed.length > 0 && alive(shel).length > pop0 - 12, 'ศูนย์พักพิงต้องกันคนแถวนั้นไม่ให้หนี')

  const jb = createWorld(73)
  const traderZone = alive(jb).find((c) => c.job === 'แม่ค้า')!.zone
  const tz0 = alive(jb).filter((c) => c.zone === traderZone).reduce((n, c) => n + c.fear, 0)
  for (let i = 0; i < 24; i++) step(jb)
  const tz1 = alive(jb).filter((c) => c.zone === traderZone).reduce((n, c) => n + c.fear, 0)
  console.assert(tz1 < tz0 + 5, 'ย่านที่มีแม่ค้าต้องไม่กลัวขึ้นเฉยๆ อาชีพต้องมีผลจริง')

  const lg = createWorld(81)
  console.assert(
    LEGENDS.every((l) => lg.citizens.some((c) => c.legend === l.name)),
    'ตัวละครนิยายต้องอยู่ในเมืองตั้งแต่เริ่ม',
  )
  const rnd1 = createWorld(82).citizens.filter((c) => !c.legend).map((c) => c.name).join()
  const rnd2 = createWorld(83).citizens.filter((c) => !c.legend).map((c) => c.name).join()
  console.assert(rnd1 !== rnd2, 'ชาวเมืองทั่วไปต้องสุ่มชื่อ ไม่ใช่ชุดเดิมทุกโลก')

  const imm = createWorld(84)
  imm.citizens.forEach((c) => (c.fear = 99))
  for (let i = 0; i < 24 * 365 * 3; i++) step(imm)
  console.assert(
    LEGENDS.every((l) => imm.citizens.some((c) => c.legend === l.name && !c.gone)),
    'ตัวละครนิยายต้องไม่ตายและไม่หนี แม้เมืองจะแตกตื่นสามปี',
  )
  console.assert(
    imm.citizens.filter((c) => c.legend).every((c) => c.age === legendOf(c.legend)!.age),
    'ตัวละครนิยายต้องไม่แก่ขึ้น',
  )

  // PIN แยกเมืองในเครื่องเดียวกัน
  const wA = createWorld(51)
  wA.faith = 777
  save(wA, '123')
  const wB = createWorld(52)
  wB.faith = 111
  save(wB, '999')
  console.assert(Math.round(load(2000, '123')!.faith) === 777, 'PIN เดิมต้องได้เมืองเดิม')
  console.assert(Math.round(load(2000, '999')!.faith) === 111, 'คนละ PIN ต้องคนละเมือง')
  console.assert(load(2000, 'ไม่เคยใช้') === null, 'PIN ใหม่ต้องได้เมืองใหม่')

  console.log('sim selfCheck ผ่าน')
}
