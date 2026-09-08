// โลกร่วม — ไม่มี game server
// sim เป็น deterministic อยู่แล้ว (ดูกฎเหล็กใน context.md) ทุกเครื่องจึงคำนวณเมืองเดียวกันได้เอง
// server เก็บแค่ "รายการของที่คนใส่" แบบ append-only แล้ว replay ทับ
// anon key เป็น public โดยออกแบบ (อยู่ใน bundle ของทุก client อยู่แล้ว) ตัวกันจริงคือ RLS — ดู db/shared-world.sql

import {
  AVATARS,
  castPower,
  createWorld,
  income,
  moveTo,
  rngFor,
  step,
  type AvatarId,
  type World,
  type Zone,
} from './sim'

const URL = 'https://xkbfzohlnybnaajfmqfw.supabase.co'
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrYmZ6b2hsbnlibmFhamZtcWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NTY4ODgsImV4cCI6MjEwNDQzMjg4OH0.9ffuOBIAgZlJlCgbvt3JCbMFJm2HfY95zWgwNWFf8aQ'

// เมืองร่วมอยู่ยาวไม่มีวันจบ นาฬิกาจึงต้องช้ากว่าเมืองส่วนตัวมาก
// 10 วิ/ชั่วโมงในเมือง → 1 วันในเมือง = 4 นาทีจริง · 1 วันจริง = เมืองผ่านไป 144 วัน
// (ถ้าใช้ 2 วิเท่าเมืองส่วนตัว 1 วันจริงจะกลายเป็น 5 ปีในเมือง คนแก่ตายหมดข้ามคืน)
export const MS_PER_TICK = 10000
const EPOCH = Date.UTC(2026, 8, 8) // จุดอ้างเวลาของโลกร่วม — ห้ามเปลี่ยน ไม่งั้นเวลาเมืองกระโดด
export const SEASON = 1 // โลกเดียว เดินไปเรื่อยๆ ไม่มีฤดู · คอลัมน์ในตารางยังอยู่ ส่งค่านี้เสมอ
// คนมาใหม่ไม่ได้ศรัทธาย้อนหลัง จึงต้องมีทุนตั้งต้นพอจ้างของถูกๆ ได้ทันที
// (ถ้าให้ 30 เท่าเมืองส่วนตัว จะจ้างได้แค่แม่ค้า แล้วติดกับดักไก่กับไข่)
export const START_FAITH = 60

/**
 * ของที่คนอื่นทำจะถูกใส่เข้าโลก "ช้ากว่าตอนกด" เท่านี้เสมอ
 * ต้องมากกว่ารอบ poll (8 วิ) เพื่อให้ทุกเครื่องได้ action ครบก่อนถึงคิวใส่ — 2 tick = 20 วิ
 * → ทุกเครื่องใส่ของชิ้นเดียวกันที่ tick เดียวกัน โลกจึงไม่แตก และไม่ต้อง replay ใหม่ทั้งใบทุกวินาที
 */
export const APPLY_LAG = 2

export type Action = {
  season: number
  tick: number
  player: string
  avatar: AvatarId
  power: string
  target_citizen: number | null
  target_zone: string | null
  px: number
  py: number
}

/** tick ปัจจุบันคำนวณจากเวลาจริง ไม่ต้องถาม server */
export const nowTick = () => Math.floor((Date.now() - EPOCH) / MS_PER_TICK)
export const WORLD_SEED = 20260908

/** ชื่อผู้เล่นเก็บในเครื่อง — PIN ที่ตั้งเอง ไม่มีรหัสผ่าน ไม่มี server auth */
export const PIN_KEY = 'sp-pin'
export const getPin = () => localStorage.getItem(PIN_KEY)
export const setPin = (pin: string) => localStorage.setItem(PIN_KEY, pin)
export const clearPin = () => localStorage.removeItem(PIN_KEY)
export const me = (): string => getPin() ?? 'guest'

const headers = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }

export async function fetchActions(sinceId = 0): Promise<Action[]> {
  const res = await fetch(
    `${URL}/rest/v1/actions?season=eq.${SEASON}&id=gt.${sinceId}&order=tick.asc,id.asc&select=*`,
    { headers },
  )
  if (!res.ok) throw new Error(`โหลดโลกร่วมไม่สำเร็จ (${res.status})`)
  return res.json()
}

export async function sendAction(a: Action) {
  const res = await fetch(`${URL}/rest/v1/actions`, { method: 'POST', headers, body: JSON.stringify(a) })
  if (!res.ok) throw new Error(`ส่งไม่สำเร็จ (${res.status})`)
}

export type Shared = {
  world: World
  purse: Record<string, number>
  joined: Record<string, number> // tick ที่ผู้เล่นคนนั้นโผล่มาในเมืองครั้งแรก
  queue: Action[] // ยังไม่ถึงคิวใส่
}

export function createShared(): Shared {
  const world = createWorld(WORLD_SEED)
  world.shared = true
  return { world, purse: {}, joined: {}, queue: [] }
}

/** เอาของใหม่จาก server เข้าคิว (ของที่ยังไม่ถึงคิวใส่จะรออยู่ในนี้) */
export function enqueue(s: Shared, actions: Action[]) {
  for (const a of actions) {
    if (s.joined[a.player] === undefined) {
      s.joined[a.player] = a.tick // เริ่มนับศรัทธาตั้งแต่ตอนโผล่มา ไม่ได้ย้อนหลัง
      s.purse[a.player] = START_FAITH
    }
    s.queue.push(a)
  }
  s.queue.sort((x, y) => x.tick - y.tick)
}

