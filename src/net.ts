// โลกร่วม — ไม่มี game server
// sim เป็น deterministic อยู่แล้ว (ดูกฎเหล็กใน context.md) ทุกเครื่องจึงคำนวณเมืองเดียวกันได้เอง
// server เก็บแค่ "รายการของที่คนใส่" แบบ append-only แล้ว replay ทับ
// anon key เป็น public โดยออกแบบ (อยู่ใน bundle ของทุก client อยู่แล้ว) ตัวกันจริงคือ RLS — ดู db/shared-world.sql

import {
  AVATARS,
  SEASON_DAYS,
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

export const MS_PER_TICK = 2000
export const TICKS_PER_SEASON = SEASON_DAYS * 24 // 720 tick = 24 นาทีจริงต่อฤดู
const EPOCH = Date.UTC(2026, 8, 8) // จุดอ้างเวลาของโลกร่วม — ห้ามเปลี่ยน ไม่งั้นเลขฤดูเลื่อนหมด

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

/** ฤดูและ tick ปัจจุบันคำนวณจากเวลาจริง ไม่ต้องถาม server */
export function now() {
  const t = Math.floor((Date.now() - EPOCH) / MS_PER_TICK)
  return { season: Math.floor(t / TICKS_PER_SEASON) + 1, tick: t % TICKS_PER_SEASON }
}

export const seasonSeed = (season: number) => (season * 7919 + 104729) % 100000

/** ชื่อผู้เล่นเก็บในเครื่อง — ยังไม่มีระบบ login */
export function me(): string {
  let id = localStorage.getItem('sp-player')
  if (!id) {
    id = 'p' + Math.random().toString(36).slice(2, 8)
    localStorage.setItem('sp-player', id)
  }
  return id
}

const headers = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }

export async function fetchActions(season: number): Promise<Action[]> {
  const res = await fetch(`${URL}/rest/v1/actions?season=eq.${season}&order=tick.asc,id.asc&select=*`, { headers })
  if (!res.ok) throw new Error(`โหลดโลกร่วมไม่สำเร็จ (${res.status})`)
  return res.json()
}

export async function sendAction(a: Action) {
  const res = await fetch(`${URL}/rest/v1/actions`, { method: 'POST', headers, body: JSON.stringify(a) })
  if (!res.ok) throw new Error(`ส่งไม่สำเร็จ (${res.status})`)
}

export type Shared = { world: World; purse: Record<string, number>; avatars: Record<string, AvatarId> }

/**
 * สร้างสถานะโลกร่วม ณ tick ที่ต้องการ จาก seed ของฤดู + รายการที่คนใส่
 * ผลลัพธ์ต้องเหมือนกันทุกเครื่อง — ห้ามใส่อะไรที่ไม่ deterministic ในนี้
 */
export function replay(
  season: number,
  upTo: number,
  actions: Action[],
  viewer: string,
  viewerAvatar: AvatarId,
): Shared {
  const avatars: Record<string, AvatarId> = { [viewer]: viewerAvatar }
  for (const a of actions) avatars[a.player] = a.avatar
  avatars[viewer] = viewerAvatar
  const w = createWorld(seasonSeed(season), viewerAvatar, season)
  w.shared = true
  w.savedAt = 0 // โลกร่วมไม่ใช้เวลาเครื่อง — ต้องไม่มี Date.now() ติดอยู่ใน state ที่เอาไปเทียบกัน
  const purse: Record<string, number> = {}
  const players = () => Object.keys(avatars)
  for (const p of players()) purse[p] = 30

  let i = 0
  for (let t = 0; t < upTo; t++) {
    step(w)
    const r = rngFor(w.seed + w.tick * 104729)
    for (const p of players()) {
      purse[p] = (purse[p] ?? 30) + income(w, avatars[p], r)
      if (w.tick % 24 === 0) purse[p] = Math.max(0, purse[p] * 0.97)
    }
    // ใส่ของที่คนอื่นทำไว้ ณ tick นี้
    while (i < actions.length && actions[i].tick <= w.tick) {
      const a = actions[i++]
      const keep = { avatar: w.avatar, faith: w.faith, pos: w.pos }
      w.avatar = a.avatar
      w.faith = purse[a.player] ?? 30
      moveTo(w, a.px, a.py)
      castPower(
        w,
        a.power,
        a.target_citizen === null ? undefined : w.citizens.find((c) => c.id === a.target_citizen),
        (a.target_zone as Zone) ?? undefined,
      )
      purse[a.player] = w.faith
      w.avatar = keep.avatar
      w.faith = keep.faith
      w.pos = keep.pos
    }
  }
  w.faith = purse[viewer] ?? 30
  w.avatar = viewerAvatar
  return { world: w, purse, avatars }
}

export const avatarName = (id: AvatarId) => AVATARS.find((a) => a.id === id)?.name ?? id

// ponytail: กันโลกแตก — replay ด้วย input เดียวกันต้องได้เมืองเดียวกันเป๊ะ
export function netSelfCheck() {
  const acts: Action[] = [
    { season: 3, tick: 10, player: 'a', avatar: 'ghost', power: 'scare', target_citizen: 0, target_zone: null, px: 22, py: 62 },
    { season: 3, tick: 40, player: 'b', avatar: 'police', power: 'patrol', target_citizen: null, target_zone: 'ซอยใน', px: 22, py: 62 },
    { season: 3, tick: 90, player: 'a', avatar: 'ghost', power: 'haunt', target_citizen: 6, target_zone: null, px: 22, py: 62 },
  ]
  const x = replay(3, 200, acts, 'a', 'ghost')
  const y = replay(3, 200, acts, 'a', 'ghost')
  console.assert(JSON.stringify(x.world) === JSON.stringify(y.world), 'replay ต้อง deterministic — เมืองห้ามแตกกัน')
  const z = replay(3, 200, acts, 'b', 'police')
  console.assert(
    JSON.stringify(x.world.citizens) === JSON.stringify(z.world.citizens),
    'คนละคนดูเมืองเดียวกันต้องเห็นชาวเมืองเหมือนกัน',
  )
  console.assert(x.purse.a !== z.purse.b, 'ศรัทธาเป็นของแต่ละคน ไม่ใช่ของเมือง')
  console.log('net selfCheck ผ่าน')
}
