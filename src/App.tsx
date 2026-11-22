
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, BookOpen, Edit3, Archive, RotateCcw,
  Upload, CalendarDays, ChartNoAxesCombined, Clock3,
  Download, Home, Pause, Play, Plus, Save,
  Settings2, Trash2, Volume2, Music2
} from 'lucide-react';

import {
  Exercise, RecordItem, Settings, categories,
  initialExercises, initialSettings, nextBpm,
  plan, recent, todayKey
} from './engine';

import { Metronome } from './metronome';
import Curriculum from './Curriculum';

type Tab = 'home' | 'library' | 'curriculum' | 'history' | 'settings';

type Draft = {
  name: string;
  category: string;
  description: string;
  targetBpm: number;
  minutes: number;
  priority: number;
};

const blankDraft: Draft = {
  name: '',
  category: 'Hands',
  description: '',
  targetBpm: 80,
  minutes: 15,
  priority: 1
};

const bounded = (value: number, min: number, max: number) =>
  Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value)))
    : min;

function validBackup(value: unknown): value is {
  exercises: Exercise[];
  records: RecordItem[];
  settings: Settings;
} {
  if (!value || typeof value !== 'object') return false;

  const v = value as Record<string, unknown>;

  return (
    Array.isArray(v.exercises) &&
    v.exercises.every((e: unknown) => {
      if (!e || typeof e !== 'object') return false;
      const x = e as Record<string, unknown>;
      return (
        typeof x.id === 'string' &&
        typeof x.name === 'string' &&
        typeof x.category === 'string' &&
        typeof x.description === 'string' &&
        typeof x.targetBpm === 'number' &&
        typeof x.minutes === 'number' &&
        typeof x.priority === 'number'
      );
    }) &&
    Array.isArray(v.records) &&
    v.records.every((r: unknown) => {
      if (!r || typeof r !== 'object') return false;
      const x = r as Record<string, unknown>;
      return (
        typeof x.id === 'string' &&
        typeof x.exerciseId === 'string' &&
        typeof x.date === 'string' &&
        typeof x.bpm === 'number' &&
        typeof x.accuracy === 'number' &&
        typeof x.errors === 'number' &&
        typeof x.seconds === 'number' &&
        typeof x.notes === 'string'
      );
    }) &&
    !!v.settings &&
    typeof v.settings === 'object' &&
    typeof (v.settings as Settings).dailyMinutes === 'number' &&
    typeof (v.settings as Settings).practiceDays === 'number' &&
    typeof (v.settings as Settings).reminderTime === 'string'
  );
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) as T : fallback;
  } catch {
    return fallback;
  }
}

