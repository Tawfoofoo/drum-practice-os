import { useEffect, useRef, useState } from 'react';
import { parseMidi, drumName, type MidiPattern } from './midi';

type Lesson = { id: string; title: string; description: string; patternIds: string[] };
type Course = { id: string; title: string; lessons: Lesson[] };
const COURSE_KEY = 'drum.curriculum.v2';
const MIDI_KEY = 'drum.midi.v2';
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function stored<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
  catch { return fallback; }
}

type Head = 'oval' | 'cross' | 'circle-cross' | 'diamond' | 'open-diamond';
const HEADS: Record<number, { y: number; head: Head }> = {
  35: { y: 105, head: 'oval' }, 36: { y: 105, head: 'oval' },
  37: { y: 81, head: 'cross' }, 38: { y: 81, head: 'oval' },
  39: { y: 81, head: 'cross' }, 40: { y: 81, head: 'oval' },
  41: { y: 99, head: 'oval' }, 43: { y: 93, head: 'oval' },
  45: { y: 87, head: 'oval' }, 47: { y: 75, head: 'oval' },
  48: { y: 69, head: 'oval' }, 50: { y: 63, head: 'oval' },
  42: { y: 63, head: 'cross' }, 44: { y: 117, head: 'cross' },
  46: { y: 51, head: 'circle-cross' }, 49: { y: 51, head: 'cross' },
  51: { y: 63, head: 'cross' }, 52: { y: 51, head: 'circle-cross' },
  53: { y: 63, head: 'diamond' }, 55: { y: 51, head: 'open-diamond' },
  57: { y: 45, head: 'cross' }, 59: { y: 63, head: 'cross' }
};
const cymbalPitches = new Set([42, 44, 46, 49, 51, 52, 53, 55, 57, 59]);
const nameOverride: Record<number, string> = {
  39: 'Hand Clap', 41: 'Low Tom 2', 43: 'Floor Tom 1',
  47: 'Mid Tom 2', 48: 'High Tom 2', 49: 'Crash 1',
  50: 'High Tom 1', 52: 'China', 55: 'Splash', 57: 'Crash 2'
};
const labelFor = (pitch: number) => nameOverride[pitch] ?? drumName(pitch);

function NoteHead({ x, y, kind }: { x: number; y: number; kind: Head }) {
  if (kind === 'oval') return <ellipse cx={x} cy={y} rx={6.3} ry={4.2} transform={`rotate(-18 ${x} ${y})`} fill="currentColor" />;
  if (kind === 'diamond' || kind === 'open-diamond') {
    return <path d={`M ${x} ${y - 6} L ${x + 6} ${y} L ${x} ${y + 6} L ${x - 6} ${y} Z`}
      fill={kind === 'diamond' ? 'currentColor' : 'white'} stroke="currentColor" strokeWidth="1.5" />;
  }
  return <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    {kind === 'circle-cross' && <circle cx={x} cy={y} r="8.2" strokeWidth="1.2" />}
    <path d={`M ${x - 5} ${y - 5} L ${x + 5} ${y + 5} M ${x + 5} ${y - 5} L ${x - 5} ${y + 5}`} />
  </g>;
}

