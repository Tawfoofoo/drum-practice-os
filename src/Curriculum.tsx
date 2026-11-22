
import { useEffect, useRef, useState } from 'react';
import { parseMidi, drumName, type MidiPattern } from './midi';

type Lesson = {
  id: string;
  title: string;
  description: string;
  patternIds: string[];
};

type Course = {
  id: string;
  title: string;
  lessons: Lesson[];
};

const COURSE_KEY = 'drum.curriculum.v2';
const MIDI_KEY = 'drum.midi.v2';

function stored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function Score({ pattern }: { pattern: MidiPattern }) {
  const beats = pattern.numerator * 4 / pattern.denominator;
  const barTicks = pattern.ppq * beats;

  const maxTick = Math.max(0, ...pattern.notes.map(n => n.tick));
  const bars = Math.max(
    1,
    Math.min(8, Math.ceil((maxTick + 1) / barTicks))
  );

  const width = Math.max(640, bars * 220);

  const y = (pitch: number) =>
    ({
      36: 115,
      38: 88,
      42: 42,
      46: 42,
      51: 54,
      49: 32,
      45: 77
    } as Record<number, number>)[pitch] ?? 66;

  return (
    <div className="score-scroll">
      <svg
        viewBox={`0 0 ${width} 150`}
        width={width}
        role="img"
        aria-label="Drum notation preview"
      >
        {Array.from({ length: 5 }, (_, i) => (
          <line
            key={i}
            x1="35"
            x2={bars * 220 + 20}
            y1={54 + i * 12}
            y2={54 + i * 12}
            stroke="currentColor"
            opacity=".45"
          />
        ))}

        {Array.from({ length: bars }, (_, b) => (
          <g key={b}>
            <line
              x1={35 + b * 220}
              x2={35 + b * 220}
              y1="46"
              y2="105"
              stroke="currentColor"
              opacity=".45"
            />
            <text
              x={43 + b * 220}
              y="22"
              fontSize="12"
              fill="currentColor"
            >
              {b + 1}
            </text>
          </g>
        ))}

        {pattern.notes
          .filter(n => n.tick < bars * barTicks)
          .slice(0, 1500)
          .map((n, i) => {
            const x =
              43 +
              Math.floor(n.tick / barTicks) * 220 +
              ((n.tick % barTicks) / barTicks) * 204;

            const yy = y(n.pitch);
            const cymbal = [42, 44, 46, 49, 51, 53]
              .includes(n.pitch);

            return (
              <g key={i}>
                <line
                  x1={x}
                  x2={x}
                  y1={yy}
                  y2={yy - 25}
                  stroke="currentColor"
                />

                {cymbal ? (
                  <text
                    x={x - 5}
                    y={yy + 4}
                    fill="currentColor"
                    fontSize="15"
                  >
                    ×
                  </text>
                ) : (
                  <ellipse
                    cx={x}
                    cy={yy}
                    rx="5.5"
                    ry="3.8"
                    fill="currentColor"
                  />
                )}

                {n.velocity < 45 && (
                  <circle
                    cx={x}
                    cy={yy}
                    r="9"
                    fill="none"
                    stroke="currentColor"
                    opacity=".5"
                  />
                )}
              </g>
            );
          })}
      </svg>

      <p className="hint">
        MIDI notation preview — ยังไม่ใช่โน้ตกลองที่จัด
        Beam, Rest และ Tuplet อย่างสมบูรณ์
      </p>
    </div>
  );
}

