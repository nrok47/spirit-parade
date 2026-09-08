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
  job: string
  zone: Zone
  trait: Trait
  fear: number // 0-100
  age: number
  ties: number[] // เพื่อน/ญาติ 1-2 คน
  partner: number | null
  bornHere: boolean // เกิดในเมืองที่เทพรักษาไว้ = ศรัทธาต่อหัวมากกว่า
  gone: boolean
  cooldown: number // tick ที่รับเหตุการณ์ใหม่ได้อีกครั้ง
}

export type ChainRun = { chain: number; step: number; who: number; at: number }

// บ้าน 1 หลังอยู่ได้ไม่เกิน 3 คน (พ่อ แม่ ลูก) — โตแล้วต้องแยกออกไปปลูกบ้านใหม่
export type House = { id: number; x: number; y: number; zone: Zone; members: number[] }

// ตัวละครที่จ้างลงไปในเมือง แล้วมันทำงานของมันเอง — ผู้เล่นตัดสินใจแค่ จ้างใคร วางตรงไหน
export type AgentKind = 'ghost' | 'shaman' | 'police'
export type Agent = { id: number; kind: AgentKind; by: string; x: number; y: number; until: number; next: number }
export const AGENT_RADIUS = 18
export const AGENT_DAYS = 5
export const AGENT_EVERY = 6 // ทำงานทุก 6 ชั่วโมง
export const HIRE: Record<AgentKind, { name: string; icon: string; cost: number; does: string }> = {
  ghost: { name: 'ผี', icon: '👻', cost: 45, does: 'เดินหลอกคนที่ใจนิ่งที่สุดในวงของมัน' },
  shaman: { name: 'หมอผี', icon: '🔮', cost: 55, does: 'ปัดเป่าคนที่กลัวหนัก ถ้าไม่มีลูกค้าก็ปั่นข่าวเอง' },
  police: { name: 'ตำรวจ', icon: '🚨', cost: 65, does: 'ปิดข่าวลือในวง ถ้าไม่มีก็ลาดตระเวนให้ใจนิ่ง' },
}
export const HOUSE_CAP = 3

export type AvatarId = 'pootah' | 'ghost' | 'shaman' | 'police'

