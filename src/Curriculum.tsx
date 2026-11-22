
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
  // One staff per row, with up-stems and beams ABOVE the hi-hat X heads.
  // This is a readable 8th-note groove preview, not a full engraving engine.
  const ppq = pattern.ppq;
  const beatsPerBar = pattern.numerator * 4 / pattern.denominator;
  const barTicks = ppq * beatsPerBar;
  const maxTick = pattern.notes.reduce(
    (max, note) => Math.max(max, note.tick), 0
  );
  const totalBars = Math.max(1, Math.ceil((maxTick + 1) / barTicks));
  const visibleBars = Math.min(8, totalBars);
  const barsPerRow = 2;
  const rows = Math.ceil(visibleBars / barsPerRow);
  const barWidth = 330;
  const left = 62;
  const rowHeight = 150;
  const width = left + barsPerRow * barWidth + 22;
  const height = rows * rowHeight + 30;
  const staffTop = 63;
  const staffStep = 12;
  const cymbals = new Set([42, 44, 46, 49, 51, 53, 55, 57, 59]);

  function noteY(pitch: number): number {
    if (pitch === 35 || pitch === 36) return 111; // kick
    if (pitch === 37 || pitch === 38 || pitch === 40) return 87; // snare
    if (pitch === 42 || pitch === 44 || pitch === 46) return 55; // hi-hat
    if (pitch === 49 || pitch === 57) return 43; // crash
    if (pitch === 51 || pitch === 53 || pitch === 59) return 49; // ride
    if (pitch === 41 || pitch === 43) return 105; // floor tom
    if (pitch === 45 || pitch === 47) return 93; // mid tom
    if (pitch === 48 || pitch === 50) return 81; // high tom
    return 87;
  }

  function xAt(tick: number, bar: number): number {
    return left + bar * barWidth + 22 +
      ((tick % barTicks) / barTicks) * (barWidth - 44);
  }

  const bars = Array.from({ length: visibleBars }, (_, index) => {
    const start = index * barTicks;
    const end = start + barTicks;
    const barNotes = pattern.notes.filter(
      n => n.tick >= start && n.tick < end
    );
    const positions = new Map<number, typeof barNotes>();
    for (const note of barNotes) {
      const group = positions.get(note.tick) ?? [];
      group.push(note);
      positions.set(note.tick, group);
    }
    const events = [...positions.entries()]
      .sort(([a], [b]) => a - b)
      .map(([tick, notes]) => ({ tick, notes }));
    return { index, events };
  });

  return (
    <div className="score-scroll">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        role="img"
        aria-label="Drum notation with upward hi-hat stems and beams"
      >
        {Array.from({ length: rows }, (_, row) => {
          const rowY = row * rowHeight;
          const count = Math.min(barsPerRow, visibleBars - row * barsPerRow);
