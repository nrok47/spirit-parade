import { useEffect, useRef, useState } from 'react'
import './App.css'
import {
  AVATARS,
  SEASON_DAYS,
  ZONES,
  alive,
  avatarOf,
  cityFear,
  createWorld,
  load,
  runToNotable,
  save,
  seasonOver,
  selfCheck,
  step,
  castPower,
  type AvatarId,
  type Citizen,
  type Power,
  type World,
  type Zone,
} from './sim'

const SPEEDS = [0, 1, 4]
const BASE_MS = 2000 // 1 ชั่วโมงในเมือง = 2 วินาทีจริง

if (import.meta.env.DEV) selfCheck()

const fearColor = (f: number) => (f >= 70 ? '#e05b4a' : f >= 40 ? '#e0a13a' : '#5aa46a')

function AvatarPicker({ onPick }: { onPick: (id: AvatarId) => void }) {
  return (
    <div className="app picker">
      <h1>Spirit Parade</h1>
      <p className="lead">เมืองเดินของมันเอง คุณเลือกได้แค่ว่าจะเป็นใครในนั้น</p>
      <div className="cards">
        {AVATARS.map((a) => (
          <button key={a.id} className="card" onClick={() => onPick(a.id)}>
            <span className="icon">{a.icon}</span>
            <b>{a.name}</b>
            <span className="want">{a.want}</span>
            <span className="income">{a.income}</span>
            <span className="plist">{a.powers.map((p) => p.name).join(' · ')}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [w, setW] = useState<World | null>(() => load(BASE_MS))
  const [speed, setSpeed] = useState(1)
  const [aim, setAim] = useState<Power | null>(null) // พลังที่รอเลือกเป้า
  const ref = useRef(w)
  useEffect(() => {
    ref.current = w
  })

  const done = !!w && seasonOver(w)

  useEffect(() => {
    if (!SPEEDS[speed] || done) return
    const id = setInterval(() => {
      const cur = ref.current
      if (!cur || seasonOver(cur)) return
      const next = { ...cur }
      step(next)
      setW(next)
    }, BASE_MS / SPEEDS[speed])
    return () => clearInterval(id)
  }, [speed, done])

  useEffect(() => {
    const id = setInterval(() => ref.current && save(ref.current), 5000)
    const bye = () => ref.current && save(ref.current)
    window.addEventListener('beforeunload', bye)
    return () => {
      clearInterval(id)
      window.removeEventListener('beforeunload', bye)
    }
  }, [])

  if (!w) return <AvatarPicker onPick={(id) => setW(createWorld(Date.now() % 100000, id))} />

  const me = avatarOf(w)
  const people = alive(w)
  const fear = cityFear(w)
  const faith = Math.floor(w.faith)
  const dayNo = Math.floor(w.tick / 24) + 1

  const fire = (p: Power, c?: Citizen, z?: Zone) => {
    const next = { ...w }
    if (castPower(next, p.key, c, z)) setW(next)
    setAim(null)
  }

  const tapPower = (p: Power) => (p.target === 'none' ? fire(p) : setAim(aim?.key === p.key ? null : p))

  if (done) {
    const born = w.citizens.filter((c) => c.bornHere).length
    const left = w.citizens.filter((c) => c.gone).length
    return (
      <div className="app">
        <h1>จบฤดูที่ {w.season}</h1>
        <p className="lead">
          {me.icon} {me.name} · {SEASON_DAYS} วันผ่านไป
        </p>
        <div className="summary">
          <div className="stat big">
            <span>ประชากร</span>
            <b>{people.length}</b>
          </div>
          <div className="stat big">
            <span>ความกลัวเฉลี่ย</span>
            <b style={{ color: fearColor(fear) }}>{fear}</b>
          </div>
          <div className="stat">
            <span>ศรัทธาที่เหลือ</span>
            <b>{faith}</b>
          </div>
          <div className="stat">
            <span>เกิดในเมือง</span>
            <b>{born}</b>
          </div>
          <div className="stat">
            <span>หายไป</span>
            <b>{left}</b>
          </div>
        </div>
        <h3>เรื่องของฤดูนี้</h3>
        <ol className="log">
          {w.log
            .filter((l) => l.notable)
            .slice(0, 12)
            .map((l, i) => (
              <li key={`${l.t}-${i}`} className="notable">
                {l.text}
              </li>
            ))}
        </ol>
        <div className="powers">
          <button onClick={() => setW(createWorld((w.seed * 31 + 7) % 100000, w.avatar, w.season + 1))}>
            เริ่มฤดูที่ {w.season + 1}
          </button>
          <button onClick={() => setW(null)}>เปลี่ยนตัวละคร</button>
        </div>
      </div>
    )
  }

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
          <span>
            ฤดู {w.season} · วันที่
          </span>
          <b>
            {dayNo}
            <small>/{SEASON_DAYS}</small>
          </b>
        </div>
        <div className="me" title={me.income}>
          {me.icon} {me.name}
        </div>
        <div className="speeds">
          {['⏸', '▶', '⏩'].map((s, i) => (
            <button key={i} className={speed === i ? 'on' : ''} onClick={() => setSpeed(i)}>
              {s}
            </button>
          ))}
        </div>
      </header>

      <div className="powers">
        {me.powers.map((p) => (
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
        <button
          onClick={() => {
            const next = { ...w }
            runToNotable(next)
            setW(next)
          }}
        >
          ⏭ ข้ามไปเรื่องถัดไป
        </button>
        <span className="hint">
          {aim ? `เลือก${aim.target === 'zone' ? 'ย่าน' : 'คน'}ที่จะ${aim.name}` : me.want}
        </span>
      </div>

      <div className="zones">
        {ZONES.map((z) => {
          const on = (w.wards[z] ?? 0) > w.tick
          const pickable = aim?.target === 'zone'
          return (
            <button
              key={z}
              className={`zone ${on ? 'warded' : ''} ${pickable ? 'pick' : ''}`}
              onClick={() => pickable && fire(aim, undefined, z as Zone)}
            >
              {on ? '🪬 ' : ''}
              {z}
            </button>
          )
        })}
      </div>

      <main>
        <ul className="citizens">
          {w.citizens.map((c) => {
            const pickable = aim?.target === 'citizen' && !c.gone
            return (
              <li key={c.id} className={c.gone ? 'gone' : ''}>
                <button className={pickable ? 'pick' : ''} disabled={!pickable} onClick={() => pickable && fire(aim, c)}>
                  <span className="who">
                    {c.spirit ? '👻' : '🧍'} {c.name}
                    {(w.haunt[c.id] ?? 0) > w.tick ? ' 🕯' : ''}
                  </span>
                  <span className="job">
                    {c.job} · {c.zone} · {c.trait}
                    {c.partner !== null ? ' 💍' : ''}
                    {c.bornHere ? ' ✨' : ''}
                  </span>
                  <span className="bar">
                    <i style={{ width: `${c.fear}%`, background: fearColor(c.fear) }} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <ol className="log">
          {w.log.map((l, i) => (
            <li key={`${l.t}-${i}`} className={l.notable ? 'notable' : ''}>
              {l.text}
            </li>
          ))}
        </ol>
      </main>
    </div>
  )
}
