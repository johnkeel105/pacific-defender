import * as THREE from "three";
import type { PlaneId, WeaponId } from "./data";

/** Aircraft meshes are built in real meters, then drawn at this scale. Ships, the island, and boats use the same factor so a Zero is not as wide as a battleship. */
export const WORLD_SCALE = 2.6;

export interface MatKit {
  deck: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  steelDark: THREE.MeshStandardMaterial;
  hull: THREE.MeshStandardMaterial;
  black: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  hinomaru: THREE.MeshStandardMaterial;
  star: THREE.MeshStandardMaterial;
  plane: THREE.MeshStandardMaterial;
  planeDark: THREE.MeshStandardMaterial;
  olive: THREE.MeshStandardMaterial;
  oka: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  wake: THREE.MeshBasicMaterial;
  brass: THREE.MeshStandardMaterial;
  fire: THREE.MeshBasicMaterial;
}

function std(color: number, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.18, ...extra });
}

export function makeHinomaruTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d6d0c4";
  g.fillRect(0, 0, 128, 128);
  g.beginPath();
  g.arc(64, 64, 38, 0, Math.PI * 2);
  g.fillStyle = "#c41e3a";
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeStarTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3d5a8a";
  g.fillRect(0, 0, 128, 128);
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.fillStyle = "#1d3a72";
  g.fill();
  g.beginPath();
  g.arc(64, 64, 46, 0, Math.PI * 2);
  g.fillStyle = "#f4f1ea";
  g.fill();
  g.fillStyle = "#c41e3a";
  starPath(g, 64, 64, 28, 12, 5);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function starPath(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, ir: number, n: number) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i * Math.PI) / n - Math.PI / 2;
    const rad = i % 2 === 0 ? r : ir;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

export function makeSmokeTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,0.85)");
  grd.addColorStop(0.45, "rgba(180,180,180,0.4)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function makeFlashTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,240,1)");
  grd.addColorStop(0.25, "rgba(255,200,80,0.85)");
  grd.addColorStop(1, "rgba(255,80,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function buildMatKit(deckMap: THREE.Texture | null, steelMap: THREE.Texture | null): MatKit {
  const hinomaru = new THREE.MeshStandardMaterial({
    map: makeHinomaruTexture(),
    roughness: 0.85,
    metalness: 0.05,
  });
  const star = new THREE.MeshStandardMaterial({
    map: makeStarTexture(),
    roughness: 0.85,
    metalness: 0.05,
  });
  return {
    deck: new THREE.MeshStandardMaterial({
      map: deckMap ?? undefined,
      color: deckMap ? 0xffffff : 0x8a6a3e,
      roughness: 0.9,
      metalness: 0.02,
    }),
    steel: new THREE.MeshStandardMaterial({
      map: steelMap ?? undefined,
      color: steelMap ? 0xb0b8c0 : 0x6a7278,
      roughness: 0.62,
      metalness: 0.35,
    }),
    steelDark: std(0x3a4248, { metalness: 0.45, roughness: 0.5 }),
    hull: std(0x4c555c, { metalness: 0.4, roughness: 0.55 }),
    black: std(0x1a1c1e, { metalness: 0.3, roughness: 0.6 }),
    glass: std(0x8aa4b8, { metalness: 0.6, roughness: 0.15, transparent: true, opacity: 0.55 }),
    hinomaru,
    star,
    plane: std(0xb7b1a4, { roughness: 0.78, metalness: 0.12 }),
    planeDark: std(0x4a463e, { roughness: 0.7, metalness: 0.2 }),
    olive: std(0x4a5a32, { roughness: 0.82, metalness: 0.08 }),
    oka: std(0x6e6758, { roughness: 0.7, metalness: 0.22 }),
    wood: std(0x6b4e2e, { roughness: 0.88, metalness: 0 }),
    wake: new THREE.MeshBasicMaterial({ color: 0xd8e8ee, transparent: true, opacity: 0.35, depthWrite: false }),
    brass: std(0x8a7a4a, { metalness: 0.7, roughness: 0.35 }),
    fire: new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.85, depthWrite: false }),
  };
}

