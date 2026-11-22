
export type DrumNote = {
  tick: number;
  duration: number;
  pitch: number;
  velocity: number;
};

export type MidiPattern = {
  id: string;
  name: string;
  ppq: number;
  bpm: number;
  numerator: number;
  denominator: number;
  notes: DrumNote[];
  source: string;
};

const u16 = (d: DataView, p: number) => d.getUint16(p);
const u32 = (d: DataView, p: number) => d.getUint32(p);

export function parseMidi(buffer: ArrayBuffer, name: string): MidiPattern {
  const d = new DataView(buffer);

  if (d.byteLength < 14 || u32(d, 0) !== 0x4d546864) {
    throw Error('Not a MIDI file');
  }

  const header = u32(d, 4);
  if (header < 6 || 8 + header > d.byteLength) {
    throw Error('Invalid MIDI header');
  }

  const tracks = u16(d, 10);
  const division = u16(d, 12);

  if (division & 0x8000 || division === 0) {
    throw Error('SMPTE timing is not supported');
  }

  if (tracks > 128) throw Error('Too many MIDI tracks');

  let pos = 8 + header;
  let bpm = 120;
  let numerator = 4;
  let denominator = 4;

  const notes: DrumNote[] = [];

  const vlq = (end: number) => {
    let v = 0;

    for (let i = 0; i < 4; i++) {
      if (pos >= end) throw Error('Truncated MIDI event');

      const b = d.getUint8(pos++);
      v = (v << 7) | (b & 127);

      if (!(b & 128)) return v;
    }

    throw Error('Invalid MIDI delta');
  };

  for (let tr = 0; tr < tracks; tr++) {
    if (pos + 8 > d.byteLength || u32(d, pos) !== 0x4d54726b) {
      throw Error('Invalid MIDI track');
    }

    const size = u32(d, pos + 4);
    pos += 8;

    const end = pos + size;
    if (end > d.byteLength) throw Error('Truncated MIDI track');

    let tick = 0;
    let status = 0;

    const active = new Map<string, {
      tick: number;
      velocity: number;
    }>();

    while (pos < end) {
      tick += vlq(end);

      const b = d.getUint8(pos);

      if (b & 128) {
        status = b;
        pos++;
      } else if (!status) {
        throw Error('Missing MIDI running status');
      }

      if (status === 0xff) {
        if (pos >= end) throw Error('Invalid meta event');

        const type = d.getUint8(pos++);
        const len = vlq(end);

        if (pos + len > end) throw Error('Invalid meta length');

        if (type === 0x51 && len === 3) {
          const tempo =
            (d.getUint8(pos) << 16) |
            (d.getUint8(pos + 1) << 8) |
            d.getUint8(pos + 2);

          if (tempo > 0) bpm = Math.round(60000000 / tempo);
        }

        if (type === 0x58 && len >= 2) {
          numerator = d.getUint8(pos) || 4;
          denominator = 2 ** d.getUint8(pos + 1);
        }

        pos += len;
        status = 0;
        continue;
      }

      if (status === 0xf0 || status === 0xf7) {
        const len = vlq(end);
        pos += len;

        if (pos > end) throw Error('Invalid SysEx');

        status = 0;
        continue;
      }

      const type = status & 0xf0;
      const ch = status & 15;

      if (type < 0x80 || type > 0xe0) {
        throw Error('Unsupported MIDI status');
      }

      const count = (type === 0xc0 || type === 0xd0) ? 1 : 2;

      if (pos + count > end) throw Error('Truncated note');

      const a = d.getUint8(pos++);
      const v = count === 2 ? d.getUint8(pos++) : 0;

      if (type === 0x90 || type === 0x80) {
        const key = `${ch}:${a}`;
        const on = type === 0x90 && v > 0;

        if (on) {
          active.set(key, { tick, velocity: v });
        } else {
          const start = active.get(key);

          if (start) {
            if (ch === 9 || tracks === 1) {
              notes.push({
                tick: start.tick,
                duration: Math.max(1, tick - start.tick),
                pitch: a,
                velocity: start.velocity
              });
            }

            active.delete(key);
          }
        }
      }
    }

    pos = end;
  }

  if (notes.length === 0) {
    throw Error(
      'No drum notes found. Export a drum MIDI region from Logic Pro.'
    );
  }

  if (notes.length > 100000) {
    throw Error('MIDI file too large');
  }

  return {
    id: crypto.randomUUID(),
    name: name.replace(/\.midi?$/i, ''),
    ppq: division,
    bpm,
    numerator,
    denominator,
    notes: notes.sort((a, b) => a.tick - b.tick),
    source: name
  };
}

export const drumName = (p: number) =>
  ({
    35: 'Kick',
    36: 'Kick',
    38: 'Snare',
    40: 'Snare',
    37: 'Rim',
    42: 'Closed HH',
    44: 'Pedal HH',
    46: 'Open HH',
    49: 'Crash',
    51: 'Ride',
    53: 'Ride Bell',
    41: 'Floor Tom',
    43: 'Floor Tom',
    45: 'Low Tom',
    47: 'Mid Tom',
    48: 'High Tom',
    50: 'High Tom'
  } as Record<number, string>)[p] ?? `MIDI ${p}`;