/** เดินโลกไปจนถึง tick ที่ต้องการ — deterministic ทุกเครื่อง */
export function advance(s: Shared, toTick: number, budget = 400000) {
  const w = s.world
  let n = 0
  while (w.tick < toTick && n++ < budget) {
    step(w)
    const r = rngFor(w.seed + w.tick * 104729)
    for (const p of Object.keys(s.purse)) {
      if (s.joined[p] > w.tick) continue
      s.purse[p] = (s.purse[p] ?? START_FAITH) + income(w, 'pootah', r)
      if (w.tick % 24 === 0) s.purse[p] = Math.max(0, s.purse[p] * 0.97)
    }
    while (s.queue.length && s.queue[0].tick + APPLY_LAG <= w.tick) {
      const a = s.queue.shift()!
      const keep = { faith: w.faith, pos: w.pos }
      const hadAgents = w.agents.length
      w.faith = s.purse[a.player] ?? START_FAITH
      moveTo(w, a.px, a.py)
      castPower(
        w,
        a.power,
        a.target_citizen === null ? undefined : w.citizens.find((c) => c.id === a.target_citizen),
        (a.target_zone as Zone) ?? undefined,
      )
      // ติดป้ายชื่อเฉพาะตอนที่จ้างสำเร็จจริง ไม่งั้นการจ้างที่ล้มเหลว (เงินไม่พอ/ซ้อนวง)
      // จะไปเปลี่ยนเจ้าของคนที่คนอื่นจ้างไว้
      if (a.power.startsWith('hire_') && w.agents.length > hadAgents) w.agents[w.agents.length - 1].by = a.player
      s.purse[a.player] = w.faith
      w.faith = keep.faith
      w.pos = keep.pos
    }
  }
}

export const purseOf = (s: Shared, player: string) => s.purse[player] ?? START_FAITH

// ponytail: กันโลกแตก — เดินด้วย input เดียวกันต้องได้เมืองเดียวกันเป๊ะ
export function netSelfCheck() {
  const acts: Action[] = [
    { season: 1, tick: 60, player: 'a', avatar: 'pootah', power: 'hire_ghost', target_citizen: null, target_zone: null, px: 22, py: 62 },
    { season: 1, tick: 120, player: 'b', avatar: 'pootah', power: 'hire_police', target_citizen: null, target_zone: null, px: 30, py: 26 },
    { season: 1, tick: 150, player: 'a', avatar: 'pootah', power: 'settle_f', target_citizen: null, target_zone: null, px: 22, py: 62 },
  ]
  const bare = (x: Shared) => JSON.stringify({ ...x.world, savedAt: 0 })

  // เดินรวดเดียว vs เดินทีละท่อน ต้องได้เมืองเดียวกัน (ของจริงคนหนึ่งเปิดค้างไว้ อีกคนเพิ่งเปิด)
  const one = createShared()
  enqueue(one, acts)
  advance(one, 300)

  const many = createShared()
  enqueue(many, acts)
  for (let t = 20; t <= 300; t += 20) advance(many, t)

  console.assert(bare(one) === bare(many), 'เดินรวดเดียวกับเดินทีละท่อนต้องได้เมืองเดียวกัน')
  const mid = createShared()
  enqueue(mid, acts)
  advance(mid, 150)
  console.assert(mid.world.agents.some((g) => g.by === 'a'), 'ตัวที่จ้างต้องรู้ว่าใครจ้าง')
  console.assert(one.joined.a === 60 && one.joined.b === 120, 'ต้องจำว่าใครโผล่มาตอน tick ไหน')
  // คนที่มาก่อนและไม่ได้ใช้อะไรเลย ต้องรวยกว่าคนที่เพิ่งมา
  const idle = createShared()
  enqueue(idle, [
    { ...acts[0], player: 'first', power: 'settle_f', tick: 5 },
    { ...acts[0], player: 'later', power: 'settle_f', tick: 250 },
  ])
  advance(idle, 300)
  console.assert(purseOf(idle, 'first') > purseOf(idle, 'later'), 'คนที่มาก่อนต้องมีศรัทธามากกว่า')

  const own = createShared()
  enqueue(own, [
    { ...acts[0], player: 'rich', tick: 10 },
    { ...acts[0], player: 'broke', power: 'hire_police', tick: 20 }, // เงินไม่พอ ต้องไม่ไปแย่งของคนอื่น
  ])
  advance(own, 100)
  console.assert(
    own.world.agents.every((g) => g.by === 'rich'),
    'การจ้างที่ล้มเหลวต้องไม่ไปเปลี่ยนเจ้าของตัวที่คนอื่นจ้างไว้',
  )

  const late = createShared()
  enqueue(late, [{ ...acts[0], player: 'z', tick: 280 }])
  advance(late, 300)
  console.assert(
    purseOf(late, 'z') < START_FAITH,
    'คนที่เพิ่งมา tick 280 ต้องไม่ได้ศรัทธาของ 280 tick ที่ผ่านมา (จ่ายค่าจ้างไปแล้วต้องเหลือน้อยกว่าทุนตั้งต้น)',
  )

  console.log('net selfCheck ผ่าน')
}

export const avatarName = (id: AvatarId) => AVATARS.find((a) => a.id === id)?.name ?? id