function add(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function buildPlane(id: PlaneId, mats: MatKit): THREE.Group {
  const g = new THREE.Group();
  g.name = id;
  if (id === "oka") {
    const p = mats.oka;
    add(g, new THREE.CylinderGeometry(0.42, 0.55, 5.4, 8), p, 0, 0, 0, Math.PI / 2);
    add(g, new THREE.ConeGeometry(0.55, 1.6, 8), p, 0, 0, 3.4, Math.PI / 2);
    add(g, new THREE.CylinderGeometry(0.38, 0.22, 1.1, 8), mats.planeDark, 0, 0, -3.1, Math.PI / 2);
    add(g, new THREE.BoxGeometry(5.2, 0.1, 1.15), p, 0, 0, 0.2);
    add(g, new THREE.BoxGeometry(1.4, 0.08, 0.7), p, 0, 0, -2.4);
    add(g, new THREE.BoxGeometry(0.1, 0.85, 0.7), p, 0, 0.4, -2.4);
    add(g, new THREE.SphereGeometry(0.28, 6, 5), mats.glass, 0, 0.28, 1.1);
    add(g, new THREE.CylinderGeometry(0.18, 0.32, 0.7, 8), mats.fire, 0, 0, -3.7, Math.PI / 2);
    decal(g, mats, 1.6, 0.08, 0.2);
    decal(g, mats, -1.6, 0.08, 0.2);
    g.scale.setScalar(WORLD_SCALE);
    return g;
  }
  if (id === "p40") {
    const p = mats.olive;
    add(g, new THREE.CylinderGeometry(0.52, 0.4, 6.6, 8), p, 0, 0, 0, Math.PI / 2);
    add(g, new THREE.SphereGeometry(0.52, 8, 6), p, 0, 0, 3.3);
    add(g, new THREE.ConeGeometry(0.4, 2.2, 8), p, 0, 0, -4.4, -Math.PI / 2);
    add(g, new THREE.BoxGeometry(11.4, 0.16, 2.05), p, 0, 0, 0.3);
    add(g, new THREE.BoxGeometry(2.4, 0.12, 1.0), p, 0, 0, -3.8);
    add(g, new THREE.BoxGeometry(0.12, 1.45, 1.0), p, 0, 0.65, -3.8);
    add(g, new THREE.ConeGeometry(0.48, 1.7, 8), mats.planeDark, 0, 0, 4.2, Math.PI / 2);
    add(g, new THREE.SphereGeometry(0.48, 8, 6), mats.glass, 0, 0.42, 0.7);
    starDecal(g, mats, 3.6, 0.1, 0.3);
    starDecal(g, mats, -3.6, 0.1, 0.3);
    g.scale.setScalar(WORLD_SCALE);
    return g;
  }
  const p = mats.plane;
  const d = mats.planeDark;
  if (id === "betty") {
    add(g, new THREE.CylinderGeometry(1.15, 0.85, 16, 8), p, 0, 0, 0, Math.PI / 2);
    add(g, new THREE.SphereGeometry(1.15, 8, 6), p, 0, 0, 8);
    add(g, new THREE.ConeGeometry(0.85, 3.2, 8), p, 0, 0, -9.4, -Math.PI / 2);
    add(g, new THREE.BoxGeometry(24, 0.22, 3.4), p, 0, 0, 1.2);
    add(g, new THREE.CylinderGeometry(0.7, 0.7, 2.2, 8), d, 6.5, 0, 2.4, Math.PI / 2);
    add(g, new THREE.CylinderGeometry(0.7, 0.7, 2.2, 8), d, -6.5, 0, 2.4, Math.PI / 2);
    add(g, new THREE.SphereGeometry(1.05, 8, 6), d, 6.5, 0, 3.6);
    add(g, new THREE.SphereGeometry(1.05, 8, 6), d, -6.5, 0, 3.6);
    add(g, new THREE.BoxGeometry(7.5, 2.4, 0.18), p, 0, 0.4, -9.6);
    add(g, new THREE.BoxGeometry(0.16, 2.2, 1.4), p, 3.4, 1.1, -9.6);
    add(g, new THREE.BoxGeometry(0.16, 2.2, 1.4), p, -3.4, 1.1, -9.6);
    add(g, new THREE.SphereGeometry(0.9, 8, 6), mats.glass, 0, 0.55, 5.4);
    decal(g, mats, 8, 0.14, 1.2);
    decal(g, mats, -8, 0.14, 1.2);
  } else if (id === "midget") {
    add(g, new THREE.CylinderGeometry(1.05, 1.05, 18, 10), mats.hull, 0, 0, 0, Math.PI / 2);
    add(g, new THREE.SphereGeometry(1.05, 8, 6), mats.hull, 0, 0, 9);
    add(g, new THREE.SphereGeometry(1.05, 8, 6), mats.hull, 0, 0, -9);
    add(g, new THREE.CylinderGeometry(0.45, 0.55, 1.6, 8), mats.steelDark, 0, 1.4, 1);
    add(g, new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6), mats.black, 0, 3.4, 1);
    add(g, new THREE.BoxGeometry(0.12, 0.9, 6), mats.black, 0, -0.2, -4);
  } else {
    const span = id === "kate" ? 15 : id === "val" ? 14 : id === "judy" ? 11.5 : 12;
    const len = id === "kate" ? 10.4 : id === "val" ? 10.2 : 9.2;
    const fuseR = id === "judy" ? 0.48 : 0.55;
    add(g, new THREE.CylinderGeometry(fuseR, fuseR * 0.72, len * 0.72, 8), p, 0, 0, 0, Math.PI / 2);
    add(g, new THREE.SphereGeometry(fuseR, 8, 6), p, 0, 0, len * 0.36);
    add(g, new THREE.ConeGeometry(fuseR * 0.72, len * 0.32, 8), p, 0, 0, -len * 0.5, -Math.PI / 2);
    add(g, new THREE.BoxGeometry(span, 0.16, 2.15), p, 0, 0, 0.4);
    add(g, new THREE.BoxGeometry(span * 0.22, 0.12, 1.1), p, 0, 0, -len * 0.42);
    add(g, new THREE.BoxGeometry(0.12, 1.55, 1.05), p, 0, 0.7, -len * 0.42);
    if (id === "zero" || id === "val") {
      add(g, new THREE.SphereGeometry(0.82, 8, 6), d, 0, 0, len * 0.28);
      add(g, new THREE.CylinderGeometry(0.78, 0.78, 0.55, 10), d, 0, 0, len * 0.42, Math.PI / 2);
    } else if (id === "judy") {
      add(g, new THREE.ConeGeometry(0.5, 1.8, 8), d, 0, 0, len * 0.48, Math.PI / 2);
    } else {
      add(g, new THREE.SphereGeometry(0.7, 8, 6), d, 0, 0, len * 0.3);
    }
    if (id === "kate") {
      add(g, new THREE.BoxGeometry(1.1, 0.7, 3.6), mats.glass, 0, 0.55, 0.6);
      add(g, new THREE.CylinderGeometry(0.28, 0.28, 5.4, 8), mats.steelDark, 0, -0.85, 0.6, Math.PI / 2);
    } else if (id === "val") {
      add(g, new THREE.SphereGeometry(0.55, 8, 6), mats.glass, 0, 0.5, 0.7);
      add(g, new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6), d, 1.7, -0.9, 0.5);
      add(g, new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6), d, -1.7, -0.9, 0.5);
      add(g, new THREE.SphereGeometry(0.28, 8, 6), d, 1.7, -1.55, 0.5);
      add(g, new THREE.SphereGeometry(0.28, 8, 6), d, -1.7, -1.55, 0.5);
      add(g, new THREE.SphereGeometry(0.35, 8, 6), mats.black, 0, -0.7, 0.2);
    } else {
      add(g, new THREE.SphereGeometry(0.48, 8, 6), mats.glass, 0, 0.42, 0.55);
    }
    decal(g, mats, span * 0.32, 0.1, 0.4);
    decal(g, mats, -span * 0.32, 0.1, 0.4);
  }
  g.scale.setScalar(WORLD_SCALE);
  return g;
}

