import { create } from "zustand";
import type { PlaneId, ScreenId, WeaponId } from "./data";
import { MISSIONS } from "./data";
import { loadSave, type Settings } from "./save";

export interface HudSnapshot {
  weapon: WeaponId;
  weapons: WeaponId[];
  ammo: number;
  mag: number;
  reloading: boolean;
  hull: number;
  hullMax: number;
  fleet: number;
  score: number;
  kills: number;
  shots: number;
  hits: number;
  rangeYd: number;
  heading: number;
  elevation: number;
  callout: string;
  waveLabel: string;
  zoom: number;
  threats: { x: number; y: number; kind: PlaneId; onscreen: boolean }[];
  time: number;
  locked: boolean;
  mobile: boolean;
}

export interface Debrief {
  win: boolean;
  score: number;
  kills: number;
  accuracy: number;
  hull: number;
  byType: Partial<Record<PlaneId, number>>;
  grade: string;
  missionId: string;
}

interface GameUi {
  screen: ScreenId;
  missionId: string;
  settings: Settings;
  hud: HudSnapshot;
  debrief: Debrief | null;
  setScreen: (s: ScreenId) => void;
  setMission: (id: string) => void;
  setHud: (h: Partial<HudSnapshot>) => void;
  setDebrief: (d: Debrief | null) => void;
  patchSettings: (p: Partial<Settings>) => void;
  resetHud: () => void;
}

const emptyHud = (): HudSnapshot => ({
  weapon: "m2",
  weapons: ["m2"],
  ammo: 200,
  mag: 200,
  reloading: false,
  hull: 100,
  hullMax: 100,
  fleet: 100,
  score: 0,
  kills: 0,
  shots: 0,
  hits: 0,
  rangeYd: 0,
  heading: 0,
  elevation: 0,
  callout: "",
  waveLabel: "",
  zoom: 0,
  threats: [],
  time: 0,
  locked: false,
  mobile: false,
});

const save = loadSave();

export const useGame = create<GameUi>((set) => ({
  screen: "title",
  missionId: MISSIONS[0]?.id ?? "pearl",
  settings: save.settings,
  hud: emptyHud(),
  debrief: null,
  setScreen: (screen) => set({ screen }),
  setMission: (missionId) => set({ missionId }),
  setHud: (h) => set((s) => ({ hud: { ...s.hud, ...h } })),
  setDebrief: (debrief) => set({ debrief }),
  patchSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
  resetHud: () => set({ hud: emptyHud(), debrief: null }),
}));
