export type WeaponId = "m2" | "oerlikon" | "bofors" | "fiveinch";
export type PlaneId = "zero" | "val" | "kate" | "judy" | "betty" | "midget" | "oka" | "p40";
export type AttackProfile = "strafe" | "dive" | "torpedo" | "level" | "kamikaze" | "sub";
export type ScreenId =
  | "title"
  | "campaign"
  | "briefing"
  | "playing"
  | "paused"
  | "debrief"
  | "armory"
  | "settings"
  | "range";

export type ScriptOp =
  | { op: "wait"; t: number }
  | { op: "clear"; n: number }
  | { op: "spawn"; type: PlaneId; count?: number; kamikaze?: boolean; delay?: number }
  | { op: "say"; text: string; t?: number }
  | { op: "unlock"; weapon: WeaponId; text?: string }
  | { op: "resupply" }
  | { op: "cap" }
  | { op: "wave"; title: string }
  | { op: "bravo"; text: string }
  | { op: "depart"; ship: string; text?: string }
  | { op: "end" };

export interface WeaponDef {
  id: WeaponId;
  key: string;
  name: string;
  short: string;
  caliber: string;
  year: string;
  rpm: number;
  muzzle: number;
  damage: number;
  burst: number;
  mag: number;
  reload: number;
  spread: number;
  recoil: number;
  traverse: number;
  gravity: number;
  tracerEvery: number;
  tracer: string;
  projectileScale: number;
  auto: boolean;
  vt: boolean;
  blurb: string;
}

export interface PlaneDef {
  id: PlaneId;
  name: string;
  code: string;
  allied: string;
  speed: number;
  hp: number;
  attack: AttackProfile;
  score: number;
  span: number;
  length: number;
  /** Generous collision radius in world meters (covers visual scale + arcade pad). */
  hitR: number;
  /** Fuselage capsule length in world meters. */
  hitLen: number;
  alt: number;
  bombDamage: number;
  blurb: string;
  hostile?: boolean;
}

export interface MissionDef {
  id: string;
  index: number;
  name: string;
  date: string;
  ship: string;
  location: string;
  briefing: string;
  weapons: WeaponId[];
  vt: boolean;
  sunElevation: number;
  sunAzimuth: number;
  turbidity: number;
  rayleigh: number;
  fog: number;
  fogColor: string;
  waterColor: number;
  exposure: number;
  theater: "harbor" | "ocean" | "night";
  hull: number;
  script: ScriptOp[];
  duration: number;
}

export const WEAPON_ORDER: WeaponId[] = ["m2", "oerlikon", "bofors", "fiveinch"];

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  m2: {
    id: "m2",
    key: "1",
    name: "Browning M2",
    short: ".50 CAL",
    caliber: ".50 BMG (12.7×99 mm)",
    year: "1921 / fleet 1941",
    rpm: 550,
    muzzle: 890,
    damage: 14,
    burst: 1.6,
    mag: 200,
    reload: 2.8,
    spread: 0.018,
    recoil: 0.004,
    traverse: 2.4,
    gravity: 9.8,
    tracerEvery: 4,
    tracer: "#ffb36b",
    projectileScale: 0.7,
    auto: true,
    vt: false,
    blurb:
      "Shipboard water-cooled M2s were the first guns into action at Pearl. Cyclic rate 450–600 rpm — not the aircraft AN/M2’s 750. Walk the tracers onto fighters at close range.",
  },
  oerlikon: {
    id: "oerlikon",
    key: "2",
    name: "Oerlikon 20 mm",
    short: "20 MM",
    caliber: "20×110 mm RB",
    year: "Fleet from 1942",
    rpm: 450,
    muzzle: 820,
    damage: 28,
    burst: 5.5,
    mag: 60,
    reload: 2.4,
    spread: 0.012,
    recoil: 0.01,
    traverse: 1.8,
    gravity: 9.8,
    tracerEvery: 3,
    tracer: "#ffce7a",
    projectileScale: 1,
    auto: true,
    vt: false,
    blurb:
      "Swiss Oerlikon, USN Mk 4. Cyclic 450 rpm, 60-round drum — the practical rate drops to ~250–320 while the loader swaps magazines. Explosive shell, the workhorse inside 1,000 yards.",
  },
  bofors: {
    id: "bofors",
    key: "3",
    name: "Bofors 40 mm",
    short: "40 MM",
    caliber: "40×311 mm R",
    year: "Fleet from late 1942",
    rpm: 120,
    muzzle: 850,
    damage: 70,
    burst: 16,
    mag: 8,
    reload: 1.15,
    spread: 0.008,
    recoil: 0.018,
    traverse: 1.15,
    gravity: 12,
    tracerEvery: 1,
    tracer: "#ffd27a",
    projectileScale: 1.6,
    auto: true,
    vt: false,
    blurb:
      "Quad and twin Bofors mounts were the most effective medium AA of the war. Four-round clips, explosive burst, the gun you want on a diving Val or a kamikaze.",
  },
  fiveinch: {
    id: "fiveinch",
    key: "4",
    name: '5"/38 Dual-Purpose',
    short: '5"/38',
    caliber: "127 mm / 38 cal",
    year: "Standard DP, VT from 1943",
    rpm: 18,
    muzzle: 790,
    damage: 160,
    burst: 36,
    mag: 1,
    reload: 2.9,
    spread: 0.006,
    recoil: 0.035,
    traverse: 0.55,
    gravity: 16,
    tracerEvery: 1,
    tracer: "#ffe6a8",
    projectileScale: 2.4,
    auto: false,
    vt: true,
    blurb:
      "The Navy’s great dual-purpose gun. Time-fuzed bursts at Pearl; proximity (VT) fuzes from 1943 made it lethal. Lead, set range, and let the burst envelope the formation. The British 4.7-inch and older U.S. 4\"/50 filled a similar role on destroyers.",
  },
};