function decal(g: THREE.Group, mats: MatKit, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), mats.hinomaru);
  m.position.set(x, y, z);
  m.rotation.x = -Math.PI / 2;
  g.add(m);
}

function starDecal(g: THREE.Group, mats: MatKit, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), mats.star);
  m.position.set(x, y, z);
  m.rotation.x = -Math.PI / 2;
  g.add(m);
}

export function buildSupplyBoat(mats: MatKit): THREE.Group {
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(6.5, 2.2, 16), mats.hull, 0, 0.4, 0);
  add(g, new THREE.BoxGeometry(5.6, 0.3, 15), mats.deck, 0, 1.55, 0);
  add(g, new THREE.BoxGeometry(3.4, 2.4, 4.2), mats.steel, 0, 2.6, -2.2);
  add(g, new THREE.BoxGeometry(2.2, 1.1, 2.4), mats.wood, 1.4, 2.1, 3.4);
  add(g, new THREE.BoxGeometry(2.2, 1.1, 2.4), mats.wood, -1.4, 2.1, 3.4);
  add(g, new THREE.CylinderGeometry(0.35, 0.45, 3.2, 8), mats.steelDark, 0, 4.2, -2.4);
  add(g, new THREE.BoxGeometry(0.8, 0.5, 2.2), mats.black, 0, 0.2, -8.2);
  g.scale.setScalar(WORLD_SCALE);
  return g;
}

