import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import {
  AGENT_RADIUS,
  BOARD,
  HIRE,
  RADIUS,
  ZONES,
  ZONE_POS,
  alive,
  avatarOf,
  castPower,
  calendar,
  cityFear,
  citizenInRange,
  createWorld,

  inRange,
  load,
  moveTo,
  powersOf,
  runToNotable,
  save,
  selfCheck,
  step,
  type Citizen,
  type Power,
  type World,
  type Zone,
} from './sim'
import {
  APPLY_LAG,
  MS_PER_TICK,
  SEASON,
  advance,
  clearPin,
  createShared,
  enqueue,
  fetchActions,
  getPin,
  me,
  netSelfCheck,
  nowTick,
  purseOf,
  sendAction,
  setPin,
  type Action,
  type Shared,
} from './net'

const SPEEDS = [0, 1, 4]
const BASE_MS = 2000 // เมืองส่วนตัว: 1 ชั่วโมงในเมือง = 2 วินาทีจริง (เมืองร่วมใช้ MS_PER_TICK ซึ่งช้ากว่า)

if (import.meta.env.DEV) {
  selfCheck()
  netSelfCheck()
}

const fearColor = (f: number) => (f >= 70 ? '#e05b4a' : f >= 40 ? '#e0a13a' : '#5aa46a')

function PinGate({ onEnter }: { onEnter: (pin: string) => void }) {
  const [pin, setPin_] = useState('')
  const ok = /^\d{3,6}$/.test(pin)
  return (
    <div className="app picker">
      <h1>Spirit Parade</h1>
      <p className="lead">ใส่เลขของตัวเองไว้จำเมือง — ตั้งเองได้ ไม่มีรหัสผ่าน</p>
      <form
        className="pinbox"
        onSubmit={(e) => {
          e.preventDefault()
          if (ok) onEnter(pin)
        }}
      >
        <input
          autoFocus
          inputMode="numeric"
          placeholder="เช่น 123"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin_(e.target.value.replace(/\D/g, ''))}
        />
        <button disabled={!ok}>เข้าเมือง</button>
      </form>
      <p className="lead small">เลขเดิม = เมืองเดิมและศรัทธาเดิม · เลขใหม่ = เริ่มเมืองใหม่</p>
    </div>
  )
}

