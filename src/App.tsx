import { useEffect, useRef, useState } from 'react'
import './App.css'
import {
  COST,
  ZONES,
  alive,
  cityFear,
  load,
  nudge,
  omen,
  save,
  selfCheck,
  step,
  ward,
  type World,
  type Zone,
} from './sim'

const SPEEDS = [0, 1, 4] // หยุด / ปกติ / เร่ง
const BASE_MS = 2000 // 1 ชั่วโมงในเมือง = 2 วินาทีจริง

if (import.meta.env.DEV) selfCheck()

function fearColor(f: number) {
  if (f >= 70) return '#e05b4a'
  if (f >= 40) return '#e0a13a'
  return '#5aa46a'
}

export default function App() {
  const [w, setW] = useState<World>(() => load(BASE_MS))
  const [speed, setSpeed] = useState(1)
  const [mode, setMode] = useState<'none' | 'ward'>('none')
  const ref = useRef(w)
  ref.current = w

  useEffect(() => {
    if (!SPEEDS[speed]) return
    const id = setInterval(() => {
      const next = { ...ref.current }
      step(next)
      setW(next)
    }, BASE_MS / SPEEDS[speed])
    return () => clearInterval(id)
  }, [speed])

  useEffect(() => {
    const id = setInterval(() => save(ref.current), 5000)
    const bye = () => save(ref.current)
    window.addEventListener('beforeunload', bye)
    return () => {
      clearInterval(id)
      window.removeEventListener('beforeunload', bye)
    }
  }, [])

  const act = (fn: (x: World) => boolean) => {
    const next = { ...w }
    if (fn(next)) setW(next)
  }

  const people = alive(w)
  const fear = cityFear(w)
  const faith = Math.floor(w.faith)

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
          <span>วันที่</span>
          <b>{Math.floor(w.tick / 24) + 1}</b>
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
        <button disabled={faith < COST.ward} className={mode === 'ward' ? 'on' : ''} onClick={() => setMode(mode === 'ward' ? 'none' : 'ward')}>
          ปกปัก · {COST.ward} — เลือกย่าน
        </button>
        <button disabled={faith < COST.omen} onClick={() => act(omen)}>
          ให้ลาง · {COST.omen}
        </button>
        <span className="hint">คลิกชื่อชาวเมือง = ดลใจ ({COST.nudge})</span>
      </div>

      <div className="zones">
        {ZONES.map((z) => {
          const w4 = (w.wards[z] ?? 0) > w.tick
          return (
            <button
              key={z}
              className={`zone ${w4 ? 'warded' : ''} ${mode === 'ward' ? 'pick' : ''}`}
              onClick={() => {
                if (mode !== 'ward') return
                act((x) => ward(x, z as Zone))
                setMode('none')
              }}
            >
              {w4 ? '🪬 ' : ''}
              {z}
            </button>
          )
        })}
      </div>

      <main>
        <ul className="citizens">
          {w.citizens.map((c) => (
            <li key={c.id} className={c.gone ? 'gone' : ''}>
              <button disabled={c.gone || faith < COST.nudge} onClick={() => act((x) => nudge(x, c.id))}>
                <span className="who">
                  {c.spirit ? '👻' : '🧍'} {c.name}
                </span>
                <span className="job">
                  {c.job} · {c.zone}
                </span>
                <span className="bar">
                  <i style={{ width: `${c.fear}%`, background: fearColor(c.fear) }} />
                </span>
              </button>
            </li>
          ))}
        </ul>

        <ol className="log">
          {w.log.map((l, i) => (
            <li key={w.tick - i}>{l}</li>
          ))}
        </ol>
      </main>
    </div>
  )
}