export function buildWeaponViewmodel(id: WeaponId, mats: MatKit): THREE.Group {
  const g = new THREE.Group();
  const s = mats.steelDark;
  const b = mats.black;
  const br = mats.brass;
  if (id === "m2") {
    add(g, new THREE.BoxGeometry(0.18, 0.14, 0.55), s, 0.08, -0.04, -0.15);
    add(g, new THREE.CylinderGeometry(0.025, 0.025, 1.15, 8), b, 0.04, 0.02, -0.7, Math.PI / 2);
    add(g, new THREE.CylinderGeometry(0.025, 0.025, 1.15, 8), b, 0.14, 0.02, -0.7, Math.PI / 2);
    add(g, new THREE.BoxGeometry(0.28, 0.08, 0.18), s, 0.09, -0.12, -0.05);
    add(g, new THREE.BoxGeometry(0.22, 0.12, 0.08), br, 0.09, -0.02, 0.12);
  } else if (id === "oerlikon") {
    add(g, new THREE.CylinderGeometry(0.045, 0.04, 1.55, 10), b, 0.12, 0.02, -0.85, Math.PI / 2);
    add(g, new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), br, 0.12, 0.16, -0.25, Math.PI / 2);
    add(g, new THREE.TorusGeometry(0.12, 0.03, 8, 16), br, 0.12, 0.16, -0.25);
    add(g, new THREE.BoxGeometry(0.22, 0.16, 0.32), s, 0.12, -0.06, -0.1);
    add(g, new THREE.BoxGeometry(0.16, 0.1, 0.22), s, 0.12, -0.16, 0.08);
  } else if (id === "bofors") {
    add(g, new THREE.CylinderGeometry(0.07, 0.065, 1.7, 10), s, 0.16, 0.04, -0.95, Math.PI / 2);
    add(g, new THREE.CylinderGeometry(0.09, 0.09, 0.22, 10), b, 0.16, 0.04, -1.7, Math.PI / 2);
    add(g, new THREE.BoxGeometry(0.28, 0.22, 0.5), s, 0.16, -0.02, -0.15);
    add(g, new THREE.BoxGeometry(0.18, 0.12, 0.28), br, 0.16, 0.14, -0.05);
    add(g, new THREE.BoxGeometry(0.5, 0.08, 0.4), s, 0.16, -0.18, 0.05);
  } else {
    add(g, new THREE.CylinderGeometry(0.09, 0.08, 2.4, 12), s, 0.22, 0.08, -1.35, Math.PI / 2);
    add(g, new THREE.CylinderGeometry(0.12, 0.12, 0.18, 12), b, 0.22, 0.08, -2.5, Math.PI / 2);
    add(g, new THREE.BoxGeometry(0.7, 0.55, 0.9), mats.steel, 0.05, -0.12, 0.15);
    add(g, new THREE.BoxGeometry(0.36, 0.28, 0.5), s, 0.22, 0.02, -0.2);
    add(g, new THREE.BoxGeometry(0.9, 0.06, 0.7), mats.steel, 0.05, 0.16, 0.1);
  }
  return g;
}