export type World = {
  seed: number
  avatar: AvatarId
  season: number
  haunt: Record<number, number> // citizen id -> tick ที่การตามติดหมดฤทธิ์
  houses: House[]
  nextHouse: number
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
export const SEASON_DAYS = 30
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
export const inRange = (w: World, x: number, y: number) => dist(w.pos.x, w.pos.y, x, y) <= RADIUS
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
export const seasonOver = (w: World) => w.tick >= SEASON_DAYS * 24

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

const ROSTER: [string, boolean, string, Zone, Trait, number][] = [
  ['เก่ง', false, 'ไรเดอร์', 'ซอยใน', 'ใจถึง', 27],
  ['ริน', false, 'คนเดินระบบ', 'โกดัง', 'ติดบ้าน', 25],
  ['ท่านขุน', true, 'ผีเฝ้าด่าน', 'ศาลปู่ตา', 'ใจถึง', 60],
  ['ป้าส้มตำ', false, 'แม่ค้า', 'ตลาด', 'ปากมาก', 52],
  ['หลวงพ่อ', false, 'คนงานศาล', 'ศาลปู่ตา', 'ขี้สงสาร', 66],
  ['ยายคำ', false, 'แม่ค้า', 'ตลาด', 'ขี้กลัว', 58],
  ['นางตานี', true, 'ผีตานี', 'ซอยใน', 'ขี้สงสาร', 40],
  ['เสี่ยหมง', false, 'พ่อค้า', 'โกดัง', 'ติดบ้าน', 44],
  ['บักหำ', false, 'รปภ.', 'ใต้สะพาน', 'ใจถึง', 31],
  ['แม่ย่านาง', true, 'แม่ย่านาง', 'ท่าน้ำ', 'ขี้สงสาร', 70],
  ['ตุ๊กตา', false, 'สแกมเมอร์', 'ใต้สะพาน', 'ปากมาก', 23],
  ['ลุงมา', false, 'คนงานศาล', 'ศาลปู่ตา', 'ขี้กลัว', 49],
]

const NEW_NAMES = ['น้ำ', 'บุญ', 'ต้อย', 'แดง', 'อ้อย', 'หนู', 'ก้อย', 'เปิ้ล', 'ตี๋', 'ดาว', 'ฝน', 'พลอย']
const JOBS = ['ไรเดอร์', 'แม่ค้า', 'พ่อค้า', 'รปภ.', 'คนงานศาล', 'คนเดินระบบ']

// ⚠️ seed มาจากข้างนอกเสมอ — ในโลกร่วมคือ seed ของฤดู ไม่ใช่ Date.now()
export function createWorld(seed = Date.now() % 100000, avatar: AvatarId = 'pootah', season = 1): World {
  const citizens: Citizen[] = ROSTER.map(([name, spirit, job, zone, trait, age], id) => ({
    id,
    name,
    spirit,
    job,
    zone,
    trait: TRAITS.includes(trait) ? trait : 'ติดบ้าน',
    fear: 20 + (id % 5) * 3,
    age,
    ties: [],
    partner: null,
    bornHere: false,
    gone: false,
    cooldown: 0,
  }))
  // ผูกเพื่อนบ้านคนละ 1-2 คน — เพื่อนคือช่องทางที่ความกลัวเดินทาง
  for (const c of citizens) {
    const near = citizens.filter((o) => o.id !== c.id && o.zone === c.zone)
    c.ties = near.slice(0, 2).map((o) => o.id)
    if (!c.ties.length) c.ties = [citizens[(c.id + 1) % citizens.length].id]
  }
  const r0 = rng(seed)
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
    season,
    haunt: {},
    houses,
    nextHouse: houses.length,
    agents: [],
    nextAgent: 0,
    pos: { x: ZONE_POS['ศาลปู่ตา'][0], y: ZONE_POS['ศาลปู่ตา'][1] },
    tick: 0,
    faith: 30,
    nextId: citizens.length,
    log: [{ t: 0, text: 'เมืองตื่นขึ้น มีคนจุดธูปให้ปู่ตาเป็นคนแรก', notable: false }],
    citizens,
    wards: {},
    omenUntil: 0,
    runs: [],
    savedAt: Date.now(),
  }
}

// รายได้ต่อ tick ของแต่ละสาย — แยกออกมาเพื่อให้โลกร่วม replay คิดศรัทธาให้ทีละคนได้
export function income(w: World, avatar: AvatarId, r: () => number): number {
  const people = alive(w)
  if (avatar === 'ghost') return (people.reduce((n, c) => n + c.fear, 0) / 100) * 0.1 // ยิ่งเมืองกลัวยิ่งอิ่ม
  if (avatar === 'shaman') return people.filter((c) => c.fear > 55).length * 0.2 // คนกลัวคือลูกค้า
  if (avatar === 'police') {
    const f = cityFear(w)
    return f < 60 ? ((60 - f) / 100) * 2 : 0 // เมืองสงบ = ผลงาน
  }
  let n = 0
  for (const c of people) if (r() < c.fear / 260) n += c.bornHere ? 0.9 : 0.6
  return n
}

export const alive = (w: World) => w.citizens.filter((c) => !c.gone)
export const cityFear = (w: World) => {
  const a = alive(w)
  return a.length ? Math.round(a.reduce((s, c) => s + c.fear, 0) / a.length) : 0
}
const day = (w: World) => Math.floor(w.tick / 24) + 1
const byId = (w: World, id: number) => w.citizens.find((c) => c.id === id)