function Score({ pattern }: { pattern: MidiPattern }) {
  const ppq = Math.max(1, pattern.ppq);
  const barTicks = Math.max(1, ppq * pattern.numerator * 4 / pattern.denominator);
  const lastTick = pattern.notes.reduce((m, n) => Math.max(m, n.tick + Math.max(1, n.duration)), 0);
  const totalBars = Math.max(1, Math.ceil(lastTick / barTicks));
  const visibleBars = Math.min(16, totalBars);
  const barsPerRow = 2;
  const rowHeight = 160;
  const barWidth = 330;
  const left = 64;
  const width = left + barsPerRow * barWidth + 22;
  const height = Math.ceil(visibleBars / barsPerRow) * rowHeight + 18;
  const staffLines = [63, 75, 87, 99, 111];
  const xAt = (tick: number, column: number, start: number) =>
    left + column * barWidth + 24 + ((tick - start) / barTicks) * (barWidth - 48);

  return <div className="score-scroll" style={{ overflowX: 'auto', maxWidth: '100%' }}>
    <svg viewBox={`0 0 ${width} ${height}`} width={width} role="img" aria-label={`Drum score: ${pattern.name}`} style={{ display: 'block', color: '#202020', background: '#fff', borderRadius: 8 }}>
      {Array.from({ length: visibleBars }, (_, barIndex) => {
        const row = Math.floor(barIndex / barsPerRow);
        const column = barIndex % barsPerRow;
        const dy = row * rowHeight;
        const start = barIndex * barTicks;
        const end = start + barTicks;
        const notes = pattern.notes.filter(n => n.tick >= start && n.tick < end);
        const xStart = left + column * barWidth;
        const groups = new Map<number, typeof notes>();
        notes.forEach(n => groups.set(n.tick, [...(groups.get(n.tick) ?? []), n]));
        const events = [...groups.entries()].sort((a, b) => a[0] - b[0]);
        // Beams connect consecutive eighth-note cymbal attacks inside each beat.
        const beamPairs: Array<[number, number]> = [];
        for (let i = 0; i < events.length - 1; i++) {
          const [t1, n1] = events[i];
          const [t2, n2] = events[i + 1];
          const eighth = ppq / 2;
          const sameBeat = Math.floor((t1 - start) / ppq) === Math.floor((t2 - start) / ppq);
          if (Math.abs(t2 - t1 - eighth) < 0.01 && sameBeat &&
              n1.some(n => cymbalPitches.has(n.pitch) && n.pitch !== 44) &&
              n2.some(n => cymbalPitches.has(n.pitch) && n.pitch !== 44)) {
            beamPairs.push([t1, t2]);
          }
        }
        const beamed = new Set(beamPairs.flat());
        return <g key={barIndex} transform={`translate(0 ${dy})`}>
          {staffLines.map(y => <line key={y} x1={xStart} x2={xStart + barWidth} y1={y} y2={y} stroke="#777" strokeWidth="1" />)}
          <line x1={xStart} x2={xStart} y1={63} y2={111} stroke="#777" />
          <line x1={xStart + barWidth} x2={xStart + barWidth} y1={63} y2={111} stroke="#777" />
          <text x={xStart + 7} y={49} fontSize="12" fill="#555">{barIndex + 1}</text>
          {barIndex === 0 && <text x={xStart + 7} y={84} fontSize="13" fontWeight="bold">{pattern.numerator}/{pattern.denominator}</text>}
          {events.flatMap(([tick, atTick]) => {
            const x = xAt(tick, column, start);
            // A common stem for the upper cymbal voice; lower drums retain their own stems.
            const upper = atTick.filter(n => cymbalPitches.has(n.pitch) && n.pitch !== 44);
            const lower = atTick.filter(n => !cymbalPitches.has(n.pitch) || n.pitch === 44);
            const elements = atTick.map((n, idx) => {
              const spec = HEADS[n.pitch] ?? { y: 87, head: 'oval' as Head };
              return <g key={`${tick}-${n.pitch}-${idx}`}>
                {spec.y < 57 && <line x1={x - 9} x2={x + 9} y1={51} y2={51} stroke="currentColor" strokeWidth="1" />}
                <NoteHead x={x} y={spec.y} kind={spec.head} />
                <title>{labelFor(n.pitch)} · MIDI {n.pitch} · velocity {n.velocity}</title>
              </g>;
            });
            const stems = <g key={`stems-${tick}`} stroke="currentColor" strokeWidth="1.6" fill="none">
              {upper.length > 0 && <line x1={x + 5.5} y1={Math.min(...upper.map(n => (HEADS[n.pitch]?.y ?? 63))) - 1}
                x2={x + 5.5} y2={beamed.has(tick) ? 27 : Math.min(27, Math.min(...upper.map(n => HEADS[n.pitch]?.y ?? 63)) - 30)} />}
              {lower.length > 0 && <line x1={x + 5.5} y1={Math.min(...lower.map(n => HEADS[n.pitch]?.y ?? 87)) - 1}
                x2={x + 5.5} y2={Math.min(...lower.map(n => HEADS[n.pitch]?.y ?? 87)) - 33} />}
            </g>;
            return [stems, ...elements];
          })}
          {beamPairs.map(([t1, t2], i) => <line key={`beam-${i}`} x1={xAt(t1, column, start) + 5.5} x2={xAt(t2, column, start) + 5.5}
            y1={27} y2={27} stroke="currentColor" strokeWidth="5" />)}
        </g>;
      })}
    </svg>
    {totalBars > visibleBars && <p className="hint">แสดงตัวอย่าง {visibleBars} จาก {totalBars} ห้อง</p>}
  </div>;
}