export function buildBattleship(mats: MatKit, kind: "bb" | "cv" | "dd"): THREE.Group {
  const g = new THREE.Group();
  const len = kind === "cv" ? 250 : kind === "dd" ? 110 : 185;
  const beam = kind === "cv" ? 32 : kind === "dd" ? 12 : 28;
  const hullH = kind === "dd" ? 6 : 9;

  const hull = new THREE.Mesh(new THREE.BoxGeometry(beam, hullH, len), mats.hull);
  hull.position.y = -1.2;
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(beam * 0.52, 22, 4), mats.hull);
  bow.rotation.x = -Math.PI / 2;
  bow.rotation.z = Math.PI / 4;
  bow.position.set(0, -1.2, -len / 2 - 4);
  g.add(bow);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(beam - 0.6, 0.4, len - 4), mats.deck);
  deck.position.y = hullH / 2 - 1.2;
  deck.receiveShadow = true;
  g.add(deck);

  const deckY = hullH / 2 - 1.0;

  if (kind === "cv") {
    add(g, new THREE.BoxGeometry(8, 18, 42), mats.steel, beam * 0.38, deckY + 9, -10);
    add(g, new THREE.CylinderGeometry(1.6, 1.8, 14, 8), mats.steelDark, beam * 0.38, deckY + 20, -4);
    add(g, new THREE.BoxGeometry(7, 4, 10), mats.steelDark, beam * 0.38, deckY + 4, 18);
  } else if (kind === "dd") {
    add(g, new THREE.BoxGeometry(6, 6, 16), mats.steel, 0, deckY + 3, -8);
    add(g, new THREE.CylinderGeometry(1.1, 1.3, 7, 8), mats.steelDark, 0, deckY + 8, -6);
    add(g, new THREE.BoxGeometry(4.5, 2.2, 5), mats.steelDark, 0, deckY + 1.6, 18);
    add(g, new THREE.BoxGeometry(4.5, 2.2, 5), mats.steelDark, 0, deckY + 1.6, -22);
  } else {
    add(g, new THREE.BoxGeometry(10, 11, 22), mats.steel, 0, deckY + 5.5, 8);
    add(g, new THREE.BoxGeometry(7, 6, 12), mats.steel, 0, deckY + 13, 10);
    add(g, new THREE.CylinderGeometry(2.2, 2.6, 12, 10), mats.steelDark, 0, deckY + 16, 2);
    add(g, new THREE.CylinderGeometry(1.8, 2.1, 10, 10), mats.steelDark, 0, deckY + 14, 12);
    add(g, new THREE.BoxGeometry(0.5, 28, 0.5), mats.black, 2.2, deckY + 22, 6);
    add(g, new THREE.BoxGeometry(0.5, 22, 0.5), mats.black, -2.2, deckY + 20, 10);
    turret(g, mats, 0, deckY + 2.2, -48, 1.15);
    turret(g, mats, 0, deckY + 4.2, -32, 1);
    turret(g, mats, 0, deckY + 2.2, 52, 1.15);
    add(g, new THREE.BoxGeometry(3.2, 2.2, 4.2), mats.steelDark, beam * 0.38, deckY + 1.4, -12);
    add(g, new THREE.BoxGeometry(3.2, 2.2, 4.2), mats.steelDark, -beam * 0.38, deckY + 1.4, -12);
    add(g, new THREE.BoxGeometry(3.2, 2.2, 4.2), mats.steelDark, beam * 0.38, deckY + 1.4, 22);
  }

  g.userData.kind = kind;
  g.userData.length = len * WORLD_SCALE;
  g.userData.beam = beam * WORLD_SCALE;
  g.userData.deckY = deckY * WORLD_SCALE;
  g.scale.setScalar(WORLD_SCALE);
  return g;
}

