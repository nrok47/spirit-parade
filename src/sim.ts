// Spirit Parade — simulation core. อ่าน context.md ก่อนแก้ไฟล์นี้
// แกน: ความกลัวมี 2 ด้าน — กลัวขึ้น = คนไหว้มากขึ้น = ศรัทธาเพิ่ม / กลัวเกิน = คนหนี = ศรัทธาแห้ง

export const ZONES = ['ตลาด', 'ศาลปู่ตา', 'ซอยใน', 'โกดัง', 'ใต้สะพาน', 'ท่าน้ำ'] as const
export type Zone = (typeof ZONES)[number]

export type Citizen = {
  id: number
  name: string
  spirit: boolean
  job: string
  zone: Zone
  fear: number // 0-100
  gone: boolean
}

export type World = {
  seed: number
  tick: number // 1 tick = 1 ชั่วโมงในเมือง
  faith: number
  log: string[]
  citizens: Citizen[]
  wards: Partial<Record<Zone, number>> // zone -> tick ที่หมดอายุ
  omenUntil: number // ให้ลาง: ก่อนถึง tick นี้ ไม่มีใครหนีออกเมือง
  savedAt: number
}

export const COST = { nudge: 5, ward: 20, omen: 50 }
const MAX_CATCHUP_TICKS = 24 * 3 // ปิดเครื่องนานแค่ไหน เมืองเดินต่อไม่เกิน 3 วัน
const LEAVE_FEAR = 85
const CALM_FEAR = 15

// mulberry32 — deterministic ให้ offline catch-up ได้ผลเดียวกับเล่นสด
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

const ROSTER: [string, boolean, string, Zone][] = [
  ['เก่ง', false, 'ไรเดอร์', 'ซอยใน'],
  ['ริน', false, 'คนเดินระบบ', 'โกดัง'],
  ['ท่านขุน', true, 'ผีเฝ้าด่าน', 'ศาลปู่ตา'],
  ['ป้าส้มตำ', false, 'แม่ค้า', 'ตลาด'],
  ['หลวงพ่อ', false, 'คนงานศาล', 'ศาลปู่ตา'],
  ['ยายคำ', false, 'แม่ค้า', 'ตลาด'],
  ['นางตานี', true, 'ผีตานี', 'ซอยใน'],
  ['เสี่ยหมง', false, 'พ่อค้า', 'โกดัง'],
  ['บักหำ', false, 'รปภ.', 'ใต้สะพาน'],
  ['แม่ย่านาง', true, 'แม่ย่านาง', 'ท่าน้ำ'],
  ['ตุ๊กตา', false, 'สแกมเมอร์', 'ใต้สะพาน'],
  ['ลุงมา', false, 'คนงานศาล', 'ศาลปู่ตา'],
]

export function createWorld(seed = Date.now() % 100000): World {
  return {
    seed,
    tick: 0,
    faith: 30,
    log: ['เมืองตื่นขึ้น มีคนจุดธูปให้ปู่ตาเป็นคนแรก'],
    citizens: ROSTER.map(([name, spirit, job, zone], id) => ({
      id,
      name,
      spirit,
      job,
      zone,
      fear: 20 + (id % 5) * 3,
      gone: false,
    })),
    wards: {},
    omenUntil: 0,
    savedAt: Date.now(),
  }
}

export const alive = (w: World) => w.citizens.filter((c) => !c.gone)
export const cityFear = (w: World) => {
  const a = alive(w)
  return a.length ? Math.round(a.reduce((s, c) => s + c.fear, 0) / a.length) : 0
}

const SCARE: [string, number][] = [
  ['เห็นเงาคนยืนอยู่ปลายซอยตอนตีสาม', 12],
  ['ได้ยินเสียงเรียกชื่อตัวเองจากในบ้านร้าง', 14],
  ['หมาเห่าไม่หยุดทั้งคืนทั้งที่ไม่มีใครเดินผ่าน', 8],
  ['ของในร้านหายไปโดยไม่มีใครเข้า', 9],
  ['ฝันเห็นคนที่ตายไปแล้วมานั่งกินข้าวด้วย', 11],
]
const CALM: [string, number][] = [
  ['ขายของหมดแผงตั้งแต่เที่ยง', -7],
  ['นั่งกินข้าวกับเพื่อนบ้านจนดึก', -6],
  ['ไปช่วยงานที่ศาล กลับมาใจนิ่งขึ้น', -9],
  ['ฝนตกพอดี อากาศเย็นสบาย', -5],
]

function pick<T>(r: () => number, arr: T[]) {
  return arr[Math.floor(r() * arr.length)]
}

function push(w: World, line: string) {
  w.log.unshift(`วันที่ ${Math.floor(w.tick / 24) + 1} — ${line}`)
  if (w.log.length > 200) w.log.length = 200
}