export const PLANES: Record<PlaneId, PlaneDef> = {
  zero: {
    id: "zero",
    name: "Mitsubishi A6M2",
    code: "A6M2",
    allied: "Zero",
    speed: 145,
    hp: 38,
    attack: "strafe",
    score: 100,
    span: 12,
    length: 9.1,
    hitR: 24,
    hitLen: 34,
    alt: 90,
    bombDamage: 8,
    blurb: "Carrier fighter. Strafes decks with 7.7 mm and 20 mm. Fragile, fast, deadly if you let it in.",
  },
  val: {
    id: "val",
    name: "Aichi D3A1",
    code: "D3A1",
    allied: "Val",
    speed: 118,
    hp: 52,
    attack: "dive",
    score: 150,
    span: 14.4,
    length: 10.2,
    hitR: 28,
    hitLen: 38,
    alt: 620,
    bombDamage: 34,
    blurb: "Fixed-gear dive bomber. Pushes over from 2,000 feet and plants a 250 kg bomb. Kill it in the dive.",
  },
  kate: {
    id: "kate",
    name: "Nakajima B5N2",
    code: "B5N2",
    allied: "Kate",
    speed: 112,
    hp: 58,
    attack: "torpedo",
    score: 175,
    span: 15.5,
    length: 10.3,
    hitR: 30,
    hitLen: 40,
    alt: 28,
    bombDamage: 48,
    blurb: "The Type 97 carrier attack plane. Low and slow with an 18-inch torpedo. The most dangerous run in the harbor.",
  },
  judy: {
    id: "judy",
    name: "Yokosuka D4Y",
    code: "D4Y",
    allied: "Judy",
    speed: 165,
    hp: 48,
    attack: "dive",
    score: 160,
    span: 11.5,
    length: 10.2,
    hitR: 23,
    hitLen: 34,
    alt: 680,
    bombDamage: 36,
    blurb: "Successor to the Val. Faster, inline engine, still a dive bomber. Harder to lead.",
  },
  betty: {
    id: "betty",
    name: "Mitsubishi G4M",
    code: "G4M",
    allied: "Betty",
    speed: 125,
    hp: 90,
    attack: "level",
    score: 220,
    span: 25,
    length: 20,
    hitR: 44,
    hitLen: 68,
    alt: 420,
    bombDamage: 40,
    blurb: "Land-based twin. Long range, fragile tanks. Level-bombs from medium altitude. 5-inch bursts eat them.",
  },
  midget: {
    id: "midget",
    name: "Type A Kō-hyōteki",
    code: "Type A",
    allied: "Midget sub",
    speed: 18,
    hp: 70,
    attack: "sub",
    score: 250,
    span: 2,
    length: 24,
    hitR: 10,
    hitLen: 56,
    alt: 1.2,
    bombDamage: 55,
    blurb: "Two-man midget. Five entered Pearl. Periscope wake, then a shot at Battleship Row. Use the 5-inch.",
  },
  oka: {
    id: "oka",
    name: "Yokosuka MXY-7",
    code: "MXY-7",
    allied: "Ohka",
    speed: 210,
    hp: 22,
    attack: "kamikaze",
    score: 280,
    span: 5.1,
    length: 6.1,
    hitR: 14,
    hitLen: 22,
    alt: 320,
    bombDamage: 72,
    blurb: "Cherry Blossom. Rocket-boosted manned bomb, dropped from a Betty. Tiny, fast, one chance to break it.",
  },
  p40: {
    id: "p40",
    name: "Curtiss P-40B",
    code: "P-40B",
    allied: "Warhawk",
    speed: 138,
    hp: 70,
    attack: "strafe",
    score: 0,
    span: 11.4,
    length: 9.7,
    hitR: 23,
    hitLen: 34,
    alt: 110,
    bombDamage: 0,
    hostile: false,
    blurb: "Army fighter out of Hickam and Wheeler. Olive drab, US star. They hunt Zeros — do not put a burst into them.",
  },
};

