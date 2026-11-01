const KEY = "pacific-defender-v1";

export interface Settings {
  sensitivity: number;
  invertY: boolean;
  shake: number;
  master: number;
  sfx: number;
  music: number;
}

export interface SaveData {
  version: 1;
  unlocked: string[];
  best: Record<string, number>;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 0.0022,
  invertY: false,
  shake: 0.7,
  master: 0.85,
  sfx: 0.9,
  music: 0.6,
};

const FALLBACK: SaveData = {
  version: 1,
  unlocked: ["pearl"],
  best: {},
  settings: { ...DEFAULT_SETTINGS },
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(FALLBACK);
    const parsed = JSON.parse(raw) as SaveData;
    if (parsed.version !== 1) return structuredClone(FALLBACK);
    return {
      version: 1,
      unlocked: parsed.unlocked?.length ? parsed.unlocked : ["pearl"],
      best: parsed.best ?? {},
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    };
  } catch {
    return structuredClone(FALLBACK);
  }
}

export function writeSave(data: SaveData) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function unlockMission(id: string) {
  const s = loadSave();
  if (!s.unlocked.includes(id)) {
    s.unlocked.push(id);
    writeSave(s);
  }
}

export function recordScore(missionId: string, score: number) {
  const s = loadSave();
  s.best[missionId] = Math.max(s.best[missionId] ?? 0, score);
  writeSave(s);
}

export function saveSettings(settings: Settings) {
  const s = loadSave();
  s.settings = settings;
  writeSave(s);
}