const id = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random()}`;

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showArchived, setShowArchived] = useState(false);

  const importRef = useRef<HTMLInputElement>(null);

  const [exercises, setExercises] = useState<Exercise[]>(
    () => load('drum.exercises.v1', initialExercises)
  );

  const [records, setRecords] = useState<RecordItem[]>(
    () => load('drum.records.v1', [])
  );

  const [settings, setSettings] = useState<Settings>(
    () => load('drum.settings.v1', initialSettings)
  );

  const [active, setActive] = useState<string | null>(null);
  const [bpm, setBpm] = useState(100);
  const [accuracy, setAccuracy] = useState(95);
  const [errors, setErrors] = useState(0);
  const [notes, setNotes] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [clicking, setClicking] = useState(false);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [message, setMessage] = useState('');

  const metro = useRef(new Metronome());
  const startedAt = useRef<number | null>(null);
  const elapsed = useRef(0);

  // Preserve existing V1 storage keys.
  useEffect(() => {
    localStorage.setItem('drum.exercises.v1', JSON.stringify(exercises));
  }, [exercises]);

  useEffect(() => {
    localStorage.setItem('drum.records.v1', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('drum.settings.v1', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(() => {
      setSeconds(
        Math.floor(
          elapsed.current +
          (startedAt.current
            ? (Date.now() - startedAt.current) / 1000
            : 0)
        )
      );
    }, 250);

    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => () => metro.current.stop(), []);

  const visibleExercises = exercises.filter(
    e =>
      (showArchived || !e.archived) &&
      (categoryFilter === 'All' || e.category === categoryFilter)
  );

  const allCategories = Array.from(
    new Set([...categories, ...exercises.map(e => e.category)])
  );

  const planned = useMemo(
    () => plan(exercises, records, settings.dailyMinutes),
    [exercises, records, settings.dailyMinutes]
  );

  const current = exercises.find(x => x.id === active);

  const todayRecords = records.filter(
    r => r.date.slice(0, 10) === todayKey()
  );

  const todaySeconds = todayRecords.reduce(
    (a, r) => a + r.seconds, 0
  );

  const totalSeconds = records.reduce(
    (a, r) => a + r.seconds, 0
  );

  function openSession(e: Exercise) {
    setActive(e.id);
    setBpm(e.targetBpm);
    setAccuracy(95);
    setErrors(0);
    setNotes('');
    setSeconds(0);
    elapsed.current = 0;
    startedAt.current = null;
    setRunning(false);
    metro.current.stop();
    setClicking(false);
    setMessage('');
  }

  function toggleTimer() {
    if (running) {
      elapsed.current = seconds;
      startedAt.current = null;
      setRunning(false);
    } else {
      startedAt.current = Date.now();
      setRunning(true);
    }
  }

  async function toggleClick() {
    if (clicking) {
      metro.current.stop();
      setClicking(false);
    } else {
      try {
        await metro.current.start(bpm, beatsPerBar);
        setClicking(true);
      } catch {
        setMessage(
          'ไม่สามารถเปิดเสียง Metronome ได้ กรุณาตรวจสอบการตั้งค่าเสียง'
        );
      }
    }
  }

  function saveSession() {
    if (!current) return;

    const duration = running
      ? Math.floor(
          elapsed.current +
          (startedAt.current
            ? (Date.now() - startedAt.current) / 1000
            : 0)
        )
      : seconds;

    if (duration < 1) {
      setMessage('เริ่มจับเวลาซ้อมก่อนบันทึก');
      return;
    }

    const item: RecordItem = {
      id: id(),
      exerciseId: current.id,
      date: new Date().toISOString(),
      bpm,
      accuracy,
      errors,
      seconds: duration,
      notes
    };

    const updated = [...records, item];

    setRecords(updated);

    setExercises(
      exercises.map(e => ({
        ...e,
        targetBpm: nextBpm(e, updated)
      }))
    );

    metro.current.stop();
    setClicking(false);
    setRunning(false);
    setActive(null);
    setMessage('บันทึกการซ้อมเรียบร้อยแล้ว');
  }

  function editExercise(e?: Exercise) {
    setEditingId(e?.id ?? null);

    setDraft(
      e
        ? {
            name: e.name,
            category: e.category,
            description: e.description,
            targetBpm: e.targetBpm,
            minutes: e.minutes,
            priority: e.priority
          }
        : blankDraft
    );

    setShowEditor(true);
    setMessage('');
  }

  function saveExercise() {
    const name = draft.name.trim();

    if (!name) {
      setMessage('กรุณากรอกชื่อแบบฝึก');
      return;
    }

    if (name.length > 100) {
      setMessage('ชื่อแบบฝึกยาวเกิน 100 ตัวอักษร');
      return;
    }

    const clean = {
      name,
      category: draft.category.trim() || 'Other',
      description: draft.description.trim(),
      targetBpm: bounded(draft.targetBpm, 40, 240),
      minutes: bounded(draft.minutes, 1, 180),
      priority: bounded(draft.priority, 1, 3)
    };

    setExercises(old =>
      editingId
        ? old.map(e =>
            e.id === editingId ? { ...e, ...clean } : e
          )
        : [...old, { id: id(), ...clean }]
    );

    setShowEditor(false);
    setMessage(
      editingId ? 'อัปเดตแบบฝึกแล้ว' : 'เพิ่มแบบฝึกแล้ว'
    );
  }

  function archiveExercise(e: Exercise) {
    if (!confirm(
      `เก็บแบบฝึก ${e.name} ไว้ใน Archive? ประวัติการซ้อมจะยังอยู่`
    )) return;

    setExercises(old =>
      old.map(x =>
        x.id === e.id ? { ...x, archived: true } : x
      )
    );

    setMessage('เก็บแบบฝึกแล้ว (กู้คืนได้)');
  }

  function restoreExercise(e: Exercise) {
    setExercises(old =>
      old.map(x =>
        x.id === e.id ? { ...x, archived: false } : x
      )
    );

    setMessage('กู้คืนแบบฝึกแล้ว');
  }

  function deleteExercise(e: Exercise) {
    if (records.some(r => r.exerciseId === e.id)) {
      setMessage(
        'แบบฝึกนี้มีประวัติซ้อม จึงลบถาวรไม่ได้ ให้ใช้ Archive แทน'
      );
      return;
    }

    if (!confirm(`ลบ ${e.name} ถาวร?`)) return;

    setExercises(old => old.filter(x => x.id !== e.id));
    setMessage('ลบแบบฝึกแล้ว');
  }

  async function importData(file?: File) {
    if (!file) return;

    try {
      if (file.size > 5_000_000) {
        throw new Error('ไฟล์ใหญ่เกิน 5 MB');
      }

      const data: unknown = JSON.parse(await file.text());

      if (!validBackup(data)) {
        throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
      }

      if (!confirm(
        'นำเข้า Backup จะเขียนทับข้อมูลแบบฝึก ประวัติ และการตั้งค่าปัจจุบันทั้งหมด ควร Export สำรองก่อน ยืนยันหรือไม่?'
      )) return;

      const ids = new Set(data.exercises.map(e => e.id));

      if (ids.size !== data.exercises.length) {
        throw new Error('มี Exercise ID ซ้ำกัน');
      }

      setExercises(data.exercises);
      setRecords(data.records);
      setSettings(data.settings);
      setMessage('นำเข้า Backup สำเร็จ');
    } catch (err) {
      setMessage(
        `นำเข้าไม่สำเร็จ: ${
          err instanceof Error ? err.message : 'ไฟล์ไม่ถูกต้อง'
        }`
      );
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }

  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            exercises,
            records,
            settings
          },
          null,
          2
        )
      ],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `drum-practice-backup-${todayKey()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-icon">🥁</div>
          <div>
            <h1>Drum Practice OS</h1>
            <p>Adaptive Practice Studio · V2</p>
          </div>
        </div>
        <span className="offline">Local-first</span>
      </header>

      {message && (
        <div className="notice" role="status">
          {message}
          <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      {active && current ? (
        <main>
          <button
            className="back"
            onClick={() => {
              metro.current.stop();
              setClicking(false);
              setRunning(false);
              setActive(null);
            }}
          >
            ← กลับไปหน้าแรก
          </button>

          <section className="hero">
            <span className="eyebrow">PRACTICE SESSION</span>
            <h2>{current.name}</h2>
            <p>{current.description}</p>
            <span className="pill">{current.category}</span>
          </section>

          <section className="panel center">
            <div className="timer">
              {String(Math.floor(seconds / 60)).padStart(2, '0')}:
              {String(seconds % 60).padStart(2, '0')}
            </div>
            <p>เวลาซ้อมจริง</p>
            <button className="primary" onClick={toggleTimer}>
              {running ? <Pause size={18} /> : <Play size={18} />}
              {running ? 'หยุดชั่วคราว' : 'เริ่ม / ซ้อมต่อ'}
            </button>
          </section>

          <section className="panel">
            <div className="section-head">
              <h3><Volume2 size={19} /> Metronome</h3>
              <span>{beatsPerBar}/4</span>
            </div>

            <div className="bpm">
              <button
                disabled={clicking}
                onClick={() => setBpm(v => Math.max(40, v - 5))}
              >
                −5
              </button>

              <strong>{bpm} <small>BPM</small></strong>

              <button
                disabled={clicking}
                onClick={() => setBpm(v => Math.min(240, v + 5))}
              >
                +5
              </button>
            </div>

            <div className="inline">
              <label>
                Time signature
                <select
                  disabled={clicking}
                  value={beatsPerBar}
                  onChange={e =>
                    setBeatsPerBar(Number(e.target.value))
                  }
                >
                  <option value={3}>3/4</option>
                  <option value={4}>4/4</option>
                  <option value={5}>5/4</option>
                  <option value={6}>6/4</option>
                  <option value={7}>7/4</option>
                </select>
              </label>

              <button className="secondary" onClick={toggleClick}>
                {clicking ? 'หยุด Click' : 'เปิด Click'}
              </button>
            </div>

            <p className="hint">
              เสียง Click ใช้ Web Audio API
              และควรเปิดหน้าจอไว้ขณะซ้อม
            </p>
          </section>

          <section className="panel">
            <h3>ประเมินผลหลังซ้อม</h3>

            <label>
              Accuracy (ประเมินเอง) <b>{accuracy}%</b>
              <input
                type="range"
                min="0"
                max="100"
                value={accuracy}
                onChange={e =>
                  setAccuracy(Number(e.target.value))
                }
              />
            </label>

            <label>
              จำนวนครั้งที่ผิด
              <input
                type="number"
                min="0"
                max="999"
                value={errors}
                onChange={e =>
                  setErrors(Math.max(0, Number(e.target.value) || 0))
                }
              />
            </label>

            <label>
              บันทึกเพิ่มเติม
              <textarea
                placeholder="จังหวะไหนยังไม่มั่นคง? รู้สึกอย่างไร?"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </label>

            <button className="primary full" onClick={saveSession}>
              <Save size={18} /> บันทึก Session
            </button>
          </section>
        </main>
      ) : (
        <main>
          {tab === 'home' && (
            <>
              <section className="hero">
                <span className="eyebrow">TODAY'S PRACTICE</span>
                <h2>ฝึกให้ดีขึ้นทุกวัน</h2>
                <p>
                  ระบบจัดลำดับแบบฝึกตามความถี่ในการซ้อม
                  และผลประเมินย้อนหลัง
                </p>

                <div className="stats">
                  <div>
                    <strong>{Math.round(todaySeconds / 60)}</strong>
                    <span>นาทีวันนี้</span>
                  </div>
                  <div>
                    <strong>{settings.dailyMinutes}</strong>
                    <span>เป้าหมาย/วัน</span>
                  </div>
                  <div>
                    <strong>{records.length}</strong>
                    <span>Sessions</span>
                  </div>
                </div>

                <div className="progress">
                  <span
                    style={{
                      width: `${
                        Math.min(
                          100,
                          todaySeconds / 60 / settings.dailyMinutes * 100
                        )
                      }%`
                    }}
                  />
                </div>
              </section>

              <div className="section-head">
                <h3>
                  <CalendarDays size={19} /> Adaptive Plan วันนี้
                </h3>
                <span>
                  {planned.reduce((s, e) => s + e.minutes, 0)} นาที
                </span>
              </div>

              <div className="stack">
                {planned.map(e => (
                  <article className="exercise" key={e.id}>
                    <div>
                      <span className="tag">{e.category}</span>
                      <h4>{e.name}</h4>
                      <p>{e.description}</p>
                      <small>
                        {e.minutes} นาที · {e.targetBpm} BPM ·{' '}
                        {recent(records, e.id).length} sessions
                      </small>
                    </div>

                    <button
                      className="circle"
                      aria-label={`เริ่ม ${e.name}`}
                      onClick={() => openSession(e)}
                    >
                      <Play size={19} />
                    </button>
                  </article>
                ))}
              </div>

              <section className="panel">
                <div className="section-head">
                  <h3><Activity size={19} /> Adaptive Rules</h3>
                </div>
                <p className="hint">
                  ผ่าน 3 ครั้งติดกัน (≥95%, ผิด ≤2, BPM ถึงเป้า)
                  → +5 BPM · ต่ำกว่า 85% สองครั้งติด → −5 BPM
                  · มิฉะนั้นคงเดิม
                </p>
              </section>
            </>
          )}

          {tab === 'library' && (
            <>
              <div className="section-head">
                <h2>Exercise Library</h2>
                <span>
                  {exercises.filter(e => !e.archived).length} แบบฝึก
                </span>
              </div>

              <div className="library-actions">
                <button
                  className="primary"
                  onClick={() => editExercise()}
                >
                  <Plus size={17} /> เพิ่มแบบฝึก
                </button>

                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={e =>
                      setShowArchived(e.target.checked)
                    }
                  />
                  แสดง Archive
                </label>
              </div>

              <label>
                กรองตามหมวด
                <select
                  value={categoryFilter}
                  onChange={e =>
                    setCategoryFilter(e.target.value)
                  }
                >
                  <option value="All">ทุกหมวด</option>
                  {allCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              {showEditor && (
                <section className="panel editor">
                  <div className="section-head">
                    <h3>
                      {editingId ? 'แก้ไขแบบฝึก' : 'เพิ่มแบบฝึกใหม่'}
                    </h3>
                    <button
                      className="secondary"
                      onClick={() => setShowEditor(false)}
                    >
                      ปิด
                    </button>
                  </div>

                  <label>
                    ชื่อแบบฝึก
                    <input
                      maxLength={100}
                      value={draft.name}
                      onChange={e =>
                        setDraft(v => ({
                          ...v,
                          name: e.target.value
                        }))
                      }
                      placeholder="เช่น 6 Note Gospel Chops"
                    />
                  </label>

                  <label>
                    หมวดหมู่
                    <select
                      value={
                        allCategories.includes(draft.category)
                          ? draft.category
                          : 'Other'
                      }
                      onChange={e =>
                        setDraft(v => ({
                          ...v,
                          category: e.target.value
                        }))
                      }
                    >
                      {allCategories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    รายละเอียด
                    <textarea
                      value={draft.description}
                      onChange={e =>
                        setDraft(v => ({
                          ...v,
                          description: e.target.value
                        }))
                      }
                      placeholder="Pattern, sticking, goals..."
                    />
                  </label>

                  <div className="editor-grid">
                    <label>
                      BPM เป้าหมาย
                      <input
                        type="number"
                        min="40"
                        max="240"
                        value={draft.targetBpm}
                        onChange={e =>
                          setDraft(v => ({
                            ...v,
                            targetBpm: Number(e.target.value)
                          }))
                        }
                      />
                    </label>

                    <label>
                      นาทีต่อครั้ง
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={draft.minutes}
                        onChange={e =>
                          setDraft(v => ({
                            ...v,
                            minutes: Number(e.target.value)
                          }))
                        }
                      />
                    </label>
                  </div>

                  <label>
                    ความสำคัญ
                    <select
                      value={draft.priority}
                      onChange={e =>
                        setDraft(v => ({
                          ...v,
                          priority: Number(e.target.value)
                        }))
                      }
                    >
                      <option value={1}>1 — ปกติ</option>
                      <option value={2}>2 — สำคัญ</option>
                      <option value={3}>3 — เน้นเป็นพิเศษ</option>
                    </select>
                  </label>

                  <p className="hint">
                    การแก้ BPM เป้าหมายจะเปลี่ยนเป้าหมายครั้งต่อไป
                    แต่ไม่เปลี่ยนผลซ้อมย้อนหลัง
                  </p>

                  <button
                    className="primary full"
                    onClick={saveExercise}
                  >
                    <Save size={17} /> บันทึกแบบฝึก
                  </button>
                </section>
              )}

              <div className="stack">
                {visibleExercises.length === 0 && (
                  <section className="panel">
                    <p>ไม่มีแบบฝึกในหมวดที่เลือก</p>
                  </section>
                )}

                {visibleExercises.map(e => (
                  <article className="exercise" key={e.id}>
                    <div className="exercise-info">
                      <span className="tag">
                        {e.category}
                        {e.archived ? ' · Archived' : ''}
                      </span>
                      <h4>{e.name}</h4>
                      <p>{e.description}</p>
                      <small>
                        เป้าหมาย {e.targetBpm} BPM · {e.minutes} นาที ·{' '}
                        {recent(records, e.id).length} sessions
                      </small>

                      <div className="exercise-actions">
                        <button
                          className="mini"
                          onClick={() => editExercise(e)}
                        >
                          <Edit3 size={15} /> แก้ไข
                        </button>

                        {e.archived ? (
                          <button
                            className="mini"
                            onClick={() => restoreExercise(e)}
                          >
                            <RotateCcw size={15} /> กู้คืน
                          </button>
                        ) : (
                          <button
                            className="mini"
                            onClick={() => archiveExercise(e)}
                          >
                            <Archive size={15} /> Archive
                          </button>
                        )}

                        {!records.some(
                          r => r.exerciseId === e.id
                        ) && (
                          <button
                            className="mini danger"
                            onClick={() => deleteExercise(e)}
                          >
                            <Trash2 size={15} /> ลบ
                          </button>
                        )}
                      </div>
                    </div>

                    {!e.archived && (
                      <button
                        className="circle"
                        aria-label={`เริ่ม ${e.name}`}
                        onClick={() => openSession(e)}
                      >
                        <Play size={19} />
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}

          {/* New V2 MIDI Curriculum screen */}
          {tab === 'curriculum' && <Curriculum />}

          {tab === 'history' && (
            <>
              <div className="section-head">
                <h2>Practice History</h2>
                <span>
                  {Math.round(totalSeconds / 60)} นาทีรวม
                </span>
              </div>

              {records.length === 0 ? (
                <section className="panel">
                  <p>
                    ยังไม่มีประวัติการซ้อม
                    เริ่ม Session แรกจากหน้า Today ได้เลย
                  </p>
                </section>
              ) : (
                <div className="stack">
                  {[...records]
                    .sort((a, b) =>
                      b.date.localeCompare(a.date)
                    )
                    .map(r => (
                      <article className="exercise" key={r.id}>
                        <div>
                          <h4>
                            {exercises.find(
                              e => e.id === r.exerciseId
                            )?.name ?? 'Exercise'}
                          </h4>

                          <p>
                            {new Date(r.date).toLocaleString('th-TH')}
                          </p>

                          <small>
                            {r.bpm} BPM · Accuracy {r.accuracy}%
                            {' · '}ผิด {r.errors}
                            {' · '}{Math.round(r.seconds / 60)} นาที
                          </small>

                          {r.notes && <p>{r.notes}</p>}
                        </div>

                        <button
                          className="circle subtle"
                          aria-label="ลบ Session"
                          onClick={() => {
                            if (confirm('ลบประวัติรายการนี้?')) {
                              setRecords(v =>
                                v.filter(x => x.id !== r.id)
                              );
                            }
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </article>
                    ))}
                </div>
              )}

              <button
                className="secondary full"
                onClick={exportData}
              >
                <Download size={18} /> สำรองข้อมูล JSON
              </button>
            </>
          )}

          {tab === 'settings' && (
            <>
              <h2>Practice Settings</h2>

              <section className="panel">
                <label>
                  เป้าหมายเวลาซ้อมต่อวัน (นาที)
                  <input
                    type="number"
                    min="10"
                    max="300"
                    value={settings.dailyMinutes}
                    onChange={e =>
                      setSettings(v => ({
                        ...v,
                        dailyMinutes: Math.min(
                          300,
                          Math.max(10, Number(e.target.value) || 10)
                        )
                      }))
                    }
                  />
                </label>

                <label>
                  จำนวนวันซ้อมต่อสัปดาห์
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={settings.practiceDays}
                    onChange={e =>
                      setSettings(v => ({
                        ...v,
                        practiceDays: Math.min(
                          7,
                          Math.max(1, Number(e.target.value) || 1)
                        )
                      }))
                    }
                  />
                </label>

                <label>
                  เวลาเตือนที่ต้องการ
                  <input
                    type="time"
                    value={settings.reminderTime}
                    onChange={e =>
                      setSettings(v => ({
                        ...v,
                        reminderTime: e.target.value
                      }))
                    }
                  />
                </label>

                <p className="hint">
                  ยังไม่ส่ง Push Notification;
                  การตั้งเวลานี้เตรียมไว้สำหรับเวอร์ชันถัดไป
                </p>
              </section>

              <section className="panel">
                <h3>ข้อมูลส่วนตัว</h3>

                <p className="hint">
                  ข้อมูลเก็บใน Browser ของเครื่องนี้
                  (localStorage) ไม่ซิงก์ข้ามเครื่อง
                  แนะนำ Export ก่อนอัปเดตใหญ่
                </p>

                <button
                  className="secondary"
                  onClick={exportData}
                >
                  <Download size={18} /> Export Backup JSON
                </button>

                <input
                  ref={importRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden-input"
                  onChange={e =>
                    void importData(e.target.files?.[0])
                  }
                />

                <button
                  className="secondary import-button"
                  onClick={() => importRef.current?.click()}
                >
                  <Upload size={18} /> Import Backup JSON
                </button>

                <p className="hint">
                  Import จะแทนที่ข้อมูลทั้งหมด หลังยืนยันเท่านั้น
                </p>
              </section>
            </>
          )}
        </main>
      )}

      {!active && (
        <nav className="nav" aria-label="เมนูหลัก">
          {([
            { key: 'home', label: 'Today', Icon: Home },
            { key: 'library', label: 'Exercises', Icon: BookOpen },
            { key: 'curriculum', label: 'MIDI', Icon: Music2 },
            { key: 'history', label: 'History', Icon: ChartNoAxesCombined },
            { key: 'settings', label: 'Settings', Icon: Settings2 }
          ] as const).map(t => (
            <button
              key={t.key}
              className={tab === t.key ? 'selected' : ''}
              onClick={() => setTab(t.key)}
            >
              <t.Icon size={20} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      <footer>
        <Clock3 size={13} />
        V2 · Local-first · Self-reported accuracy
      </footer>
    </div>
  );
}