const wait = (t: number): ScriptOp => ({ op: "wait", t });
const clear = (n: number): ScriptOp => ({ op: "clear", n });
const spawn = (type: PlaneId, count = 1, extra: { delay?: number; kamikaze?: boolean } = {}): ScriptOp => ({
  op: "spawn",
  type,
  count,
  delay: extra.delay ?? 0.75,
  kamikaze: extra.kamikaze,
});
const say = (text: string, t?: number): ScriptOp => ({ op: "say", text, t });
const wave = (title: string): ScriptOp => ({ op: "wave", title });
const unlock = (weapon: WeaponId, text: string): ScriptOp => ({ op: "unlock", weapon, text });
const resupply = (): ScriptOp => ({ op: "resupply" });
const cap = (): ScriptOp => ({ op: "cap" });
const bravo = (text: string): ScriptOp => ({ op: "bravo", text });
const depart = (ship: string, text: string): ScriptOp => ({ op: "depart", ship, text });
const end = (): ScriptOp => ({ op: "end" });

export const RANGE_MISSION: MissionDef = {
  id: "range",
  index: -1,
  name: "Gunnery range",
  date: "Practice",
  ship: "USS Nevada",
  location: "Battleship Row F-8",
  briefing: "Sleeve targets and live profiles. Walk tracers, lead the dive, break the torpedo run.",
  weapons: ["m2", "oerlikon", "bofors", "fiveinch"],
  vt: true,
  sunElevation: 18,
  sunAzimuth: 118,
  turbidity: 4.2,
  rayleigh: 2.4,
  fog: 0.0005,
  fogColor: "#8aa0b0",
  waterColor: 0x1a5a62,
  exposure: 0.68,
  theater: "harbor",
  hull: 100,
  script: [],
  duration: 0,
};

