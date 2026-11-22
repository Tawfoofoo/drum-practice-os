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