function push(w: World, text: string, notable = false) {
  if (w.quiet && !notable) return
  w.log.unshift({ t: w.tick, text: `วันที่ ${day(w)} — ${text}`, notable })
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
  if (beat.tieFear) for (const id of c.ties) { const o = byId(w, id); if (o && !o.gone) scare(o, beat.tieFear) }
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
function newCitizen(w: World, name: string, zone: Zone, trait: Trait, age: number, bornHere: boolean): Citizen {
  return {
    id: w.nextId++,
    name,
    spirit: false,
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

function lifeCycle(w: World, r: () => number) {
  const people = alive(w).filter((c) => !c.spirit)
  const fear = cityFear(w)
  const stalled = fear > GROW_FEAR

  // แต่งงาน — คนกลัวไม่แต่งงาน
  if (!stalled && r() < 0.12) {
    const single = people.filter((c) => !c.partner && c.age >= 20 && c.age < 60 && c.fear < 45)
    if (single.length >= 2) {
      const a = pick(r, single)
      const b = pick(r, single.filter((c) => c.id !== a.id && (c.zone === a.zone || a.ties.includes(c.id))))
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
      const kid = newCitizen(w, pick(r, NEW_NAMES), parent.zone, pick(r, [...TRAITS]), 0, true)
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
    const c = newCitizen(w, pick(r, NEW_NAMES), pick(r, [...ZONES]), pick(r, [...TRAITS]), 20 + Math.floor(r() * 25), false)
    const host = pick(r, people)
    c.ties = host ? [host.id] : []
    w.citizens.push(c)
    build(w, r, c.zone, c.id)
    push(w, `มีคนย้ายเข้ามาอยู่${c.zone} ชื่อ ${c.name} เป็น${c.job}`, true)
  }

  // แก่ตัวลง (1 ปี = 30 วัน) + ตายตามอายุ
  if (day(w) % 30 === 0) {
    for (const c of alive(w)) {
      c.age++
      if (c.job === 'เด็ก' && c.age >= 15) {
        c.job = JOBS[c.id % JOBS.length]
        leaveHouse(w, c.id)
        build(w, r, c.zone, c.id)
        push(w, `${c.name} โตพอจะแยกออกไปปลูกบ้านของตัวเองแล้ว`, true)
      }
      if (!c.spirit && c.age > 72 && r() < 0.25) {
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

// AI ของตัวละครที่จ้างมา — ใช้พลังชุดเดียวกับที่ผู้เล่นใช้ แต่ตัดสินใจเอง
// ทุกอย่างต้อง deterministic (ดูกฎเหล็กใน context.md)
function agentTurn(w: World, a: Agent, r: () => number) {
  const keep = w.pos
  w.pos = { x: a.x, y: a.y }
  w.quiet = true
  const near = reach(w)
  const powers = AVATARS.find((v) => v.id === a.kind)!.powers
  const act = (key: string, c?: Citizen, z?: Zone) => powers.find((x) => x.key === key)!.run(w, r, c, z)

  if (a.kind === 'ghost') {
    const calm = near.filter((c) => !c.spirit).sort((x, y) => x.fear - y.fear)[0]
    if (calm) act('scare', calm)
  } else if (a.kind === 'shaman') {
    const client = near.filter((c) => c.fear > 50).sort((x, y) => y.fear - x.fear)[0]
    if (client) act('cleanse', client)
    else if (near.length) act('lie', undefined, near[0].zone)
  } else {
    const noisy = w.runs.find((run) => {
      const t = byId(w, run.who)
      return t && citizenInRange(w, t)
    })
    if (noisy) act('hush')
    else if (near.length) act('patrol', undefined, near[0].zone)
  }
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
        c.cooldown = w.tick + EVENT_COOLDOWN * 3
        w.runs.push({ chain: idx, step: 0, who: c.id, at: w.tick + CHAINS[idx].beats[0].after })
      }
    }
  }

  // 4) ความกลัวจางเองเมื่อไม่มีอะไรเกิด (ไม่ขึ้น log)
  for (const c of people) if (r() < 0.06) c.fear = clamp(c.fear - 1)

  // 5) คนที่กลัวเกินเพดานหนีออกจากเมือง
  if (w.tick >= w.omenUntil)
    for (const c of people)
      if (c.fear >= LEAVE_FEAR && r() < 0.06) {
        c.gone = true
        leaveHouse(w, c.id)
        w.faith = Math.max(0, w.faith - 10)
        for (const id of c.ties) { const o = byId(w, id); if (o && !o.gone) scare(o, 12) }
        push(w, `${c.name} เก็บของออกจากเมืองไปกลางดึก ไม่บอกใคร`, true)
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

  // 8) วงจรชีวิต — วันละครั้ง
  if (w.tick % 24 === 0) lifeCycle(w, r)
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
  {
    id: 'ghost',
    name: 'ผี',
    icon: '👻',
    want: 'อยากให้กลัวมากที่สุด',
    income: 'อิ่มจากความกลัวรวมของทั้งเมือง — แต่คนหนีหมดก็ไม่เหลืออะไรให้หลอก',
    powers: [
      {
        key: 'scare', name: 'หลอก', cost: 5, target: 'citizen', hint: 'กลัวพุ่งทันที',
        run: (w, _r, c) => {
          if (!c) return
          scare(c, 18)
          push(w, `[หลอก] ${c.name} เห็นอะไรบางอย่างในกระจกตอนกลางคืน`)
        },
      },
      {
        key: 'haunt', name: 'ตามติด', cost: 15, target: 'citizen', hint: 'กลัวเพิ่มเองทุกวัน 3 วัน',
        run: (w, _r, c) => {
          if (!c) return
          w.haunt[c.id] = w.tick + 24 * 3
          push(w, `[ตามติด] มีอะไรเดินตาม${c.name}กลับบ้านทุกคืน`, true)
        },
      },
      {
        key: 'enter', name: 'เข้าบ้าน', cost: 40, target: 'zone', hint: 'ทั้งย่านกลัวหนัก',
        run: (w, _r, _c, z) => {
          if (!z) return
          for (const o of reach(w, z)) scare(o, 14)
          push(w, `[เข้าบ้าน] คืนนี้ทุกหลังใน${z}ได้ยินเสียงเคาะประตูพร้อมกัน`, true)
        },
      },
    ],
  },
  {
    id: 'shaman',
    name: 'หมอผี',
    icon: '🔮',
    want: 'อยากให้กลัวแล้วมาจ้างตัวเอง',
    income: 'ได้ค่าจ้างจากคนที่กลัวเกิน 55 — ไม่มีใครกลัวก็ไม่มีใครจ้าง',
    powers: [
      {
        key: 'cleanse', name: 'ปัดเป่า', cost: 10, target: 'citizen', hint: 'ลดกลัว + ได้ค่าจ้างถ้าเขากลัวจริง',
        run: (w, _r, c) => {
          if (!c) return
          const paid = c.fear > 50
          c.fear = clamp(c.fear - 25)
          if (paid) w.faith += 18
          push(
            w,
            paid
              ? `[ปัดเป่า] ${c.name} จ่ายค่าครูแล้วนอนหลับได้เป็นคืนแรก`
              : `[ปัดเป่า] ${c.name} รับของไปแบบงงๆ ไม่ได้กลัวอะไรตั้งแต่แรก`,
          )
        },
      },
      {
        key: 'bless', name: 'ปลุกเสก', cost: 20, target: 'zone', hint: 'ทั้งย่านใจนิ่งขึ้น',
        run: (w, _r, _c, z) => {
          if (!z) return
          for (const o of reach(w, z)) scare(o, -10)
          push(w, `[ปลุกเสก] ของที่แจกไปทั่ว${z}เริ่มมีคนเชื่อว่าใช้ได้จริง`)
        },
      },
      {
        key: 'lie', name: 'โกหกว่ามีผี', cost: 5, target: 'zone', hint: 'ปั่นให้กลัว = สร้างลูกค้า',
        run: (w, _r, _c, z) => {
          if (!z) return
          for (const o of reach(w, z)) scare(o, 12)
          push(w, `[โกหกว่ามีผี] มีคนไปบอกว่า${z}มีของไม่ดี ต้องรีบแก้`, true)
        },
      },
    ],
  },
  {
    id: 'police',
    name: 'ตำรวจ',
    icon: '🚨',
    want: 'อยากให้เมืองสงบที่สุด',
    income: 'ได้ผลงานเมื่อความกลัวทั้งเมืองต่ำ — เมืองแตกตื่นคือความล้มเหลว',
    powers: [
      {
        key: 'patrol', name: 'ลาดตระเวน', cost: 8, target: 'zone', hint: 'ทั้งย่านใจนิ่งขึ้น',
        run: (w, _r, _c, z) => {
          if (!z) return
          for (const o of reach(w, z)) scare(o, -8)
          push(w, `[ลาดตระเวน] มีรถวิ่งผ่าน${z}ทั้งคืน คนกล้าออกมานั่งหน้าบ้าน`)
        },
      },
      {
        key: 'hush', name: 'ปิดข่าวลือ', cost: 15, target: 'none', hint: 'หยุดเรื่องที่กำลังลาม 1 เรื่อง',
        run: (w) => {
          const run = w.runs.find((x) => {
            const t = byId(w, x.who)
            return t && citizenInRange(w, t)
          })
          if (!run) {
            w.faith += 15 // ไม่มีอะไรให้หยุด = ไม่คิดเงิน
            push(w, `[ปิดข่าวลือ] ตรวจแล้วไม่มีเรื่องอะไรกำลังลามในระยะที่ไปถึง`)
            return
          }
          const c = byId(w, run.who)
          w.runs = w.runs.filter((x) => x !== run)
          w.faith += 20 // หยุดได้จริง = ผลงาน (ท่าไม้ตายต้องไม่ทำให้ยิ่งใช้ยิ่งจน)
          push(w, `[ปิดข่าวลือ] เรื่องของ${c ? c.name : 'ใครบางคน'}ถูกสั่งไม่ให้พูดถึงอีก`, true)
        },
      },
      {
        key: 'raid', name: 'ตรวจค้น', cost: 25, target: 'none', hint: 'ยึดของกลาง ทั้งเมืองใจนิ่งขึ้น',
        run: (w) => {
          for (const o of reach(w)) scare(o, -6)
          w.faith += 10
          push(w, `[ตรวจค้น] ยึดของกลางจากคนที่อ้างว่าแก้ผีได้ ข่าวลงทั้งเมือง`, true)
        },
      },
    ],
  },
]

// พลัง "จ้าง" ใช้ได้ทุกสาย — วางตรงจุดที่ผู้เล่นยืนอยู่
export const HIRE_POWERS: Power[] = (Object.keys(HIRE) as AgentKind[]).map((kind) => ({
  key: `hire_${kind}`,
  name: `จ้าง${HIRE[kind].name}`,
  cost: HIRE[kind].cost,
  target: 'none' as const,
  hint: `${HIRE[kind].does} · อยู่ ${AGENT_DAYS} วัน`,
  run: (w: World) => {
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

export const avatarOf = (w: World) => AVATARS.find((a) => a.id === w.avatar)!
export const powersOf = (w: World) => [...HIRE_POWERS, ...avatarOf(w).powers]

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
  for (const c of reach(w)) scare(c, 12)
  w.omenUntil = w.tick + 24
  push(w, '[ให้ลาง] ทั้งเมืองฝันเหมือนกันคืนนี้ ทุกคนตื่นมาด้วยความกลัว แต่ไม่มีใครออกไปไหน', true)
}

export const omen = (w: World) => castPower(w, 'omen')

// --- save / offline progress ---
const KEY = 'spirit-parade-save'

export function save(w: World) {
  w.savedAt = Date.now()
  localStorage.setItem(KEY, JSON.stringify(w))
}

// คืน null เมื่อยังไม่เคยเล่น (หรือ save รุ่นเก่า) → ให้ UI ถามว่าจะเป็นใครก่อน
export function load(msPerTick: number): World | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  let w: World
  try {
    w = JSON.parse(raw) as World
  } catch {
    return null
  }
  if (!w.runs || typeof w.nextId !== 'number' || !w.avatar || !w.houses || !w.agents) return null // save รุ่นเก่า ทิ้งได้
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
  console.assert(alive(b).length > 12, 'เมืองที่ไม่กลัว ต้องโตขึ้น (ย้ายเข้า/มีลูก)')
  console.assert(alive(a).length <= 12, 'เมืองที่กลัวตลอด ต้องไม่โต')
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

  const incomes: Record<string, number> = {}
  for (const av of AVATARS) {
    const g = createWorld(9, av.id)
    g.citizens.forEach((c) => (c.fear = 70))
    g.faith = 0
    for (let i = 0; i < 240; i++) step(g)
    incomes[av.id] = g.faith
  }
  console.assert(incomes.ghost > 0 && incomes.shaman > 0, 'ผี/หมอผี ต้องมีรายได้ตอนเมืองกลัว')
  console.assert(incomes.police < incomes.ghost, 'ตำรวจต้องไม่ได้ผลงานตอนเมืองกลัว')

  const q = createWorld(5, 'ghost')
  q.faith = 100
  const t0 = q.citizens.find((x) => citizenInRange(q, x))!
  castPower(q, 'haunt', t0)
  console.assert(q.haunt[t0.id] > q.tick && q.faith === 85, 'ตามติดต้องติดตัวและหักศรัทธา 15')

  const pol = createWorld(6, 'police')
  pol.faith = 100
  while (!pol.runs.length) step(pol)
  const target = byId(pol, pol.runs[0].who)!
  const [tx, ty] = citizenPos(pol, target)
  moveTo(pol, tx, ty)
  const f0 = pol.faith
  castPower(pol, 'hush')
  console.assert(pol.faith > f0 && !pol.runs.length, 'ปิดข่าวลือที่หยุดได้จริงต้องได้ผลงานคืนมากกว่าค่าใช้จ่าย')
  const pol2 = createWorld(6, 'police')
  pol2.faith = 100
  pol2.runs = []
  castPower(pol2, 'hush')
  console.assert(pol2.faith === 100, 'กดตอนไม่มีอะไรให้หยุด ต้องไม่คิดเงิน')

  const b1 = createWorld(11, 'ghost')
  b1.faith = 100
  const far = b1.citizens.find((c) => !citizenInRange(b1, c))
  console.assert(!!far, 'ต้องมีคนที่อยู่นอกรัศมีตั้งแต่ต้นเกม ไม่งั้นรัศมีไม่มีความหมาย')
  if (far) console.assert(!castPower(b1, 'scare', far), 'พรต้องใช้กับคนนอกวงไม่ได้')
  const near = b1.citizens.find((c) => citizenInRange(b1, c))!
  console.assert(castPower(b1, 'scare', near), 'คนในวงต้องใช้ได้')
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

  const ag = createWorld(21, 'pootah')
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

  const d1 = createWorld(22, 'pootah')
  const d2 = createWorld(22, 'pootah')
  for (const g of [d1, d2]) {
    g.faith = 300
    castPower(g, 'hire_shaman')
    castPower(g, 'hire_police')
    for (let i = 0; i < 24 * 6; i++) step(g)
  }
  console.assert(JSON.stringify(d1) === JSON.stringify(d2), 'ตัวละครที่จ้างมาต้องตัดสินใจแบบ deterministic')

  console.assert(!seasonOver(createWorld(1)), 'ฤดูเพิ่งเริ่มต้องยังไม่จบ')

  console.log('sim selfCheck ผ่าน')
}