export default function Curriculum() {
  const [patterns, setPatterns] = useState<MidiPattern[]>(() => stored(MIDI_KEY, []));
  const [courses, setCourses] = useState<Course[]>(() => stored(COURSE_KEY, []));
  const [selectedId, setSelectedId] = useState<string>('');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem(MIDI_KEY, JSON.stringify(patterns)); }, [patterns]);
  useEffect(() => { localStorage.setItem(COURSE_KEY, JSON.stringify(courses)); }, [courses]);
  const selected = patterns.find(p => p.id === selectedId) ?? patterns[0];

  async function importMidi(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error('ไฟล์ MIDI ต้องไม่เกิน 5 MB');
      const pattern = parseMidi(await file.arrayBuffer(), file.name);
      setPatterns(old => [...old, pattern]);
      setSelectedId(pattern.id);
      setMessage(`นำเข้า ${pattern.name} สำเร็จ (${pattern.notes.length} notes)`);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'นำเข้า MIDI ไม่สำเร็จ'); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  }

  function addCourse() {
    const title = prompt('ชื่อ Course ใหม่');
    if (!title?.trim()) return;
    setCourses(old => [...old, { id: uid(), title: title.trim(), lessons: [] }]);
  }
  function addLesson(courseId: string) {
    const title = prompt('ชื่อ Lesson ใหม่');
    if (!title?.trim()) return;
    setCourses(old => old.map(c => c.id === courseId
      ? { ...c, lessons: [...c.lessons, { id: uid(), title: title.trim(), description: '', patternIds: [] }] }
      : c));
  }
  function togglePattern(courseId: string, lessonId: string, patternId: string) {
    setCourses(old => old.map(c => c.id !== courseId ? c : {
      ...c, lessons: c.lessons.map(l => l.id !== lessonId ? l : {
        ...l, patternIds: l.patternIds.includes(patternId)
          ? l.patternIds.filter(id => id !== patternId)
          : [...l.patternIds, patternId]
      })
    }));
  }

  return <div className="stack">
    <section className="panel">
      <div className="section-head"><h2>MIDI Exercise Library</h2><span>{patterns.length} patterns</span></div>
      <p className="hint">นำเข้าไฟล์ MIDI จาก Logic Pro เพื่อสร้างแบบฝึกและแสดงโน้ตกลอง</p>
      <input ref={fileRef} type="file" accept=".mid,.midi,audio/midi" className="hidden-input"
        onChange={e => void importMidi(e.target.files?.[0])} />
      <button className="primary" onClick={() => fileRef.current?.click()}>+ Import MIDI</button>
      {message && <p role="status">{message}</p>}
      {patterns.length > 0 && <label>เลือก MIDI Exercise
        <select value={selected?.id ?? ''} onChange={e => setSelectedId(e.target.value)}>
          {patterns.map(p => <option key={p.id} value={p.id}>{p.name} · {p.bpm} BPM</option>)}
        </select>
      </label>}
      {selected && <>
        <p><strong>{selected.name}</strong> · {selected.bpm} BPM · {selected.numerator}/{selected.denominator} · {selected.notes.length} notes</p>
        <Score pattern={selected} />
        <p className="hint">Score Preview: แสดง 16 ห้องแรกสูงสุด และจัดกลุ่มเขบ็ตหนึ่งชั้นแบบพื้นฐาน</p>
        <button className="secondary" onClick={() => {
          if (!confirm(`ลบ MIDI ${selected.name}? การเชื่อมกับ Lesson จะถูกลบด้วย`)) return;
          setPatterns(old => old.filter(p => p.id !== selected.id));
          setCourses(old => old.map(c => ({ ...c, lessons: c.lessons.map(l => ({ ...l, patternIds: l.patternIds.filter(id => id !== selected.id) })) })));
          setSelectedId('');
        }}>ลบ MIDI ที่เลือก</button>
      </>}
    </section>
    <section className="panel">
      <div className="section-head"><h2>Courses & Lessons</h2><button className="primary" onClick={addCourse}>+ Course</button></div>
      {courses.length === 0 && <p className="hint">ยังไม่มี Course — กด + Course เพื่อเริ่มสร้างหลักสูตร</p>}
      {courses.map(course => <article key={course.id} className="panel">
        <div className="section-head"><h3>{course.title}</h3><button className="secondary" onClick={() => addLesson(course.id)}>+ Lesson</button></div>
        {course.lessons.map(lesson => <div key={lesson.id} style={{ marginTop: 16 }}>
          <h4>{lesson.title}</h4>
          <label>รายละเอียด Lesson
            <textarea value={lesson.description} onChange={e => setCourses(old => old.map(c => c.id !== course.id ? c : {
              ...c, lessons: c.lessons.map(l => l.id === lesson.id ? { ...l, description: e.target.value } : l)
            }))} placeholder="เป้าหมายและรายละเอียดการฝึก" />
          </label>
          <p className="hint">เชื่อม MIDI Exercise กับ Lesson (เลือกได้หลายรายการ)</p>
          {patterns.length === 0 ? <p className="hint">กรุณา Import MIDI ก่อน</p> : patterns.map(pattern =>
            <label key={pattern.id} className="checkline" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input type="checkbox" checked={lesson.patternIds.includes(pattern.id)}
                onChange={() => togglePattern(course.id, lesson.id, pattern.id)} />
              {pattern.name} · {pattern.bpm} BPM
            </label>
          )}
          <small>เชื่อมแล้ว {lesson.patternIds.filter(id => patterns.some(p => p.id === id)).length} MIDI Exercise</small>
        </div>)}
      </article>)}
    </section>
  </div>;
}