function turret(g: THREE.Group, mats: MatKit, x: number, y: number, z: number, s: number) {
  add(g, new THREE.CylinderGeometry(5.2 * s, 5.2 * s, 2.4 * s, 12), mats.steel, x, y, z);
  add(g, new THREE.BoxGeometry(8 * s, 2.6 * s, 9 * s), mats.steel, x, y + 1.4 * s, z);
  add(g, new THREE.CylinderGeometry(0.45 * s, 0.45 * s, 16 * s, 8), mats.black, x - 1.6 * s, y + 1.6 * s, z - 10 * s, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(0.45 * s, 0.45 * s, 16 * s, 8), mats.black, x + 1.6 * s, y + 1.6 * s, z - 10 * s, Math.PI / 2);
}

export function buildIsland(mats: MatKit): THREE.Group {
  const g = new THREE.Group();
  const green = std(0x4a6344, { roughness: 0.95, metalness: 0 });
  const sand = std(0xb7a078, { roughness: 0.95, metalness: 0 });
  const concrete = std(0x8a8680, { roughness: 0.92, metalness: 0.04 });
  const roof = std(0x6a5040, { roughness: 0.9, metalness: 0.08 });
  // Ford Island is a low coral island — airfield, hangars, no peaks.
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(200, 240, 5, 12), sand);
  pad.scale.set(0.95, 1, 1.75);
  pad.position.y = 1.4;
  pad.receiveShadow = true;
  g.add(pad);
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(170, 200, 2.2, 12), green);
  grass.scale.set(0.9, 1, 1.7);
  grass.position.y = 3.6;
  grass.receiveShadow = true;
  g.add(grass);
  // NAS Ford Island runway, along the long axis
  add(g, new THREE.BoxGeometry(36, 0.5, 520), concrete, 20, 4.0, 10);
  // Hangars and shops on the SE shore
  add(g, new THREE.BoxGeometry(48, 10, 28), roof, 70, 8, -80);
  add(g, new THREE.BoxGeometry(48, 10, 28), roof, 70, 8, -20);
  add(g, new THREE.BoxGeometry(36, 8, 22), mats.steelDark, 55, 7, 70);
  add(g, new THREE.BoxGeometry(22, 7, 18), mats.steel, 40, 6.5, 140);
  add(g, new THREE.BoxGeometry(14, 16, 14), mats.steelDark, -30, 11, -40);
  add(g, new THREE.CylinderGeometry(3.2, 3.6, 22, 8), mats.steelDark, -10, 14, 40);
  // Quay wall along Battleship Row
  add(g, new THREE.BoxGeometry(16, 3.4, 820), concrete, 218, 1.5, 30);
  g.scale.setScalar(WORLD_SCALE);
  return g;
}

export function buildMountains(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const rock = std(0x5a6158, { roughness: 1, metalness: 0 });
  const green = std(0x4e5c48, { roughness: 1, metalness: 0 });
  // Oahu's shields are eroded and far from Pearl — a low horizon ridge, not Alps.
  for (let i = 0; i < 9; i++) {
    const h = (38 + (i % 4) * 14 + Math.random() * 16) * scale;
    const r = 110 + Math.random() * 90;
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), i % 2 ? green : rock);
    m.position.set((i - 4) * 160, h * 0.38, (Math.random() - 0.5) * 80);
    m.rotation.y = i * 0.7;
    g.add(m);
  }
  return g;
}

function stdColor(hex: number) {
  return std(hex);
}
void stdColor;