export function step(w: World) {
  const r = rng(w.seed + w.tick * 7919)
  w.tick++
  const people = alive(w)
  if (!people.length) return

  // 1) รายได้ศรัทธา — ยิ่งกลัวยิ่งเซ่นไหว้
  const offerings = people.filter((c) => r() < c.fear / 260).length
  w.faith += offerings * 0.6
  if (offerings === 0 && cityFear(w) < CALM_FEAR && w.tick % 24 === 0)
    push(w, 'เมืองสงบเกินไป ไม่มีใครจุดธูปให้ปู่ตาเลยทั้งวัน')

  // 2) เหตุการณ์
  if (r() < 0.55) {
    const c = pick(r, people)
    const warded = (w.wards[c.zone] ?? 0) > w.tick
    if (r() < 0.45 && !warded) {
      const [text, d] = pick(r, SCARE)
      c.fear = clamp(c.fear + d)
      push(w, `${c.name} (${c.zone}) ${text}`)
    } else if (r() < 0.5) {
      const [text, d] = pick(r, CALM)
      c.fear = clamp(c.fear + d)
      push(w, `${c.name} (${c.zone}) ${text}`)
    }
  }

  // 3) คนที่กลัวเกินเพดานหนีออกจากเมือง (เว้นแต่เพิ่งให้ลาง)
  if (w.tick >= w.omenUntil) {
    for (const c of people) {
      if (c.fear >= LEAVE_FEAR && r() < 0.08) {
        c.gone = true
        w.faith = Math.max(0, w.faith - 10)
        push(w, `${c.name} เก็บของออกจากเมืองไปกลางดึก ไม่บอกใคร`)
      }
    }
  }

  // 4) ปกปักหมดอายุ
  for (const z of ZONES)
    if (w.wards[z] && w.wards[z]! <= w.tick) {
      delete w.wards[z]
      push(w, `รอยปกปักที่${z}จางหายไปแล้ว`)
    }
}

// --- พลังของเทพ: เอียงความน่าจะเป็น ไม่ใช่คำสั่ง ---
export function nudge(w: World, id: number) {
  const c = w.citizens.find((x) => x.id === id)
  if (!c || c.gone || w.faith < COST.nudge) return false
  w.faith -= COST.nudge
  c.fear = clamp(c.fear - 15)
  push(w, `[ดลใจ] ${c.name} อยู่ๆ ก็นึกอยากกลับบ้าน ใจเบาขึ้นผิดปกติ`)
  return true
}

export function ward(w: World, zone: Zone) {
  if (w.faith < COST.ward) return false
  w.faith -= COST.ward
  w.wards[zone] = w.tick + 24 * 3
  push(w, `[ปกปัก] มีบางอย่างคุ้มอยู่รอบ${zone} ผีเข้าไม่ได้ 3 วัน`)
  return true
}

export function omen(w: World) {
  if (w.faith < COST.omen) return false
  w.faith -= COST.omen
  for (const c of alive(w)) c.fear = clamp(c.fear + 12)
  w.omenUntil = w.tick + 24
  push(w, '[ให้ลาง] ทั้งเมืองฝันเหมือนกันคืนนี้ ทุกคนตื่นมาด้วยความกลัว แต่ไม่มีใครออกไปไหน')
  return true
}

// --- save / offline progress ---
const KEY = 'spirit-parade-save'

export function save(w: World) {
  w.savedAt = Date.now()
  localStorage.setItem(KEY, JSON.stringify(w))
}

export function load(msPerTick: number): World {
  const raw = localStorage.getItem(KEY)
  if (!raw) return createWorld()
  const w = JSON.parse(raw) as World
  const missed = Math.min(Math.floor((Date.now() - w.savedAt) / msPerTick), MAX_CATCHUP_TICKS)
  for (let i = 0; i < missed; i++) step(w)
  if (missed > 2) push(w, `— ปู่ตาไม่ได้มองมา ${Math.floor(missed / 24)} วัน เมืองเดินของมันเอง —`)
  return w
}

// ponytail: self-check เล็กๆ แทน test framework — รันเองตอน dev
export function selfCheck() {
  const a = createWorld(1)
  a.citizens.forEach((c) => (c.fear = 80))
  const b = createWorld(1)
  b.citizens.forEach((c) => (c.fear = 5))
  for (let i = 0; i < 200; i++) {
    step(a)
    step(b)
  }
  console.assert(a.faith > b.faith, 'กลัวมาก ต้องได้ศรัทธามากกว่าเมืองสงบ')
  console.assert(a.citizens.some((c) => c.gone), 'กลัวเกินเพดาน ต้องมีคนหนีออกเมือง')

  const c = createWorld(2)
  c.faith = 100
  ward(c, 'ตลาด')
  console.assert((c.wards['ตลาด'] ?? 0) > c.tick, 'ปกปักต้องมีอายุ')
  console.assert(c.faith === 80, 'ปกปักต้องหักศรัทธา 20')

  const d = createWorld(3)
  d.faith = 100
  const before = cityFear(d)
  omen(d)
  console.assert(cityFear(d) > before, 'ให้ลางต้องทำให้ความกลัวพุ่ง')
  console.assert(d.omenUntil > d.tick, 'ให้ลางต้องกันคนหนี 1 วัน')
  console.log('sim selfCheck ผ่าน')
}