export default function App() {
  const [pin, setPinState] = useState<string | null>(() => getPin())
  const [mode, setMode] = useState<'local' | 'shared'>(
    () => (localStorage.getItem('sp-mode') as 'local' | 'shared') ?? 'local',
  )
  const [w, setW] = useState<World | null>(() => {
    const p = getPin()
    return p ? (load(BASE_MS, p) ?? createWorld(Date.now() % 100000)) : null
  })
  const [speed, setSpeed] = useState(1)
  const [aim, setAim] = useState<Power | null>(null)

  // --- โลกร่วม ---
  const [shared, setShared] = useState<World | null>(null)
  const [netErr, setNetErr] = useState<string | null>(null)
  const [players, setPlayers] = useState<string[]>([])
  const [myFaith, setMyFaith] = useState(0)
  const sh = useRef<Shared | null>(null) // โลกร่วมเดินต่อในนี้ ไม่สร้างใหม่ทุก tick
  const lastId = useRef(0)
  const [myPos, setMyPos] = useState({ x: ZONE_POS['ศาลปู่ตา'][0], y: ZONE_POS['ศาลปู่ตา'][1] })

  const ref = useRef(w)
  useEffect(() => {
    ref.current = w
  })
  const posRef = useRef(myPos)
  useEffect(() => {
    posRef.current = myPos
  }, [myPos])

  // เดินโลกร่วมไปจนถึงเวลาจริง แล้วเอาผลมาแสดง (ไม่สร้างโลกใหม่ทั้งใบ)
  const tickShared = useCallback(() => {
    const s = sh.current
    if (!s) return
    advance(s, nowTick())
    s.world.pos = posRef.current
    setShared({ ...s.world })
    setPlayers(Object.keys(s.joined))
    setMyFaith(purseOf(s, me()))
  }, [])

  // โลกร่วม: ดึงเฉพาะของใหม่ทุก 8 วินาที · เดินเวลาเองทุก tick
  useEffect(() => {
    if (mode !== 'shared') return
    let dead = false
    if (!sh.current) {
      sh.current = createShared()
      lastId.current = 0
    }
    const pull = async () => {
      try {
        const list = await fetchActions(lastId.current)
        if (dead || !sh.current) return
        setNetErr(null)
        if (list.length) {
          lastId.current = Math.max(lastId.current, ...list.map((a) => (a as Action & { id: number }).id ?? 0))
          enqueue(sh.current, list)
        }
        tickShared()
      } catch (e) {
        if (!dead) setNetErr((e as Error).message)
      }
    }
    pull()
    const p = setInterval(pull, 8000)
    const t = setInterval(tickShared, MS_PER_TICK)
    return () => {
      dead = true
      clearInterval(p)
      clearInterval(t)
    }
  }, [mode, tickShared])

  useEffect(() => {
    if (mode !== 'local' || !SPEEDS[speed]) return
    const id = setInterval(() => {
      const cur = ref.current
      if (!cur) return
      const next = { ...cur }
      step(next)
      setW(next)
    }, BASE_MS / SPEEDS[speed])
    return () => clearInterval(id)
  }, [speed, mode])

  useEffect(() => {
    if (!pin) return
    const id = setInterval(() => ref.current && save(ref.current, pin), 5000)
    const bye = () => ref.current && save(ref.current, pin)
    window.addEventListener('beforeunload', bye)
    return () => {
      clearInterval(id)
      window.removeEventListener('beforeunload', bye)
    }
  }, [pin])

  const switchMode = (m: 'local' | 'shared') => {
    localStorage.setItem('sp-mode', m)
    setMode(m)
    setAim(null)
  }

  if (!pin)
    return (
      <PinGate
        onEnter={(v) => {
          setPin(v)
          setPinState(v)
          setW(load(BASE_MS, v) ?? createWorld(Date.now() % 100000))
        }}
      />
    )

  const view = mode === 'shared' ? shared : w
  if (!view)
    return (
      <div className="app picker">
        <h1>กำลังต่อเข้าเมืองร่วม…</h1>
        {netErr && <p className="lead err">{netErr}</p>}
        <div className="powers">
          <button onClick={() => switchMode('local')}>กลับไปเล่นเมืองของตัวเอง</button>
        </div>
      </div>
    )

  const me_ = avatarOf(view)
  const people = alive(view)
  const fear = cityFear(view)
  const faith = Math.floor(mode === 'shared' ? myFaith : view.faith)
  const cal = calendar(view)

  const fire = (p: Power, c?: Citizen, z?: Zone) => {
    if (mode === 'local') {
      const next = { ...w! }
      if (castPower(next, p.key, c, z)) setW(next)
      setAim(null)
      return
    }
    // โลกร่วม: ลองในเครื่องก่อน ผ่านแล้วค่อยส่งขึ้นไป
    // ต้อง clone ลึก — { ...view } แชร์ citizens/agents/log กับของจริง การลองจะไปแก้เมืองที่แสดงอยู่
    const probe = structuredClone(view)
    if (!castPower(probe, p.key, c, z)) {
      setAim(null)
      return
    }
    const a: Action = {
      season: SEASON,
      tick: nowTick(),
      player: me(),
      avatar: 'pootah',
      power: p.key,
      target_citizen: c?.id ?? null,
      target_zone: z ?? null,
      px: myPos.x,
      py: myPos.y,
    }
    setAim(null)
    // ของตัวเองก็เข้าคิวเหมือนของคนอื่น จะได้เห็นผลตอนเดียวกับที่เครื่องอื่นเห็น
    if (sh.current) enqueue(sh.current, [a])
    sendAction(a).catch((e) => setNetErr((e as Error).message))
  }

  const tapPower = (p: Power) => (p.target === 'none' ? fire(p) : setAim(aim?.key === p.key ? null : p))

  const onBoard = (e: React.MouseEvent<SVGSVGElement>) => {
    if (aim) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * BOARD
    const y = ((e.clientY - r.top) / r.height) * BOARD
    if (mode === 'shared') {
      setMyPos({ x: Math.round(x), y: Math.round(y) })
      const next = { ...view }
      moveTo(next, x, y)
      setShared(next)
      return
    }
    const next = { ...w! }
    moveTo(next, x, y)
    setW(next)
  }

  const others = players.filter((id) => id !== me())

  return (
    <div className="app">
      <header>
        <div className="stat big">
          <span>ประชากร</span>
          <b>{people.length}</b>
        </div>
        <div className="stat big">
          <span>ความกลัว</span>
          <b style={{ color: fearColor(fear) }}>{fear}</b>
        </div>
        <div className="stat">
          <span>ศรัทธา</span>
          <b>{faith}</b>
        </div>
        <div className="stat">
          <span>ปีที่</span>
          <b>{cal.year}</b>
        </div>
        <div className="stat">
          <span>วันที่</span>
          <b>{cal.day}</b>
        </div>
        <div className="me" title={me_.income}>
          {me_.icon} {me_.name}
        </div>
        <button
          className="pinchip"
          title="เปลี่ยนเลขผู้เล่น"
          onClick={() => {
            if (w) save(w, pin)
            clearPin()
            setPinState(null)
          }}
        >
          #{pin}
        </button>
        <div className="speeds">
          <button className={mode === 'local' ? 'on' : ''} onClick={() => switchMode('local')} title="เมืองของตัวเอง">
            🏠
          </button>
          <button className={mode === 'shared' ? 'on' : ''} onClick={() => switchMode('shared')} title="เมืองร่วม">
            🌐
          </button>
          {mode === 'local' &&
            ['⏸', '▶', '⏩'].map((s, i) => (
              <button key={i} className={speed === i ? 'on' : ''} onClick={() => setSpeed(i)}>
                {s}
              </button>
            ))}
        </div>
      </header>

      {mode === 'shared' && (
        <div className="netbar">
          {netErr ? (
            <span className="err">⚠ {netErr}</span>
          ) : (
            <span>
              เมืองร่วม · เวลาเดินตามจริง ไม่มีวันจบ · ของที่กดจะเข้าเมืองใน {(APPLY_LAG * MS_PER_TICK) / 1000} วินาที · คนอื่นในเมืองนี้{' '}
              {others.length ? others.join(' · ') : 'ยังไม่มีใคร'}
            </span>
          )}
        </div>
      )}

      <div className="powers">
        {powersOf(view).map((p) => (
          <button
            key={p.key}
            title={p.hint}
            disabled={faith < p.cost}
            className={aim?.key === p.key ? 'on' : ''}
            onClick={() => tapPower(p)}
          >
            {p.name} · {p.cost}
          </button>
        ))}
        {mode === 'local' && (
          <button
            onClick={() => {
              const next = { ...w! }
              runToNotable(next)
              setW(next)
            }}
          >
            ⏭ ข้ามไปเรื่องถัดไป
          </button>
        )}
        <span className="hint">
          {aim
            ? `เลือก${aim.target === 'zone' ? 'ย่าน' : 'คน'}ในวง เพื่อ${aim.name}`
            : 'คลิกกระดานเพื่อย้ายไปยืนที่นั่น แล้วจ้างคนลงตรงนั้น — เขาจะทำงานของเขาเอง'}
        </span>
      </div>

      <div className="zones">
        {ZONES.map((z) => {
          const on = (view.wards[z] ?? 0) > view.tick
          const near = inRange(view, ZONE_POS[z][0], ZONE_POS[z][1])
          const pickable = aim?.target === 'zone' && near
          return (
            <button
              key={z}
              disabled={aim?.target === 'zone' && !near}
              className={`zone ${on ? 'warded' : ''} ${pickable ? 'pick' : ''} ${near ? '' : 'far'}`}
              onClick={() => pickable && fire(aim, undefined, z as Zone)}
            >
              {on ? '🪬 ' : ''}
              {z}
            </button>
          )
        })}
      </div>

      <main>
        <svg className="board" viewBox={`0 0 ${BOARD} ${BOARD}`} onClick={onBoard}>
          <rect x="0" y="0" width={BOARD} height={BOARD} className="ground" />
          {ZONES.map((z) => (
            <text key={z} x={ZONE_POS[z][0]} y={ZONE_POS[z][1]} className="zlabel">
              {z}
            </text>
          ))}

          <circle cx={view.pos.x} cy={view.pos.y} r={RADIUS} className="halo" />

          {view.houses.map((h) => {
            const mem = h.members.map((id) => view.citizens.find((c) => c.id === id)).filter((c): c is Citizen => !!c)
            const hot = Math.max(0, ...mem.map((c) => c.fear))
            const warded = (view.wards[h.zone] ?? 0) > view.tick
            return (
              <g key={h.id}>
                <rect
                  x={h.x - 2.4}
                  y={h.y - 2.4}
                  width="4.8"
                  height="4.8"
                  rx="1"
                  className={`house ${warded ? 'warded' : ''}`}
                  style={{ stroke: fearColor(hot) }}
                />
                {mem.map((c, i) => {
                  const cx = h.x + (i - (mem.length - 1) / 2) * 3.2
                  const cy = h.y + 5.4
                  const pickable = aim?.target === 'citizen' && citizenInRange(view, c)
                  return (
                    <circle
                      key={c.id}
                      cx={cx}
                      cy={cy}
                      r={pickable ? 2.4 : 1.7}
                      className={`dot ${c.spirit ? 'spirit' : ''} ${pickable ? 'pick' : ''}`}
                      style={{ fill: fearColor(c.fear) }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (pickable) fire(aim, c)
                      }}
                    >
                      <title>{`${c.spirit ? '👻' : '🧍'} ${c.name} · ${c.job} · ${c.trait} · กลัว ${Math.round(
                        c.fear,
                      )}${(view.haunt[c.id] ?? 0) > view.tick ? ' · ถูกตามติด' : ''}`}</title>
                    </circle>
                  )
                })}
              </g>
            )
          })}

          {view.agents.map((a) => (
            <g key={a.id} className={`agent ${a.kind}`}>
              <circle cx={a.x} cy={a.y} r={AGENT_RADIUS} className="arange" />
              <circle cx={a.x} cy={a.y} r="2.8" />
              <text x={a.x} y={a.y + 1.4}>
                {HIRE[a.kind].icon}
                <title>{`${HIRE[a.kind].name} · เหลืออีก ${Math.max(0, Math.ceil((a.until - view.tick) / 24))} วัน`}</title>
              </text>
            </g>
          ))}

          <g className="avatar" transform={`translate(${view.pos.x} ${view.pos.y})`}>
            <circle r="3.4" />
            <text y="1.6">{me_.icon}</text>
          </g>
        </svg>

        <ul className="roster" title="คนที่จางคืออยู่นอกวงที่เอื้อมถึง">
          {people.map((c) => (
            <li
              key={c.id}
              className={citizenInRange(view, c) ? '' : 'out'}
              title={`${c.job} · ${c.zone} · ${c.trait} · ${c.sex} · กลัว ${Math.round(c.fear)}`}
            >
              <span className="nm">
                {c.spirit ? '👻' : '🧍'} {c.name}
              </span>
              <i style={{ background: fearColor(c.fear) }} />
              <span className="mk">
                {c.partner !== null ? '💍' : ''}
                {c.bornHere ? '✨' : ''}
                {(view.haunt[c.id] ?? 0) > view.tick ? '🕯' : ''}
              </span>
            </li>
          ))}
        </ul>

        <ol className="log">
          {view.log.map((l, i) => (
            <li key={`${l.t}-${i}`} className={l.notable ? 'notable' : ''}>
              {l.text}
            </li>
          ))}
        </ol>
      </main>

    </div>
  )
}