export const MISSIONS: MissionDef[] = [
  {
    id: "pearl",
    index: 0,
    name: "Pearl Harbor",
    date: "7 Dec 1941",
    ship: "USS Nevada",
    location: "Battleship Row F-8",
    briefing:
      "0755. Battleship Row, Ford Island. You are on Nevada at F-8, the north end of the row. Arizona is nested with Vestal just south of you; Tennessee and West Virginia beyond them; Maryland and Oklahoma; California at the south end. The Japanese first wave is already on the harbor — Vals diving, Kates on the torpedo run, Zeros strafing the decks. The 1.1-inch Chicago Pianos jammed. You have water-cooled .50s and whatever 5-inch the main battery can throw with time fuzes. Hold the row.",
    weapons: ["m2", "fiveinch"],
    vt: false,
    sunElevation: 18,
    sunAzimuth: 118,
    turbidity: 4.2,
    rayleigh: 2.4,
    fog: 0.0005,
    fogColor: "#8aa0b0",
    waterColor: 0x1a5a62,
    exposure: 0.68,
    theater: "harbor",
    hull: 100,
    duration: 420,
    script: [
      wave("First wave"),
      say("Air raid Pearl Harbor. This is not a drill.", 4.5),
      spawn("zero", 3, { delay: 1.1 }),
      wait(4),
      spawn("val", 3, { delay: 1.4 }),
      say("Vals pushing over the island — dive bombers."),
      wait(6),
      spawn("kate", 3, { delay: 1.6 }),
      say("Kates on the channel. Torpedo run, keep them off the nests."),
      cap(),
      wait(8),
      spawn("zero", 2, { delay: 0.9 }),
      spawn("val", 2, { delay: 1.2 }),
      unlock("fiveinch", "5-inch mounts manned — time fuzes, key 4."),
      clear(2),
      wave("Second wave"),
      say("Second wave. More Vals over the Navy Yard."),
      spawn("val", 4, { delay: 1.1 }),
      spawn("zero", 3, { delay: 0.8 }),
      wait(10),
      depart("california", "California is trying to get underway. Cover her."),
      spawn("kate", 2, { delay: 1.4 }),
      spawn("val", 2, { delay: 1.0 }),
      resupply(),
      wait(8),
      spawn("zero", 2),
      spawn("val", 2),
      clear(0),
      bravo("They are breaking off. You held the row."),
      end(),
    ],
  },
  {
    id: "guadalcanal",
    index: 1,
    name: "Guadalcanal",
    date: "12 Nov 1942",
    ship: "USS San Francisco",
    location: "Ironbottom Sound",
    briefing:
      "Night off Savo. San Francisco is the heavy in a cruiser column covering the transports at Lunga. Bettys have been working the slot since dusk; Zeros will come with first light. You have Oerlikons now — 60-round drums, explosive shell. Walk the 20 mm onto anything that lights a landing lamp. The 5-inch still shoots time fuzes. Do not let a torpedo bomber line up on the beam.",
    weapons: ["m2", "oerlikon", "fiveinch"],
    vt: false,
    sunElevation: 6,
    sunAzimuth: 95,
    turbidity: 6.5,
    rayleigh: 1.6,
    fog: 0.0007,
    fogColor: "#1c2836",
    waterColor: 0x0c2a32,
    exposure: 0.55,
    theater: "night",
    hull: 90,
    duration: 400,
    script: [
      wave("Night raid"),
      say("Condition Red. Bettys inbound down the Slot."),
      spawn("betty", 2, { delay: 2.2 }),
      spawn("kate", 2, { delay: 1.5 }),
      wait(8),
      spawn("zero", 3, { delay: 1.0 }),
      say("Fighters in the dark. Tracers will give you away — make them count."),
      wait(10),
      spawn("betty", 2, { delay: 1.8 }),
      spawn("kate", 3, { delay: 1.2 }),
      unlock("oerlikon", "Oerlikon mounts online — 20 mm, key 2."),
      resupply(),
      clear(1),
      wave("Dawn strike"),
      say("First light. Vals off the carriers."),
      spawn("val", 4, { delay: 1.1 }),
      spawn("zero", 3, { delay: 0.9 }),
      wait(12),
      spawn("kate", 3, { delay: 1.3 }),
      spawn("betty", 1),
      clear(0),
      bravo("The column is still afloat."),
      end(),
    ],
  },
  {
    id: "philippine-sea",
    index: 2,
    name: "Philippine Sea",
    date: "19 Jun 1944",
    ship: "USS Lexington (CV-16)",
    location: "Task Force 58",
    briefing:
      "The Turkey Shoot. Ozawa’s decks are emptying onto TF 58. You are on Lexington, the Big Blue Lady, with Bofors quads and VT fuzes in the 5-inch. Judys dive; Zeros escort; Bettys try the high run. Proximity shells do the work if you lead the formation, not the nose. Keep the flight deck clear.",
    weapons: ["m2", "oerlikon", "bofors", "fiveinch"],
    vt: true,
    sunElevation: 58,
    sunAzimuth: 80,
    turbidity: 2.8,
    rayleigh: 2.2,
    fog: 0.00028,
    fogColor: "#8eb4d0",
    waterColor: 0x146070,
    exposure: 0.78,
    theater: "ocean",
    hull: 110,
    duration: 420,
    script: [
      wave("Raid I"),
      say("Raid one. Judys and Zeros, high from the west."),
      spawn("judy", 3, { delay: 1.2 }),
      spawn("zero", 3, { delay: 0.8 }),
      wait(8),
      spawn("betty", 2, { delay: 1.6 }),
      unlock("bofors", "Bofors quads manned — 40 mm, key 3."),
      wait(6),
      spawn("judy", 3, { delay: 1.0 }),
      spawn("zero", 2),
      clear(2),
      wave("Raid II"),
      say("Second raid. VT fuzes in the 5-inch — key 4, lead the box."),
      spawn("judy", 4, { delay: 0.9 }),
      spawn("zero", 3, { delay: 0.7 }),
      spawn("kate", 2, { delay: 1.4 }),
      resupply(),
      wait(12),
      spawn("betty", 2, { delay: 1.5 }),
      spawn("judy", 3, { delay: 1.0 }),
      cap(),
      clear(1),
      wave("Raid III"),
      spawn("zero", 4, { delay: 0.6 }),
      spawn("judy", 3, { delay: 0.9 }),
      spawn("oka", 1, { kamikaze: true, delay: 2 }),
      clear(0),
      bravo("Flight deck is still ours."),
      end(),
    ],
  },
  {
    id: "leyte",
    index: 3,
    name: "Leyte Gulf",
    date: "25 Oct 1944",
    ship: "USS St. Lo",
    location: "Off Samar",
    briefing:
      "Taffy 3, escort carriers off Samar. The surface fight with Kurita is already a rumor on the net. What is not a rumor is the new word from the talker: suicide planes. Zeros and Judys nosing in and not pulling out. St. Lo is a jeep carrier — thin flight deck, little armor. The Bofors and the 5-inch with VT are what you have. Break the ones that do not turn.",
    weapons: ["m2", "oerlikon", "bofors", "fiveinch"],
    vt: true,
    sunElevation: 28,
    sunAzimuth: 102,
    turbidity: 5.5,
    rayleigh: 2.0,
    fog: 0.00045,
    fogColor: "#7a94a8",
    waterColor: 0x14545c,
    exposure: 0.64,
    theater: "ocean",
    hull: 78,
    duration: 400,
    script: [
      wave("Taffy 3"),
      say("Bogeys inbound. They are not pulling out."),
      spawn("zero", 3, { delay: 0.9 }),
      spawn("judy", 2, { delay: 1.2 }),
      wait(6),
      spawn("zero", 2, { kamikaze: true, delay: 1.4 }),
      say("Kamikaze. Put the Bofors on the ones that keep coming."),
      wait(8),
      spawn("val", 2, { delay: 1.1 }),
      spawn("zero", 3, { kamikaze: true, delay: 1.0 }),
      resupply(),
      clear(1),
      wave("Second strike"),
      spawn("judy", 3, { delay: 1.0 }),
      spawn("zero", 3, { kamikaze: true, delay: 0.8 }),
      spawn("kate", 2, { delay: 1.5 }),
      wait(10),
      spawn("betty", 1),
      spawn("zero", 2, { kamikaze: true }),
      spawn("oka", 1, { kamikaze: true, delay: 2.2 }),
      clear(0),
      bravo("St. Lo is still on the line."),
      end(),
    ],
  },
  {
    id: "okinawa",
    index: 4,
    name: "Okinawa",
    date: "6 Apr 1945",
    ship: "USS Laffey (DD-724)",
    location: "Radar Picket Station 1",
    briefing:
      "Radar picket, fifty miles north of Okinawa. Laffey is a Sumner-class destroyer on Station 1, the worst address in the fleet. Kikusui No. 1 is coming — dozens of kamikazes, Ohkas dropped from Bettys, Judys in the dive. You have every mount: .50s, 20 mm, quad Bofors, 5-inch with VT. They will come until the ship is a wreck or the sky is empty. Hold the picket.",
    weapons: ["m2", "oerlikon", "bofors", "fiveinch"],
    vt: true,
    sunElevation: 42,
    sunAzimuth: 88,
    turbidity: 7.2,
    rayleigh: 1.8,
    fog: 0.0004,
    fogColor: "#6d8496",
    waterColor: 0x123e48,
    exposure: 0.6,
    theater: "ocean",
    hull: 72,
    duration: 480,
    script: [
      wave("Kikusui"),
      say("Picket reports a swarm. All mounts, action starboard."),
      spawn("zero", 4, { kamikaze: true, delay: 0.7 }),
      spawn("val", 2, { delay: 1.1 }),
      wait(6),
      spawn("judy", 3, { delay: 0.9 }),
      spawn("betty", 1),
      say("Betty in the high run — Ohka under the belly."),
      spawn("oka", 2, { kamikaze: true, delay: 1.8 }),
      wait(8),
      spawn("zero", 4, { kamikaze: true, delay: 0.6 }),
      resupply(),
      clear(2),
      wave("Second swarm"),
      spawn("judy", 3, { delay: 0.8 }),
      spawn("zero", 5, { kamikaze: true, delay: 0.55 }),
      spawn("oka", 2, { kamikaze: true, delay: 1.6 }),
      wait(10),
      spawn("val", 3, { delay: 1.0 }),
      spawn("betty", 1),
      spawn("zero", 3, { kamikaze: true, delay: 0.7 }),
      cap(),
      clear(1),
      wave("Last run"),
      spawn("oka", 3, { kamikaze: true, delay: 1.2 }),
      spawn("zero", 4, { kamikaze: true, delay: 0.5 }),
      spawn("judy", 2, { delay: 1.0 }),
      clear(0),
      bravo("Laffey is still answering. The picket held."),
      end(),
    ],
  },
];

export function missionById(id: string): MissionDef | undefined {
  if (id === "range") return RANGE_MISSION;
  return MISSIONS.find((m) => m.id === id);
}

export function missionHasUnlocks(m: MissionDef): boolean {
  return m.script.some((op) => op.op === "unlock");
}
