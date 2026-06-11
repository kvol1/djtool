import type { CamelotKey, Track, TrackMatch } from "./types";

const CAMELOT_STEPS = 12;

export function parseCamelotKey(key: CamelotKey) {
  const match = /^(\d{1,2})([AB])$/.exec(key);

  if (!match) {
    throw new Error(`Некорректная тональность Camelot: ${key}`);
  }

  const step = Number(match[1]);
  const mode = match[2] as "A" | "B";

  if (step < 1 || step > CAMELOT_STEPS) {
    throw new Error(`Шаг Camelot вне диапазона: ${key}`);
  }

  return { step, mode };
}

export function getCamelotDistance(sourceKey: CamelotKey, targetKey: CamelotKey) {
  const source = parseCamelotKey(sourceKey);
  const target = parseCamelotKey(targetKey);
  const raw = Math.abs(source.step - target.step);

  return Math.min(raw, CAMELOT_STEPS - raw);
}

export function isRelativeMajorMinor(sourceKey: CamelotKey, targetKey: CamelotKey) {
  const source = parseCamelotKey(sourceKey);
  const target = parseCamelotKey(targetKey);

  return source.step === target.step && source.mode !== target.mode;
}

export function findHarmonicMatches(sourceTrack: Track, library: Track[]): TrackMatch[] {
  return library
    .filter((track) => track.id !== sourceTrack.id)
    .map((track): TrackMatch | null => {
      const bpmDelta = track.bpm - sourceTrack.bpm;
      const absBpmDelta = Math.abs(bpmDelta);
      const keyDelta = getCamelotDistance(sourceTrack.key, track.key);
      const sameKey = sourceTrack.key === track.key;
      const relative = isRelativeMajorMinor(sourceTrack.key, track.key);
      const closeKey = keyDelta <= 2 || relative;

      if (sameKey && absBpmDelta <= 10) {
        return {
          track,
          type: "perfect",
          bpmDelta,
          keyDelta,
          reason: "Одинаковая тональность и комфортная разница BPM",
        };
      }

      if (closeKey && absBpmDelta <= 2) {
        return {
          track,
          type: "close",
          bpmDelta,
          keyDelta,
          reason: relative
            ? "Параллельный мажор/минор и почти тот же темп"
            : "Соседняя зона Camelot и почти тот же темп",
        };
      }

      return null;
    })
    .filter((match): match is TrackMatch => match !== null)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "perfect" ? -1 : 1;
      return Math.abs(a.bpmDelta) - Math.abs(b.bpmDelta) || a.keyDelta - b.keyDelta;
    });
}