export default function Curriculum() {
  const [courses, setCourses] = useState<Course[]>(
    () => stored(COURSE_KEY, [])
  );

  const [patterns, setPatterns] = useState<MidiPattern[]>(
    () => stored(MIDI_KEY, [])
  );

  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(COURSE_KEY, JSON.stringify(courses));
    } catch {
      setError('Cannot save curriculum locally');
    }
  }, [courses]);

  useEffect(() => {
    try {
      localStorage.setItem(MIDI_KEY, JSON.stringify(patterns));
    } catch {
      setError('MIDI storage is full. Export backup first.');
    }
  }, [patterns]);

  const pattern = patterns.find(p => p.id === selected);

  async function upload(f?: File) {
    if (!f) return;

    setError('');

    try {
      if (f.size > 2_000_000) {
        throw Error('MIDI exceeds 2 MB');
      }

      const result = parseMidi(
        await f.arrayBuffer(),
        f.name
      );

      setPatterns(v => [...v, result]);
      setSelected(result.id);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to import MIDI'
      );
    } finally {
      if (file.current) file.current.value = '';
    }
  }

  function addCourse() {
    const title = prompt('ชื่อหลักสูตร เช่น Pop Drumming Level 1');

    if (!title?.trim()) return;

    setCourses(v => [
      ...v,
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        lessons: []
      }
    ]);
  }

  function addLesson(courseId: string) {
    const title = prompt('ชื่อบทเรียน');

    if (!title?.trim()) return;

    setCourses(v =>
      v.map(c =>
        c.id === courseId
          ? {
              ...c,
              lessons: [
                ...c.lessons,
                {
                  id: crypto.randomUUID(),
                  title: title.trim(),
                  description: '',
                  patternIds: []
                }
              ]
            }
          : c
      )
    );
  }

  function link(
    courseId: string,
    lessonId: string,
    patternId: string
  ) {
    setCourses(v =>
      v.map(c =>
        c.id === courseId
          ? {
              ...c,
              lessons: c.lessons.map(l =>
                l.id === lessonId
                  ? {
                      ...l,
                      patternIds: l.patternIds.includes(patternId)
                        ? l.patternIds
                        : [...l.patternIds, patternId]
                    }
                  : l
              )
            }
          : c
      )
    );
  }

  function updateDescription(
    courseId: string,
    lessonId: string,
    description: string
  ) {
    setCourses(v =>
      v.map(c =>
        c.id === courseId
          ? {
              ...c,
              lessons: c.lessons.map(l =>
                l.id === lessonId
                  ? { ...l, description }
                  : l
              )
            }
          : c
      )
    );
  }

  function exportV2() {
    const data = {
      version: 2,
      courses,
      patterns
    };

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = 'drum-curriculum-v2.json';
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <div className="section-head">
        <h2>MIDI Curriculum</h2>
        <span>V2</span>
      </div>

      <section className="panel">
        <h3>Logic Pro → MIDI Library</h3>

        <p className="hint">
          Export MIDI region (.mid) จาก Logic Pro
          แล้วนำเข้าเพื่อสร้างแบบฝึกกลอง
        </p>

        <input
          ref={file}
          className="hidden-input"
          type="file"
          accept=".mid,.midi,audio/midi"
          onChange={e => void upload(e.target.files?.[0])}
        />

        <button
          className="primary"
          onClick={() => file.current?.click()}
        >
          ＋ Import MIDI
        </button>

        {error && (
          <p role="alert" style={{ color: '#ff9a9a' }}>
            {error}
          </p>
        )}

        <div className="stack" style={{ marginTop: 12 }}>
          {patterns.map(p => (
            <button
              className="secondary full"
              key={p.id}
              onClick={() => setSelected(p.id)}
            >
              {p.name} · {p.bpm} BPM · {p.notes.length} notes
            </button>
          ))}
        </div>

        {pattern && (
          <>
            <h3>{pattern.name}</h3>

            <p>
              {pattern.numerator}/{pattern.denominator}
              {' · '}
              {pattern.bpm} BPM
              {' · '}
              {pattern.notes.length} notes
            </p>

            <Score pattern={pattern} />

            <p className="hint">
              Drum notes:{' '}
              {Array.from(
                new Set(
                  pattern.notes.map(n => drumName(n.pitch))
                )
              ).join(', ')}
            </p>
          </>
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>My Courses</h3>

          <button
            className="secondary"
            onClick={addCourse}
          >
            ＋ Course
          </button>
        </div>

        {courses.length === 0 && (
          <p className="hint">
            ยังไม่มีหลักสูตร กด Course เพื่อสร้างหลักสูตรแรก
          </p>
        )}

        {courses.map(c => (
          <div key={c.id} className="course-box">
            <div className="section-head">
              <h3>{c.title}</h3>

              <button
                className="mini"
                onClick={() => addLesson(c.id)}
              >
                ＋ Lesson
              </button>
            </div>

            {c.lessons.map(l => (
              <div key={l.id} className="lesson-box">
                <strong>{l.title}</strong>

                <p className="hint">
                  {l.patternIds
                    .map(pid =>
                      patterns.find(p => p.id === pid)?.name
                      ?? 'Missing MIDI'
                    )
                    .join(' · ') || 'ยังไม่มี MIDI'}
                </p>

                <select
                  aria-label={`เลือก MIDI สำหรับ ${l.title}`}
                  value=""
                  onChange={e => {
                    if (e.target.value) {
                      link(c.id, l.id, e.target.value);
                    }
                  }}
                >
                  <option value="">
                    ＋ เชื่อม MIDI Exercise
                  </option>

                  {patterns
                    .filter(p => !l.patternIds.includes(p.id))
                    .map(p => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>

                <label>
                  เป้าหมายบทเรียน

                  <textarea
                    value={l.description}
                    placeholder="วิธีฝึก / BPM เป้าหมาย / เกณฑ์ผ่าน"
                    onChange={e =>
                      updateDescription(
                        c.id,
                        l.id,
                        e.target.value
                      )
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        ))}
      </section>

      <button
        className="secondary full"
        onClick={exportV2}
      >
        ↓ Export Curriculum + MIDI JSON
      </button>

      <p className="hint">
        ข้อมูล V2 เก็บแยกจาก V1 ในเบราว์เซอร์นี้
        และยังไม่ซิงก์ข้ามอุปกรณ์
        ควร Export Backup เป็นประจำ
      </p>
    </>
  );
}
