import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { Water } from "three/addons/objects/Water.js";
import { GameAudio } from "./audio";
import {
  MISSIONS,
  PLANES,
  WEAPON_ORDER,
  WEAPONS,
  missionById,
  type MissionDef,
  type PlaneDef,
  type PlaneId,
  type ScriptOp,
  type WeaponId,
} from "./data";
import { Input } from "./input";
import {
  buildBattleship,
  buildIsland,
  buildMatKit,
  buildMountains,
  buildPlane,
  buildSupplyBoat,
  buildWeaponViewmodel,
  makeFlashTexture,
  makeSmokeTexture,
  WORLD_SCALE,
  type MatKit,
} from "./models";
import { recordScore, unlockMission, type Settings } from "./save";
import { useGame, type Debrief, type HudSnapshot } from "./store";

const FIXED = 1 / 60;
const MAX_PLANES = 24;
const MAX_SHOTS = 110;
const MAX_FX = 64;
const YARDS = 1.0936;
const BASE_FOV = 68;
const ZOOM_FOV = 30;
const GUN_POS = new THREE.Vector3(14.6 * WORLD_SCALE, 10.4 * WORLD_SCALE, -6 * WORLD_SCALE);

interface PlaneEnt {
  alive: boolean;
  dead: boolean;
  type: PlaneId;
  mesh: THREE.Group;
  hp: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  pitch: number;
  roll: number;
  state: "ingress" | "orbit" | "run" | "pullout";
  t: number;
  dropped: boolean;
  kamikaze: boolean;
  friendly: boolean;
  smoke: number;
  orbitR: number;
  orbitAlt: number;
  orbitDir: number;
  orbitAng: number;
  nextRun: number;
  tgt: THREE.Vector3;
  gunCd: number;
}

interface Shot {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  damage: number;
  burst: number;
  weapon: WeaponId;
  fuse: number;
  tracer: boolean;
  fromPlayer: boolean;
  mesh: THREE.Mesh;
}

interface Fx {
  active: boolean;
  kind: "flak" | "splash" | "fire" | "smoke" | "flash";
  t: number;
  life: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  mesh: THREE.Object3D;
}

interface FleetShip {
  mesh: THREE.Group;
  hp: number;
  max: number;
  sunk: boolean;
  pos: THREE.Vector3;
  name?: string;
  departing: boolean;
  departVel: THREE.Vector3;
  aaCd: number;
}

interface SupplyBoat {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  alive: boolean;
  delivered: boolean;
  t: number;
}

interface PendingSpawn {
  at: number;
  type: PlaneId;
  kamikaze: boolean;
  friendly: boolean;
}

interface Torpedo {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  mesh: THREE.Mesh;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.15, 20000);
  private yawObj = new THREE.Object3D();
  private pitchObj = new THREE.Object3D();
  private timer = new THREE.Timer();
  private acc = 0;
  private input: Input;
  private audio = new GameAudio();
  private mats!: MatKit;
  private water!: Water;
  private sky = new Sky();
  private sun = new THREE.Vector3();
  private sunLight = new THREE.DirectionalLight(0xffe8c8, 2.14);
  private hemi = new THREE.HemisphereLight(0xc8d6e4, 0x2a3230, 0.95);
  private pmrem: THREE.PMREMGenerator;
  private envTex: THREE.Texture | null = null;
  private prototypes = {} as Record<PlaneId, THREE.Group>;
  private viewmodels = {} as Record<WeaponId, THREE.Group>;
  private planes: PlaneEnt[] = [];
  private shots: Shot[] = [];
  private fx: Fx[] = [];
  private torps: Torpedo[] = [];
  private fleet: FleetShip[] = [];
  private boats: SupplyBoat[] = [];
  private pending: PendingSpawn[] = [];
  private playerShip!: THREE.Group;
  private mission: MissionDef = MISSIONS[0]!;
  private weapons: WeaponId[] = ["m2"];
  private weaponIndex = 0;
  private ammo: Record<WeaponId, number> = { m2: 0, oerlikon: 0, bofors: 0, fiveinch: 0 };
  private mag: Record<WeaponId, number> = { m2: 0, oerlikon: 0, bofors: 0, fiveinch: 0 };
  private reloadT = 0;
  private cooldown = 0;
  private yaw = 0;
  private pitch = 0.12;
  private hull = 100;
  private hullMax = 100;
  private score = 0;
  private kills = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private byType: Partial<Record<PlaneId, number>> = {};
  private time = 0;
  private scriptI = 0;
  private waitT = 0;
  private clearN: number | null = null;
  private clearT = 0;
  private scriptDone = false;
  private waveLabel = "";
  private waveLabelT = 0;
  private zoom = 0;
  private zoomLimit = 1;
  private playing = false;
  private ended = false;
  private trauma = 0;
  private muzzle = 0;
  private callout = "";
  private calloutT = 0;
  private hudT = 0;
  private rangeYd = 0;
  private disposed = false;
  private recoil = 0;
  private smokeTex: THREE.Texture;
  private flashTex: THREE.Texture;
  private tracerGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 4);
  private tracerMat = new THREE.MeshBasicMaterial({ color: 0xffc878, toneMapped: false });
  private spriteMat: THREE.SpriteMaterial;
  private fireMat: THREE.SpriteMaterial;
  private muzzleSpr: THREE.Sprite;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private tmp3 = new THREE.Vector3();
  private shotFrom = new THREE.Vector3();
  private shotTo = new THREE.Vector3();
  private hitSeg = new THREE.Vector3();
  private hitClosest = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private steer = new THREE.Vector3();
  private _eu = new THREE.Euler(0, 0, 0, "YXZ");
  private _q = new THREE.Quaternion();
  private aim = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private settings: Settings;
  private onResize: () => void;
  private onLockChange: () => void;
  private visHandler: () => void;
  private loopBound: (t: number) => void;
  private ambientFlak = 0;
  private rangeClock = 0;
  private hitFlash = 0;

  constructor(canvas: HTMLCanvasElement, settings: Settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setClearColor(0x8aa0b0, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.input = new Input(canvas);
    this.smokeTex = makeSmokeTexture();
    this.flashTex = makeFlashTexture();
    this.spriteMat = new THREE.SpriteMaterial({
      map: this.smokeTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
      color: 0x222222,
    });
    this.fireMat = new THREE.SpriteMaterial({
      map: this.flashTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffcc88,
    });
    this.muzzleSpr = new THREE.Sprite(this.fireMat.clone());
    this.muzzleSpr.scale.set(0.8, 0.8, 1);
    this.muzzleSpr.visible = false;

    this.loopBound = this.loop.bind(this);
    this.onResize = () => this.resize();
    this.onLockChange = () => {
      useGame.getState().setHud({ locked: document.pointerLockElement === this.canvas });
    };
    this.visHandler = () => {
      this.audio.resume();
      if (document.hidden) this.input.keys.clear();
    };
    window.addEventListener("resize", this.onResize);
    document.addEventListener("pointerlockchange", this.onLockChange);
    document.addEventListener("visibilitychange", this.visHandler);
    this.resize();
  }

  async init() {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const [deck, steel, waterN] = await Promise.all([
      loader.loadAsync("/textures/deck.jpg"),
      loader.loadAsync("/textures/steel.jpg"),
      loader.loadAsync("/textures/waternormals.jpg"),
    ]);
    deck.wrapS = deck.wrapT = THREE.RepeatWrapping;
    deck.repeat.set(8, 28);
    deck.colorSpace = THREE.SRGBColorSpace;
    deck.anisotropy = 8;
    steel.wrapS = steel.wrapT = THREE.RepeatWrapping;
    steel.repeat.set(4, 10);
    steel.colorSpace = THREE.SRGBColorSpace;
    waterN.wrapS = waterN.wrapT = THREE.RepeatWrapping;
    this.mats = buildMatKit(deck, steel);

    this.scene.add(this.hemi);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 600;
    this.sunLight.shadow.camera.left = -120;
    this.sunLight.shadow.camera.right = 120;
    this.sunLight.shadow.camera.top = 120;
    this.sunLight.shadow.camera.bottom = -120;
    this.scene.add(this.sunLight);
    this.scene.add(new THREE.AmbientLight(0x8a9390, 0.38));

    this.sky.scale.setScalar(10000);
    this.scene.add(this.sky);

    const waterGeo = new THREE.PlaneGeometry(8000, 8000);
    this.water = new Water(waterGeo, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: waterN,
      sunDirection: new THREE.Vector3(0.4, 0.6, 0.2),
      sunColor: 0xe8dcc8,
      waterColor: 0x1a5a62,
      distortionScale: 3.6,
      fog: false,
    });
    this.water.rotation.x = -Math.PI / 2;
    this.scene.add(this.water);

    for (const id of Object.keys(PLANES) as PlaneId[]) {
      this.prototypes[id] = buildPlane(id, this.mats);
    }
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      const vm = buildWeaponViewmodel(id, this.mats);
      vm.visible = false;
      this.viewmodels[id] = vm;
      this.camera.add(vm);
    }
    this.camera.add(this.muzzleSpr);
    this.muzzleSpr.position.set(0.22, -0.08, -1.4);

    this.yawObj.position.copy(GUN_POS);
    this.yawObj.add(this.pitchObj);
    this.pitchObj.add(this.camera);
    this.scene.add(this.yawObj);

    this.allocPools();
    this.wireProbe();
    this.rebuildWorld();
    this.applySky(this.mission);
    this.renderer.setAnimationLoop(this.loopBound);
    this.audio.ensureGraph();
    void this.audio.preloadTitle();
  }

  applySettings(s: Settings) {
    this.settings = s;
    this.audio.setVolumes({ master: s.master, sfx: s.sfx, music: s.music });
  }

  unlockAudio() {
    this.audio.unlock();
    this.audio.setVolumes({
      master: this.settings.master,
      sfx: this.settings.sfx,
      music: this.settings.music,
    });
    this.audio.startAmbience();
  }

  setMenuMusic(on: boolean) {
    this.audio.setMenuMusic(on);
  }

  async requestLock() {
    try {
      await this.canvas.requestPointerLock({ unadjustedMovement: true } as PointerLockOptions);
    } catch {
      try {
        this.canvas.requestPointerLock();
      } catch {
        /* mobile / iframe */
      }
    }
  }

  exitLock() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  startMission(id: string) {
    const m = missionById(id) ?? MISSIONS[0]!;
    this.mission = m;
    this.playing = true;
    this.ended = false;
    this.time = 0;
    this.scriptI = 0;
    this.waitT = 0;
    this.clearN = null;
    this.clearT = 0;
    this.scriptDone = false;
    this.waveLabel = "";
    this.waveLabelT = 0;
    this.zoom = 0;
    this.zoomLimit = 1;
    this.pending = [];
    this.camera.fov = BASE_FOV;
    this.camera.updateProjectionMatrix();
    this.score = 0;
    this.kills = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.byType = {};
    this.hullMax = m.hull;
    this.hull = m.hull;
    this.reloadT = 0;
    this.cooldown = 0;
    this.yaw = -Math.PI / 2;
    this.pitch = 0.12;
    this.yawObj.position.copy(GUN_POS);
    this.trauma = 0;
    this.rangeClock = 0;
    this.callout =
      m.theater === "harbor" ? "Air raid Pearl Harbor. This is not a drill." : "Condition Red. Aircraft inbound.";
    this.calloutT = 4.5;
    this.weapons = [...m.weapons];
    this.weaponIndex = 0;
    for (const w of Object.keys(WEAPONS) as WeaponId[]) {
      this.mag[w] = WEAPONS[w].mag;
      this.ammo[w] = WEAPONS[w].mag * (w === "fiveinch" ? 40 : w === "bofors" ? 24 : 6);
    }
    this.clearEntities();
    this.rebuildWorld();
    this.applySky(m);
    this.equip(this.weapons[0]!);
    this.audio.alarm();
    this.audio.unlock();
    useGame.getState().resetHud();
    this.pushHud();
    void this.requestLock();
  }

  stopMission() {
    this.playing = false;
    this.ended = true;
    this.exitLock();
    this.clearEntities();
    this.mission = MISSIONS[0]!;
    this.rebuildWorld();
    this.applySky(this.mission);
  }

  setFire(on: boolean) {
    this.input.firing = on;
  }

  cycleWeapon(dir: number) {
    if (this.weapons.length < 2) return;
    this.weaponIndex = (this.weaponIndex + dir + this.weapons.length) % this.weapons.length;
    this.equip(this.weapons[this.weaponIndex]!);
  }

  pickWeapon(id: WeaponId) {
    const i = this.weapons.indexOf(id);
    if (i >= 0) {
      this.weaponIndex = i;
      this.equip(id);
    }
  }

  private equip(id: WeaponId) {
    for (const [k, vm] of Object.entries(this.viewmodels)) vm.visible = k === id;
  }

  private weapon(): WeaponId {
    return this.weapons[this.weaponIndex] ?? "m2";
  }

  private rebuildWorld() {
    const toRemove: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      if (o.userData.world) toRemove.push(o);
    });
    for (const o of toRemove) o.parent?.remove(o);
    this.fleet = [];

    const m = this.mission;
    const kind: "bb" | "cv" | "dd" =
      m.ship.includes("Lexington") ||
      m.ship.includes("Yorktown") ||
      m.ship.includes("Essex") ||
      m.ship.includes("St. Lo")
        ? "cv"
        : m.ship.includes("Laffey")
          ? "dd"
          : "bb";
    this.playerShip = buildBattleship(this.mats, kind);
    this.playerShip.userData.world = true;
    this.scene.add(this.playerShip);

    if (m.theater === "harbor") {
      this.placeBattleshipRow();
    } else {
      const escorts: Array<{ k: "dd" | "cv" | "bb"; x: number; z: number }> = [
        { k: "dd", x: 90 * WORLD_SCALE, z: -140 * WORLD_SCALE },
        { k: "dd", x: -80 * WORLD_SCALE, z: 160 * WORLD_SCALE },
        { k: "bb", x: -160 * WORLD_SCALE, z: 40 * WORLD_SCALE },
      ];
      if (m.ship.includes("Essex") || m.ship.includes("Lexington"))
        escorts.push({ k: "cv", x: 180 * WORLD_SCALE, z: 80 * WORLD_SCALE });
      for (const e of escorts) {
        const s = buildBattleship(this.mats, e.k);
        s.position.set(e.x, 0, e.z);
        s.rotation.y = 0.05;
        s.userData.world = true;
        this.scene.add(s);
        this.fleet.push({
          mesh: s,
          hp: e.k === "dd" ? 50 : 90,
          max: e.k === "dd" ? 50 : 90,
          sunk: false,
          pos: s.position.clone(),
          departing: false,
          departVel: new THREE.Vector3(),
          aaCd: Math.random() * 1.2,
        });
      }
    }

    if (m.theater !== "harbor") {
      const wake = new THREE.Mesh(new THREE.PlaneGeometry(18 * WORLD_SCALE, 420 * WORLD_SCALE), this.mats.wake);
      wake.rotation.x = -Math.PI / 2;
      wake.position.set(0, 0.15, 40);
      wake.userData.world = true;
      this.scene.add(wake);
    }
  }

  /**
   * 7 Dec 1941 Battleship Row, SE shore of Ford Island, north → south.
   * Player is Nevada (F-8, alone). Port = island, starboard = channel.
   * Nested pairs: inboard toward the island, outboard toward the torpedo water.
   */
  private placeBattleshipRow() {
    const s = WORLD_SCALE;
    const island = buildIsland(this.mats);
    island.position.set(-310 * s, 0, 390 * s);
    island.userData.world = true;
    this.scene.add(island);

    const waianae = buildMountains(0.7);
    waianae.position.set(-2200, 0, 420);
    waianae.userData.world = true;
    this.scene.add(waianae);

    const koolau = buildMountains(0.55);
    koolau.position.set(1400, 0, -2400);
    koolau.rotation.y = 0.85;
    koolau.userData.world = true;
    this.scene.add(koolau);

    // Arizona + Vestal (repair ship alongside, outboard)
    this.placeFleetShip("bb", -10 * s, 225 * s, 0.05, { fire: true, hp: 70 });
    this.placeFleetShip("dd", 50 * s, 210 * s, 0.05, { hp: 45 });
    // Tennessee (inboard) / West Virginia (outboard)
    this.placeFleetShip("bb", -38 * s, 445 * s, 0.11, { hp: 80 });
    this.placeFleetShip("bb", 24 * s, 445 * s, 0.11, { hp: 80 });
    // Maryland (inboard) / Oklahoma (outboard)
    this.placeFleetShip("bb", -50 * s, 665 * s, 0.18, { hp: 80 });
    this.placeFleetShip("bb", 16 * s, 665 * s, 0.18, { hp: 80 });
    // California, alone at F-3
    this.placeFleetShip("bb", -28 * s, 890 * s, 0.24, { hp: 80, name: "california" });
  }

  private placeFleetShip(
    kind: "bb" | "cv" | "dd",
    x: number,
    z: number,
    yaw: number,
    opts: { fire?: boolean; hp?: number; name?: string } = {},
  ) {
    const s = buildBattleship(this.mats, kind);
    s.position.set(x, 0, z);
    s.rotation.y = yaw;
    s.userData.world = true;
    this.scene.add(s);
    const hp = opts.hp ?? (kind === "dd" ? 50 : 80);
    this.fleet.push({
      mesh: s,
      hp,
      max: hp,
      sunk: false,
      pos: s.position.clone(),
      name: opts.name,
      departing: false,
      departVel: new THREE.Vector3(),
      aaCd: Math.random() * 1.4,
    });
    if (opts.fire) this.attachFire(s, 18);
    return s;
  }

  private attachFire(ship: THREE.Group, y: number) {
    const spr = new THREE.Sprite(this.fireMat);
    spr.scale.set(18, 22, 1);
    spr.position.set(4, y, -20);
    ship.add(spr);
    const sm = new THREE.Sprite(this.spriteMat);
    sm.scale.set(22, 28, 1);
    sm.position.set(3, y + 16, -20);
    ship.add(sm);
  }

  private applySky(m: MissionDef) {
    const u = this.sky.material.uniforms;
    u["turbidity"].value = m.turbidity;
    u["rayleigh"].value = m.rayleigh;
    u["mieCoefficient"].value = 0.005;
    u["mieDirectionalG"].value = 0.8;
    const phi = THREE.MathUtils.degToRad(90 - m.sunElevation);
    const theta = THREE.MathUtils.degToRad(m.sunAzimuth);
    this.sun.setFromSphericalCoords(1, phi, theta);
    u["sunPosition"].value.copy(this.sun);
    (this.water.material.uniforms["sunDirection"].value as THREE.Vector3).copy(this.sun).normalize();
    (this.water.material.uniforms["waterColor"].value as THREE.Color).setHex(0x1a5a62);
    this.sunLight.position.copy(this.sun).multiplyScalar(400);
    this.sunLight.intensity = (2.4 + m.sunElevation / 40) * 0.67;
    this.hemi.intensity = 0.95;
    this.renderer.toneMappingExposure = Math.max(0.52, m.exposure);
    this.scene.fog = new THREE.FogExp2(new THREE.Color(m.fogColor), m.fog * 0.45);
    this.scene.background = new THREE.Color(m.fogColor);
    try {
      if (this.envTex) this.envTex.dispose();
      this.envTex = this.pmrem.fromScene(this.sky as unknown as THREE.Scene).texture;
      this.scene.environment = this.envTex;
    } catch {
      this.scene.environment = null;
    }
  }

  private allocPools() {
    for (let i = 0; i < MAX_SHOTS; i++) {
      const mesh = new THREE.Mesh(this.tracerGeo, this.tracerMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shots.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        damage: 0,
        burst: 0,
        weapon: "m2",
        fuse: 0,
        tracer: false,
        fromPlayer: true,
        mesh,
      });
    }
    for (let i = 0; i < MAX_FX; i++) {
      const spr = new THREE.Sprite(this.spriteMat);
      spr.visible = false;
      this.scene.add(spr);
      this.fx.push({
        active: false,
        kind: "smoke",
        t: 0,
        life: 1,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        scale: 1,
        mesh: spr,
      });
    }
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.5, 6), this.mats.steelDark);
      mesh.visible = false;
      mesh.rotation.x = Math.PI / 2;
      this.scene.add(mesh);
      this.torps.push({ active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), mesh });
    }
  }

  private clearEntities() {
    for (const p of this.planes) {
      p.alive = false;
      p.mesh.parent?.remove(p.mesh);
    }
    this.planes = [];
    for (const s of this.shots) {
      s.active = false;
      s.mesh.visible = false;
    }
    for (const f of this.fx) {
      f.active = false;
      f.mesh.visible = false;
    }
    for (const t of this.torps) {
      t.active = false;
      t.mesh.visible = false;
    }
    for (const b of this.boats) {
      b.alive = false;
      b.mesh.parent?.remove(b.mesh);
    }
    this.boats = [];
    this.pending = [];
  }

  private spawnPlane(type: PlaneId, kamikaze = false, friendly = false) {
    if (this.planes.filter((p) => p.alive).length >= MAX_PLANES) return;
    const def = PLANES[type];
    const proto = this.prototypes[type];
    if (!proto) return;
    const mesh = proto.clone(true);
    const suicide = kamikaze || def.attack === "kamikaze";
    const az = Math.random() * Math.PI * 2;
    const orbit = this.orbitFor(type);
    const dist =
      type === "midget" ? 280 + Math.random() * 120 : orbit.r + 260 + Math.random() * 220;
    const alt = type === "midget" ? 1.1 : orbit.alt * (0.85 + Math.random() * 0.2);
    const pos = new THREE.Vector3(Math.sin(az) * dist, alt, Math.cos(az) * dist);
    const entry = new THREE.Vector3(Math.sin(az) * orbit.r, orbit.alt, Math.cos(az) * orbit.r);
    const vel = entry.clone().sub(pos).normalize().multiplyScalar(def.speed * (suicide ? 1.25 : 1));
    mesh.position.copy(pos);
    this.scene.add(mesh);
    const yaw = Math.atan2(vel.x, vel.z);
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.planes.push({
      alive: true,
      dead: false,
      type,
      mesh,
      hp: def.hp,
      pos,
      vel,
      yaw,
      pitch: 0,
      roll: 0,
      state: suicide && !friendly ? "run" : "ingress",
      t: 0,
      dropped: false,
      kamikaze: suicide && !friendly,
      friendly,
      smoke: 0,
      orbitR: orbit.r,
      orbitAlt: orbit.alt,
      orbitDir: dir,
      orbitAng: az,
      nextRun: 4 + Math.random() * 4,
      tgt: entry,
      gunCd: 0.4 + Math.random(),
    });
  }

  private orbitFor(type: PlaneId): { r: number; alt: number } {
    switch (type) {
      case "zero":
        return { r: 390 + Math.random() * 90, alt: 72 + Math.random() * 28 };
      case "val":
        return { r: 520 + Math.random() * 90, alt: 540 + Math.random() * 90 };
      case "judy":
        return { r: 540 + Math.random() * 100, alt: 600 + Math.random() * 90 };
      case "kate":
        return { r: 470 + Math.random() * 90, alt: 26 + Math.random() * 10 };
      case "betty":
        return { r: 640 + Math.random() * 110, alt: 370 + Math.random() * 55 };
      case "oka":
        return { r: 620 + Math.random() * 80, alt: 280 + Math.random() * 70 };
      case "p40":
        return { r: 340 + Math.random() * 70, alt: 90 + Math.random() * 40 };
      default:
        return { r: 400, alt: 80 };
    }
  }

  private spawnFx(kind: Fx["kind"], pos: THREE.Vector3, scale: number, life: number) {
    const f = this.fx.find((x) => !x.active);
    if (!f) return;
    f.active = true;
    f.kind = kind;
    f.t = 0;
    f.life = life;
    f.pos.copy(pos);
    f.vel.set((Math.random() - 0.5) * 4, kind === "smoke" ? 6 + Math.random() * 8 : 1, (Math.random() - 0.5) * 4);
    f.scale = scale;
    f.mesh.visible = true;
    f.mesh.position.copy(pos);
    if (f.mesh instanceof THREE.Sprite) {
      f.mesh.material = kind === "fire" || kind === "flash" ? this.fireMat : this.spriteMat;
      f.mesh.scale.setScalar(scale);
    }
  }

  private burst(pos: THREE.Vector3, radius: number, damage: number, fromGun: boolean) {
    this.spawnFx("flak", pos, radius * 0.45, 0.35);
    this.spawnFx("flash", pos, radius * 0.25, 0.12);
    for (let i = 0; i < 3; i++) this.spawnFx("smoke", pos, radius * 0.3, 0.8);
    this.audio.explosion(Math.min(1, radius / 28), Math.max(-1, Math.min(1, pos.x / 400)));
    this.trauma = Math.min(1, this.trauma + (fromGun ? 0.08 : 0.28));
    for (const p of this.planes) {
      if (!p.alive || p.dead || p.friendly) continue;
      const d = p.pos.distanceTo(pos);
      const rad = radius + PLANES[p.type].hitR * 0.45;
      if (d < rad) {
        const dmg = damage * (1 - d / rad);
        this.hurtPlane(p, dmg);
        if (fromGun) this.shotsHit += 1;
      }
    }
  }

  private hurtPlane(p: PlaneEnt, dmg: number, fromPlayer = true) {
    if (p.friendly && fromPlayer) return;
    p.hp -= dmg;
    p.smoke = Math.min(1, p.smoke + 0.2);
    if (fromPlayer) {
      this.audio.hit();
      this.hitFlash = 0.12;
    }
    if (p.hp <= 0) this.killPlane(p, fromPlayer);
  }

  private killPlane(p: PlaneEnt, fromPlayer = true) {
    if (p.dead) return;
    p.dead = true;
    p.vel.y -= 8;
    p.vel.x += (Math.random() - 0.5) * 20;
    p.roll = (Math.random() - 0.5) * 4;
    if (!p.friendly && fromPlayer) {
      this.kills += 1;
      this.byType[p.type] = (this.byType[p.type] ?? 0) + 1;
      this.score += PLANES[p.type].score;
    }
    this.spawnFx("fire", p.pos, 8, 0.5);
    this.audio.explosion(0.45);
    this.trauma = Math.min(1, this.trauma + 0.18);
  }

  private hullBox(): { bx: number; bz: number } {
    const beam = (this.playerShip?.userData.beam as number) || 28 * WORLD_SCALE;
    const len = (this.playerShip?.userData.length as number) || 185 * WORLD_SCALE;
    return { bx: beam * 0.5, bz: len * 0.5 };
  }

  private onHull(x: number, z: number, pad = 14): boolean {
    const { bx, bz } = this.hullBox();
    return Math.abs(x) < bx + pad && Math.abs(z) < bz + pad;
  }

  private hitShip(dmg: number, at: THREE.Vector3) {
    this.hull = Math.max(0, this.hull - dmg);
    this.trauma = Math.min(1, this.trauma + 0.55);
    this.audio.hullHit();
    this.spawnFx("flash", at, 14, 0.25);
    this.spawnFx("fire", at.clone().setY(12), 16, 1.2);
    this.callout = this.hull < 30 ? "Flooding in the magazines — keep firing" : "Hit on the hull";
    this.calloutT = 2.4;
    if (this.hull <= 0) this.finish(false);
  }

  private finish(win: boolean) {
    if (this.ended) return;
    this.ended = true;
    this.playing = false;
    this.exitLock();
    const acc = this.shotsFired > 0 ? this.shotsHit / this.shotsFired : 0;
    const grade = !win ? "LOSS" : acc > 0.35 && this.hull > 50 ? "E" : acc > 0.2 ? "S" : "A";
    const debrief: Debrief = {
      win,
      score: this.score + (win ? Math.round(this.hull * 8) : 0),
      kills: this.kills,
      accuracy: acc,
      hull: this.hull,
      byType: { ...this.byType },
      grade,
      missionId: this.mission.id,
    };
    if (win && this.mission.id !== "range") {
      recordScore(this.mission.id, debrief.score);
      const idx = MISSIONS.findIndex((x) => x.id === this.mission.id);
      const next = MISSIONS[idx + 1];
      if (next) unlockMission(next.id);
    }
    useGame.getState().setDebrief(debrief);
    useGame.getState().setScreen("debrief");
  }

  private fire(dt: number) {
    const id = this.weapon();
    const w = WEAPONS[id];
    if (this.reloadT > 0) return;
    if (this.mag[id] <= 0) {
      this.startReload();
      return;
    }
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    this.cooldown = 60 / w.rpm;
    this.mag[id] -= 1;
    this.shotsFired += 1;
    this.recoil = Math.min(0.12, this.recoil + w.recoil);
    this.pitch += w.recoil * 0.6;
    this.muzzle = 0.045;
    this.audio.shot(id);
    this.trauma = Math.min(1, this.trauma + w.recoil * 2);

    this.fwd.set(0, 0, -1).applyQuaternion(this.camera.getWorldQuaternion(this._q));
    const muzzle = this.camera.getWorldPosition(this.tmp).addScaledVector(this.fwd, 2.2);
    const spread = w.spread;
    this.fwd.x += (Math.random() - 0.5) * spread;
    this.fwd.y += (Math.random() - 0.5) * spread;
    this.fwd.z += (Math.random() - 0.5) * spread;
    this.fwd.normalize();

    const shot = this.shots.find((s) => !s.active);
    if (!shot) return;
    shot.active = true;
    shot.pos.copy(muzzle);
    shot.vel.copy(this.fwd).multiplyScalar(w.muzzle * 0.72);
    shot.life = 0;
    shot.damage = w.damage;
    shot.burst = w.burst;
    shot.weapon = id;
    shot.tracer = this.shotsFired % w.tracerEvery === 0;
    shot.fromPlayer = true;
    shot.mesh.visible = shot.tracer;
    shot.mesh.position.copy(muzzle);
    const nearest = this.nearestInSights(0.12);
    const dist = nearest ? nearest.pos.distanceTo(muzzle) : 700;
    shot.fuse = id === "fiveinch" ? Math.max(0.35, dist / shot.vel.length()) : 99;
    if (this.mag[id] <= 0) this.startReload();
  }

  private startReload() {
    const id = this.weapon();
    if (this.ammo[id] <= 0 && this.mag[id] <= 0) {
      this.audio.empty();
      return;
    }
    if (this.reloadT > 0) return;
    this.reloadT = WEAPONS[id].reload;
    this.audio.reload();
  }

  private nearestInSights(cosMin: number) {
    this.fwd.set(0, 0, -1).applyQuaternion(this.camera.getWorldQuaternion(this._q));
    const origin = this.camera.getWorldPosition(this.tmp3);
    let best: PlaneEnt | null = null;
    let bestDot = cosMin;
    for (const p of this.planes) {
      if (!p.alive || p.dead || p.friendly) continue;
      this.tmp.copy(p.pos).sub(origin).normalize();
      const dot = this.tmp.dot(this.fwd);
      if (dot > bestDot) {
        bestDot = dot;
        best = p;
      }
    }
    return best;
  }

  private loop = (_time?: number) => {
    if (this.disposed) return;
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    this.acc += dt;
    while (this.acc >= FIXED) {
      this.fixed(FIXED);
      this.acc -= FIXED;
    }
    this.present(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private fixed(dt: number) {
    this.applyAim(dt);
    if (!this.playing) return;
    this.time += dt;
    this.recoil *= Math.exp(-8 * dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    this.calloutT = Math.max(0, this.calloutT - dt);
    this.waveLabelT = Math.max(0, this.waveLabelT - dt);
    if (this.calloutT <= 0) this.callout = "";
    if (this.waveLabelT <= 0) this.waveLabel = "";
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const id = this.weapon();
        const need = WEAPONS[id].mag - this.mag[id];
        const take = Math.min(need, this.ammo[id]);
        this.mag[id] += take;
        this.ammo[id] -= take;
      }
    }

    const firing = this.input.firing || this.input.held("Space");
    if (firing) this.fire(dt);

    if (this.input.held("KeyR")) this.startReload();
    if (this.input.held("Digit1")) this.pickWeapon("m2");
    if (this.input.held("Digit2")) this.pickWeapon("oerlikon");
    if (this.input.held("Digit3")) this.pickWeapon("bofors");
    if (this.input.held("Digit4")) this.pickWeapon("fiveinch");
    const wheel = this.input.consumeWheel();
    if (wheel) {
      this.zoomLimit = THREE.MathUtils.clamp(this.zoomLimit + (wheel > 0 ? -0.12 : 0.12), 0.4, 1);
      if (!this.input.zooming()) this.zoom = THREE.MathUtils.clamp(this.zoom - Math.sign(wheel) * 0.12, 0, this.zoomLimit);
    }
    const zHeld = this.input.zooming();
    const zTgt = zHeld ? this.zoomLimit : 0;
    const zSpd = zHeld ? 4.2 : 2.8;
    this.zoom += (zTgt - this.zoom) * (1 - Math.exp(-zSpd * dt));

    this.director(dt);
    this.updatePlanes(dt);
    this.updateShots(dt);
    this.updateTorps(dt);
    this.updateFx(dt);
    this.updateFleet(dt);
    this.updateBoats(dt);
    this.ambientFlak -= dt;
    if (this.ambientFlak <= 0) {
      this.ambientFlak = 1.6 + Math.random() * 2.2;
      const p = this.tmp.set((Math.random() - 0.5) * 900, 120 + Math.random() * 220, (Math.random() - 0.5) * 900);
      this.spawnFx("smoke", p, 5 + Math.random() * 6, 0.55);
    }

    if (this.mission.id === "range") {
      this.rangeClock += dt;
      if (this.kills + this.planes.filter((p) => p.alive).length === 0 && this.time > 1.2) {
        this.spawnPlane("val");
        this.spawnPlane("zero");
      }
      if (this.rangeClock > 6) {
        this.rangeClock = 0;
        const types: PlaneId[] = ["zero", "val", "kate", "judy", "betty", "oka"];
        const pick = types[(Math.random() * types.length) | 0]!;
        this.spawnPlane(pick, pick === "oka");
      }
    } else if (!this.ended && this.scriptDone) {
      const live = this.threatCount() > 0 || this.pending.some((p) => !p.friendly);
      if (!live && this.time > 6) this.finish(true);
    }

    this.hudT += dt;
    if (this.hudT > 0.08) {
      this.hudT = 0;
      this.pushHud();
    }
  }

  private tryPick(i: number) {
    const id = this.weapons[i];
    if (id) this.pickWeapon(id);
  }

  setZoomHold(on: boolean) {
    this.input.zoomHold = on;
  }

  private applyAim(dt: number) {
    if (!this.playing) {
      const t = performance.now() * 0.00007;
      const r = 400;
      const x = Math.sin(t) * r;
      const z = Math.cos(t) * r;
      this.yawObj.position.set(x, 78, z);
      this.yaw = Math.atan2(-x, -z);
      this.pitch = -0.16;
      this.yawObj.rotation.y = this.yaw;
      this.pitchObj.rotation.x = this.pitch;
      return;
    }
    const look = this.input.consumeLook();
    const sens = this.settings.sensitivity * THREE.MathUtils.lerp(1, 0.32, this.zoom);
    const invert = this.settings.invertY ? -1 : 1;
    this.yaw -= look.x * sens;
    this.pitch -= look.y * sens * invert;

    const wpn = WEAPONS[this.weapon()];
    let steer = 0;
    let pitchKey = 0;
    if (this.input.held("KeyA") || this.input.held("ArrowLeft")) steer += 1;
    if (this.input.held("KeyD") || this.input.held("ArrowRight")) steer -= 1;
    if (this.input.held("KeyW") || this.input.held("ArrowUp")) pitchKey += 1;
    if (this.input.held("KeyS") || this.input.held("ArrowDown")) pitchKey -= 1;
    this.yaw += steer * wpn.traverse * dt;
    this.pitch += pitchKey * wpn.traverse * 0.65 * dt;

    const maxP = Math.PI / 2 - 0.08;
    this.pitch = Math.max(-0.12, Math.min(maxP, this.pitch));
    this.yawObj.rotation.y = this.yaw;
    this.pitchObj.rotation.x = this.pitch;
    void dt;
  }

  private director(dt: number) {
    if (this.mission.id === "range") return;
    const script = this.mission.script;
    const still: PendingSpawn[] = [];
    for (const s of this.pending) {
      if (this.time >= s.at) this.spawnPlane(s.type, s.kamikaze, s.friendly);
      else still.push(s);
    }
    this.pending = still;

    if (this.waitT > 0) {
      this.waitT -= dt;
      return;
    }
    if (this.clearN !== null) {
      this.clearT -= dt;
      const n = this.threatCount();
      const pend = this.pending.some((p) => !p.friendly);
      if ((n <= this.clearN && !pend) || this.clearT <= 0) this.clearN = null;
      else return;
    }
    if (this.scriptDone) return;

    while (this.scriptI < script.length) {
      const op = script[this.scriptI]!;
      this.scriptI += 1;
      if (this.execOp(op)) return;
    }
    this.scriptDone = true;
  }

  private execOp(op: ScriptOp): boolean {
    switch (op.op) {
      case "wait":
        this.waitT = op.t;
        return true;
      case "clear": {
        const pend = this.pending.some((p) => !p.friendly);
        if (this.threatCount() <= op.n && !pend) return false;
        this.clearN = op.n;
        this.clearT = 160;
        return true;
      }
      case "spawn": {
        const count = op.count ?? 1;
        const gap = op.delay ?? 0.75;
        for (let i = 0; i < count; i++) {
          this.pending.push({
            at: this.time + i * gap,
            type: op.type,
            kamikaze: !!op.kamikaze,
            friendly: false,
          });
        }
        return false;
      }
      case "say":
        this.callout = op.text;
        this.calloutT = op.t ?? 3.4;
        return false;
      case "unlock":
        if (!this.weapons.includes(op.weapon)) this.weapons.push(op.weapon);
        this.weapons = WEAPON_ORDER.filter((id) => this.weapons.includes(id));
        this.callout = op.text ?? `${WEAPONS[op.weapon].short} online`;
        this.calloutT = 4.2;
        return false;
      case "resupply":
        this.spawnSupply();
        this.callout = "Yard craft inbound with belts and powder.";
        this.calloutT = 3.6;
        return false;
      case "cap":
        this.pending.push({ at: this.time + 0.4, type: "p40", kamikaze: false, friendly: true });
        this.pending.push({ at: this.time + 1.6, type: "p40", kamikaze: false, friendly: true });
        return false;
      case "wave":
        this.waveLabel = op.title;
        this.waveLabelT = 5.5;
        return false;
      case "bravo":
        this.callout = op.text;
        this.calloutT = 4.4;
        this.waveLabel = op.text;
        this.waveLabelT = 4.4;
        return false;
      case "depart": {
        const ship = this.fleet.find((f) => f.name === op.ship && !f.sunk);
        if (ship) {
          ship.departing = true;
          ship.departVel.set(12, 0, -18);
        }
        this.callout = op.text ?? "Friendly getting underway.";
        this.calloutT = 4.5;
        return false;
      }
      case "end":
        this.scriptDone = true;
        return true;
      default:
        return false;
    }
  }

  private threatCount() {
    let n = 0;
    for (const p of this.planes) {
      if (p.alive && !p.dead && !p.friendly) n += 1;
    }
    return n;
  }

  private spawnSupply() {
    const mesh = buildSupplyBoat(this.mats);
    const pos = new THREE.Vector3(220, 0.4, -90);
    mesh.position.copy(pos);
    mesh.userData.world = true;
    this.scene.add(mesh);
    this.boats.push({
      mesh,
      pos,
      vel: new THREE.Vector3(-18, 0, 8),
      alive: true,
      delivered: false,
      t: 0,
    });
  }

  private updateBoats(dt: number) {
    for (const b of this.boats) {
      if (!b.alive) continue;
      b.t += dt;
      if (!b.delivered) {
        this.desired.set(42, 0.4, -18).sub(b.pos);
        if (this.desired.lengthSq() > 1) this.desired.normalize();
        b.vel.lerp(this.desired.multiplyScalar(16), 1 - Math.exp(-1.6 * dt));
        b.pos.addScaledVector(b.vel, dt);
        if (b.pos.distanceTo(this.tmp.set(42, 0.4, -18)) < 14) {
          b.delivered = true;
          for (const id of this.weapons) {
            const add = WEAPONS[id].mag * (id === "fiveinch" ? 12 : id === "bofors" ? 10 : 4);
            this.ammo[id] += add;
          }
          this.callout = "Alongside — belts and powder aboard.";
          this.calloutT = 3.2;
          b.vel.set(14, 0, 22);
        }
      } else {
        b.vel.set(16, 0, 22);
        b.pos.addScaledVector(b.vel, dt);
        if (b.pos.length() > 900) {
          b.alive = false;
          b.mesh.parent?.remove(b.mesh);
        }
      }
      b.mesh.position.copy(b.pos);
      if (b.vel.lengthSq() > 1) b.mesh.rotation.y = Math.atan2(b.vel.x, b.vel.z);
    }
  }

  private updateFleet(dt: number) {
    for (const ship of this.fleet) {
      if (ship.sunk) continue;
      if (ship.departing) {
        ship.pos.addScaledVector(ship.departVel, dt);
        ship.mesh.position.copy(ship.pos);
        ship.mesh.rotation.y = Math.atan2(ship.departVel.x, ship.departVel.z);
        if (ship.pos.length() > 1600) {
          ship.sunk = true;
          ship.mesh.visible = false;
          continue;
        }
      }
      ship.aaCd -= dt;
      if (ship.aaCd > 0) continue;
      let best: PlaneEnt | null = null;
      let bestD = 520;
      for (const p of this.planes) {
        if (!p.alive || p.dead || p.friendly) continue;
        const d = p.pos.distanceTo(ship.pos);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      if (!best) {
        ship.aaCd = 0.7;
        continue;
      }
      if (Math.random() > 0.42) {
        ship.aaCd = 0.25;
        continue;
      }
      ship.aaCd = 0.55 + Math.random() * 0.7;
      this.fleetTracer(ship, best);
    }
  }

  private fleetTracer(ship: FleetShip, tgt: PlaneEnt) {
    const shot = this.shots.find((s) => !s.active);
    if (!shot) return;
    const muzzle = this.tmp.copy(ship.pos);
    muzzle.y += 14 * WORLD_SCALE;
    muzzle.x += (Math.random() - 0.5) * 8 * WORLD_SCALE;
    this.fwd.copy(tgt.pos).sub(muzzle);
    this.fwd.y += 2;
    this.fwd.normalize();
    this.fwd.x += (Math.random() - 0.5) * 0.18;
    this.fwd.y += (Math.random() - 0.5) * 0.14;
    this.fwd.z += (Math.random() - 0.5) * 0.18;
    this.fwd.normalize();
    shot.active = true;
    shot.pos.copy(muzzle);
    shot.vel.copy(this.fwd).multiplyScalar(480);
    shot.life = 0;
    shot.damage = 1.5;
    shot.burst = 1.2;
    shot.weapon = "m2";
    shot.fuse = 99;
    shot.tracer = true;
    shot.fromPlayer = false;
    shot.mesh.visible = true;
    shot.mesh.position.copy(muzzle);
  }

  private updateFriendly(p: PlaneEnt, def: PlaneDef, dt: number) {
    let prey: PlaneEnt | null = null;
    let best = 900;
    for (const e of this.planes) {
      if (!e.alive || e.dead || e.friendly || e === p) continue;
      const d = e.pos.distanceTo(p.pos);
      if (d < best) {
        best = d;
        prey = e;
      }
    }
    if (prey) {
      p.tgt.copy(prey.pos);
      this.flyToward(p, p.tgt, def.speed * 1.08, 2.1, dt, 0.7);
      p.gunCd -= dt;
      if (best < 70 && p.gunCd <= 0) {
        p.gunCd = 0.38;
        this.hurtPlane(prey, 1.6, false);
        this.spawnFx("flash", prey.pos, 1.6, 0.06);
        const shot = this.shots.find((s) => !s.active);
        if (shot) {
          this.fwd.copy(prey.pos).sub(p.pos).normalize();
          shot.active = true;
          shot.pos.copy(p.pos);
          shot.vel.copy(this.fwd).multiplyScalar(480);
          shot.life = 0;
          shot.damage = 0;
          shot.burst = 0.8;
          shot.weapon = "m2";
          shot.fuse = 99;
          shot.tracer = true;
          shot.fromPlayer = false;
          shot.mesh.visible = true;
          shot.mesh.position.copy(p.pos);
        }
      }
    } else {
      p.orbitAng += p.orbitDir * (def.speed / Math.max(80, p.orbitR)) * dt;
      this.orbitPoint(p, 0.7, p.tgt);
      this.flyToward(p, p.tgt, def.speed, 1.4, dt, 0.4);
    }
    p.pos.addScaledVector(p.vel, dt);
    if (p.pos.y < 18) p.pos.y = 18;
    this.orientPlane(p, dt);
  }

  private updatePlanes(dt: number) {
    let closest = 9999;
    for (const p of this.planes) {
      if (!p.alive) continue;
      p.t += dt;
      if (p.dead) {
        p.vel.y -= 28 * dt;
        p.pos.addScaledVector(p.vel, dt);
        p.mesh.position.copy(p.pos);
        p.mesh.rotateZ(p.roll * dt);
        p.mesh.rotateX(1.2 * dt);
        if (Math.random() < 0.4) this.spawnFx("smoke", p.pos, 5, 0.7);
        if (p.pos.y < 0) {
          this.spawnFx("splash", p.pos.clone().setY(0.5), 10, 0.6);
          this.audio.splash();
          p.alive = false;
          p.mesh.parent?.remove(p.mesh);
        }
        continue;
      }

      const def = PLANES[p.type];
      const horiz = Math.hypot(p.pos.x, p.pos.z);
      closest = Math.min(closest, Math.hypot(horiz, p.pos.y - 14));

      if (p.type === "midget") {
        this.desired.set(0, 1, 0).sub(p.pos);
        this.desired.y = 0;
        if (this.desired.lengthSq() > 1) this.desired.normalize();
        p.vel.lerp(this.desired.multiplyScalar(def.speed), 1 - Math.exp(-1.2 * dt));
        p.pos.addScaledVector(p.vel, dt);
        p.pos.y = 1.0 + Math.sin(this.time * 1.3 + p.t) * 0.3;
        p.mesh.position.copy(p.pos);
        this._eu.set(0, Math.atan2(p.vel.x, p.vel.z), 0, "YXZ");
        p.mesh.quaternion.setFromEuler(this._eu);
        if (this.onHull(p.pos.x, p.pos.z, 18) && !p.dropped) {
          p.dropped = true;
          this.hitShip(def.bombDamage, p.pos);
          this.killPlane(p);
        }
        continue;
      }

      if (p.friendly) {
        this.updateFriendly(p, def, dt);
        continue;
      }

      if (p.kamikaze) {
        p.tgt.set(0, 12, 0);
        this.flyToward(p, p.tgt, def.speed * 1.35, 1.9, dt, 1.1);
        p.pos.addScaledVector(p.vel, dt);
        this.orientPlane(p, dt);
        if (this.onHull(p.pos.x, p.pos.z, 10) && p.pos.y < 80) {
          this.hitShip(def.bombDamage * 1.2, p.pos);
          this.killPlane(p);
        }
        if (p.smoke > 0 && Math.random() < p.smoke) this.spawnFx("smoke", p.pos, 4, 0.6);
        continue;
      }

      if (p.state === "ingress") {
        p.orbitAng = Math.atan2(p.pos.x, p.pos.z);
        this.orbitPoint(p, 0.55, p.tgt);
        this.flyToward(p, p.tgt, def.speed, 1.7, dt, 0.55);
        if (horiz < p.orbitR + 50 && horiz > p.orbitR * 0.4) {
          p.state = "orbit";
          p.nextRun = p.t + 1.8 + Math.random() * 2.8;
        }
      } else if (p.state === "orbit") {
        p.orbitAng += p.orbitDir * (def.speed / Math.max(80, p.orbitR)) * dt;
        this.orbitPoint(p, 0.7, p.tgt);
        p.tgt.y += Math.sin(p.t * 0.65) * 8;
        this.flyToward(p, p.tgt, def.speed, 1.45, dt, 0.42);
        if (p.t >= p.nextRun) this.beginRun(p);
      } else if (p.state === "run") {
        this.updateRun(p, def, dt, horiz);
      } else {
        p.orbitAng += p.orbitDir * (def.speed / Math.max(80, p.orbitR)) * 0.55 * dt;
        this.orbitPoint(p, 0.95, p.tgt);
        this.flyToward(p, p.tgt, def.speed * 0.98, 1.85, dt, 0.72);
        if (Math.abs(horiz - p.orbitR) < 80 && Math.abs(p.pos.y - p.orbitAlt) < 55) {
          p.state = "orbit";
          p.nextRun = p.t + 5.5 + Math.random() * 6;
        }
      }

      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 16) p.pos.y = 16;
      const far = p.pos.length();
      if (far > 2400) {
        p.pos.multiplyScalar(1800 / far);
        p.state = "ingress";
      }
      this.orientPlane(p, dt);
      if (p.smoke > 0 && Math.random() < p.smoke) this.spawnFx("smoke", p.pos, 4, 0.6);
    }
    this.audio.setDrone(closest < 800 ? 1 - closest / 800 : 0);
  }

  private orbitPoint(p: PlaneEnt, lead: number, out: THREE.Vector3) {
    const a = p.orbitAng + p.orbitDir * lead;
    out.set(Math.sin(a) * p.orbitR, p.orbitAlt, Math.cos(a) * p.orbitR);
  }

  private beginRun(p: PlaneEnt) {
    p.state = "run";
    p.dropped = false;
    p.nextRun = p.t;
    const horiz = Math.hypot(p.pos.x, p.pos.z) || 1;
    const nx = p.pos.x / horiz;
    const nz = p.pos.z / horiz;
    const atk = PLANES[p.type].attack;
    if (atk === "dive") {
      p.tgt.set(nx * 6, 18, nz * 6);
    } else if (atk === "torpedo") {
      p.tgt.set(-nx * 30, 20, -nz * 30);
    } else if (atk === "level") {
      p.tgt.set(-nx * 190, p.orbitAlt, -nz * 190);
    } else {
      p.tgt.set(-nx * 160, 36, -nz * 160);
    }
  }

  private updateRun(p: PlaneEnt, def: PlaneDef, dt: number, horiz: number) {
    const atk = def.attack;
    const goingOut = p.pos.x * p.vel.x + p.pos.z * p.vel.z > 0;
    const runAge = p.t - p.nextRun;

    if (atk === "dive") {
      this.flyToward(p, p.tgt, def.speed * 1.48, 2.5, dt, 1.2);
      if (!p.dropped && p.pos.y < 140 && this.onHull(p.pos.x, p.pos.z, 36)) {
        p.dropped = true;
        if (this.onHull(p.pos.x, p.pos.z, 8)) this.hitShip(def.bombDamage, p.pos);
        else this.nearMiss(p.pos, def.bombDamage * 0.35);
        this.finishRun(p, 1.0);
      } else if (p.pos.y < 32 || runAge > 10) {
        this.finishRun(p, 0.9);
      }
    } else if (atk === "torpedo") {
      p.tgt.y = 20;
      this.flyToward(p, p.tgt, def.speed, 1.55, dt, 0.32);
      if (!p.dropped && horiz < this.hullBox().bz + 90) {
        p.dropped = true;
        this.dropTorp(p.pos);
        this.finishRun(p, 1.15);
      } else if (runAge > 12) {
        this.finishRun(p, 1.0);
      }
    } else if (atk === "level") {
      this.flyToward(p, p.tgt, def.speed, 1.15, dt, 0.28);
      if (!p.dropped && this.onHull(p.pos.x, p.pos.z, 28)) {
        p.dropped = true;
        if (Math.random() < 0.55) this.hitShip(def.bombDamage, p.pos);
        else this.nearMiss(p.pos, 10);
      }
      if ((p.dropped && goingOut && horiz > this.hullBox().bz + 40) || runAge > 10) this.finishRun(p, 0.85);
    } else {
      this.flyToward(p, p.tgt, def.speed * 1.18, 2.15, dt, 0.7);
      if (!p.dropped && this.onHull(p.pos.x, p.pos.z, 12) && p.pos.y < 70) {
        p.dropped = true;
        this.strafeDeck(def.bombDamage, p.pos);
      }
      if (((p.dropped || horiz < 80) && goingOut && horiz > 100) || runAge > 7) this.finishRun(p, 0.7);
    }
  }

  private finishRun(p: PlaneEnt, lead: number) {
    p.state = "pullout";
    p.orbitAng = Math.atan2(p.pos.x, p.pos.z) + p.orbitDir * lead;
  }

  private strafeDeck(dmg: number, at: THREE.Vector3) {
    this.hull = Math.max(0, this.hull - dmg);
    this.trauma = Math.min(1, this.trauma + 0.22);
    this.audio.hullHit();
    this.spawnFx("flash", at.clone().setY(11), 7, 0.16);
    if (this.hull <= 0) this.finish(false);
  }

  private flyToward(
    p: PlaneEnt,
    target: THREE.Vector3,
    speed: number,
    agility: number,
    dt: number,
    maxPitch: number,
  ) {
    this.desired.copy(target).sub(p.pos);
    const dist = this.desired.length();
    if (dist > 1e-4) this.desired.multiplyScalar(1 / dist);
    else this.desired.copy(p.vel).normalize();
    const spd = Math.max(p.vel.length(), 8);
    this.steer.copy(p.vel).multiplyScalar(1 / spd);
    this.steer.lerp(this.desired, 1 - Math.exp(-agility * dt));
    const hy = Math.hypot(this.steer.x, this.steer.z);
    const pit = Math.atan2(this.steer.y, hy);
    const cp = THREE.MathUtils.clamp(pit, -maxPitch, maxPitch);
    const ch = Math.cos(cp);
    this.steer.y = Math.sin(cp);
    if (hy > 1e-4) {
      this.steer.x = (this.steer.x / hy) * ch;
      this.steer.z = (this.steer.z / hy) * ch;
    } else {
      this.steer.x = 0;
      this.steer.z = ch;
    }
    this.steer.normalize();
    p.vel.copy(this.steer).multiplyScalar(speed);
  }

  private orientPlane(p: PlaneEnt, dt: number) {
    const spd = p.vel.length();
    if (spd < 0.4) return;
    const yaw = Math.atan2(p.vel.x, p.vel.z);
    const pitch = -Math.asin(THREE.MathUtils.clamp(p.vel.y / spd, -0.92, 0.92));
    let dy = yaw - p.yaw;
    if (dy > Math.PI) dy -= Math.PI * 2;
    if (dy < -Math.PI) dy += Math.PI * 2;
    const yawRate = dy / Math.max(dt, 1e-4);
    p.yaw = yaw;
    p.pitch = pitch;
    const bank = THREE.MathUtils.clamp(-yawRate * 0.38, -0.9, 0.9);
    p.roll += (bank - p.roll) * (1 - Math.exp(-8 * dt));
    this._eu.set(p.pitch, p.yaw, p.roll, "YXZ");
    p.mesh.quaternion.setFromEuler(this._eu);
    p.mesh.position.copy(p.pos);
  }

  private nearMiss(pos: THREE.Vector3, splashDmg: number) {
    const p = pos.clone().setY(0.4);
    this.spawnFx("splash", p, 12, 0.7);
    this.audio.splash();
    if (this.onHull(pos.x, pos.z, 36)) this.hull = Math.max(0, this.hull - splashDmg);
  }

  private dropTorp(from: THREE.Vector3) {
    const t = this.torps.find((x) => !x.active);
    if (!t) return;
    t.active = true;
    t.pos.copy(from).setY(0.6);
    const dir = this.tmp.set(-from.x, 0, -from.z).normalize();
    t.vel.copy(dir).multiplyScalar(28);
    t.mesh.visible = true;
    t.mesh.position.copy(t.pos);
    t.mesh.lookAt(t.pos.x + t.vel.x, t.pos.y, t.pos.z + t.vel.z);
  }

  private updateTorps(dt: number) {
    for (const t of this.torps) {
      if (!t.active) continue;
      t.pos.addScaledVector(t.vel, dt);
      t.mesh.position.copy(t.pos);
      this.spawnFx("splash", t.pos, 2.5, 0.25);
      if (this.onHull(t.pos.x, t.pos.z, 6)) {
        t.active = false;
        t.mesh.visible = false;
        this.hitShip(48, t.pos);
      } else if (t.pos.length() > 2000) {
        t.active = false;
        t.mesh.visible = false;
      }
    }
  }

  private updateShots(dt: number) {
    for (const s of this.shots) {
      if (!s.active) continue;
      s.life += dt;
      s.vel.y -= WEAPONS[s.weapon].gravity * dt;
      this.shotFrom.copy(s.pos);
      s.pos.addScaledVector(s.vel, dt);
      this.shotTo.copy(s.pos);
      s.mesh.position.copy(s.pos);
      if (s.vel.lengthSq() > 1) {
        s.mesh.lookAt(s.pos.x + s.vel.x, s.pos.y + s.vel.y, s.pos.z + s.vel.z);
        s.mesh.rotateX(Math.PI / 2);
      }
      const extraR = s.fromPlayer
        ? 1.6 + (s.burst > 2 ? s.burst * 0.4 : s.burst * 0.15)
        : 0.5;
      let hit = false;
      for (const p of this.planes) {
        if (!p.alive || p.dead || p.friendly) continue;
        if (!this.shotHitsPlane(p, this.shotFrom, this.shotTo, extraR, s.fromPlayer)) continue;
        if (s.weapon === "fiveinch" || s.burst > 4) this.burst(s.pos, s.burst, s.damage, s.fromPlayer);
        else {
          this.hurtPlane(p, s.damage, s.fromPlayer);
          if (s.fromPlayer) this.shotsHit += 1;
          this.spawnFx("flash", s.pos, 2.4, 0.08);
        }
        hit = true;
        break;
      }
      for (const t of this.torps) {
        if (!t.active) continue;
        if (t.pos.distanceTo(s.pos) < 8) {
          t.active = false;
          t.mesh.visible = false;
          this.burst(t.pos, 8, 20, true);
          this.score += 80;
          hit = true;
        }
      }
      const vt = this.mission.vt && s.weapon === "fiveinch";
      if (!hit && s.weapon === "fiveinch" && (s.life >= s.fuse || (vt && this.nearAny(s.pos, 36)))) {
        this.burst(s.pos, s.burst, s.damage, true);
        hit = true;
      }
      if (s.pos.y < 0) {
        this.spawnFx("splash", s.pos.clone().setY(0.4), s.weapon === "fiveinch" ? 8 : 3, 0.35);
        hit = true;
      }
      if (hit || s.life > 3.2 || s.pos.length() > 2500) {
        s.active = false;
        s.mesh.visible = false;
      }
    }
  }

  private distSqPointSeg(c: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
    this.hitSeg.copy(b).sub(a);
    const lenSq = this.hitSeg.lengthSq();
    let t = 0;
    if (lenSq > 1e-8) {
      t = THREE.MathUtils.clamp(this.hitClosest.copy(c).sub(a).dot(this.hitSeg) / lenSq, 0, 1);
    }
    this.hitClosest.copy(a).addScaledVector(this.hitSeg, t);
    return this.hitClosest.distanceToSquared(c);
  }

  private shotHitsPlane(
    p: PlaneEnt,
    from: THREE.Vector3,
    to: THREE.Vector3,
    extraR: number,
    generous = true,
  ): boolean {
    const def = PLANES[p.type];
    const r = def.hitR * (generous ? 1 : 0.38) + extraR;
    const r2 = r * r;
    const half = def.hitLen * 0.5;
    const spd = p.vel.length();
    let fx = Math.sin(p.yaw);
    let fy = 0;
    let fz = Math.cos(p.yaw);
    if (spd > 0.4) {
      fx = p.vel.x / spd;
      fy = p.vel.y / spd;
      fz = p.vel.z / spd;
    }
    const ks = def.hitLen > 42 ? ([-0.95, -0.5, 0, 0.5, 0.95] as const) : ([-0.85, 0, 0.85] as const);
    for (const k of ks) {
      this.tmp2.set(p.pos.x + fx * half * k, p.pos.y + fy * half * k, p.pos.z + fz * half * k);
      if (this.distSqPointSeg(this.tmp2, from, to) <= r2) return true;
    }
    return false;
  }

  private nearAny(pos: THREE.Vector3, r: number) {
    for (const p of this.planes) {
      if (!p.alive || p.dead || p.friendly) continue;
      if (p.pos.distanceTo(pos) < r + PLANES[p.type].hitR * 0.4) return true;
    }
    return false;
  }

  private updateFx(dt: number) {
    for (const f of this.fx) {
      if (!f.active) continue;
      f.t += dt;
      f.pos.addScaledVector(f.vel, dt);
      f.vel.y += f.kind === "smoke" ? 4 * dt : 0;
      f.mesh.position.copy(f.pos);
      const k = 1 - f.t / f.life;
      if (f.mesh instanceof THREE.Sprite) {
        const sc = f.scale * (f.kind === "flak" ? 1 + (1 - k) * 2.5 : 1 + (1 - k) * 0.8);
        f.mesh.scale.setScalar(sc);
        f.mesh.material.opacity = Math.max(0, k) * (f.kind === "flash" ? 0.9 : 0.5);
      }
      if (f.t >= f.life) {
        f.active = false;
        f.mesh.visible = false;
      }
    }
  }

  private present(dt: number) {
    if (this.water?.material?.uniforms?.["time"]) {
      (this.water.material.uniforms["time"].value as number) += dt;
    }
    const shake = this.trauma * this.trauma * this.settings.shake;
    const fov = THREE.MathUtils.lerp(BASE_FOV, ZOOM_FOV, this.zoom);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    if (this.playing && shake > 0.001) {
      this.camera.position.set(
        (Math.random() - 0.5) * shake * 0.45,
        (Math.random() - 0.5) * shake * 0.35,
        (Math.random() - 0.5) * shake * 0.25,
      );
    } else {
      this.camera.position.set(0, 0, 0);
    }
    const id = this.weapon();
    const vm = this.viewmodels[id];
    if (vm) {
      vm.visible = this.playing;
      vm.position.set(0.12, -0.22 - this.recoil * 0.4, -0.55 - this.recoil);
    }
    this.muzzleSpr.visible = this.playing && this.muzzle > 0;
    this.muzzleSpr.material.opacity = this.muzzle * 18;
    const n = this.nearestInSights(0.92);
    this.rangeYd = n ? n.pos.distanceTo(this.camera.getWorldPosition(this.tmp)) * YARDS : 0;
    void this.aim;
  }

  private pushHud() {
    const id = this.weapon();
    const threats: HudSnapshot["threats"] = [];
    this.camera.updateMatrixWorld();
    for (const p of this.planes) {
      if (!p.alive || p.dead || p.friendly) continue;
      this.tmp.copy(p.pos).project(this.camera);
      const on = Math.abs(this.tmp.x) < 1 && Math.abs(this.tmp.y) < 1 && this.tmp.z < 1 && this.tmp.z > 0;
      threats.push({ x: this.tmp.x, y: this.tmp.y, kind: p.type, onscreen: on });
    }
    const liveFleet = this.fleet.filter((f) => !f.sunk);
    const fleet = liveFleet.length
      ? (liveFleet.reduce((a, s) => a + s.hp, 0) / liveFleet.reduce((a, s) => a + s.max, 0)) * 100
      : 100;
    useGame.getState().setHud({
      weapon: id,
      weapons: [...this.weapons],
      ammo: this.ammo[id] + this.mag[id],
      mag: this.mag[id],
      reloading: this.reloadT > 0,
      hull: this.hull,
      hullMax: this.hullMax,
      fleet,
      score: this.score,
      kills: this.kills,
      shots: this.shotsFired,
      hits: this.shotsHit,
      rangeYd: this.rangeYd,
      heading: THREE.MathUtils.radToDeg(((this.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)),
      elevation: THREE.MathUtils.radToDeg(this.pitch),
      callout: this.callout,
      waveLabel: this.waveLabelT > 0 ? this.waveLabel : "",
      zoom: this.zoom,
      threats,
      time: this.time,
      locked: document.pointerLockElement === this.canvas,
      mobile: window.matchMedia("(pointer: coarse)").matches,
    });
  }

  private resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  private wireProbe() {
    window.__controlsTest = {
      getYaw: () => this.yaw,
      getSpeed: () => 1,
      setKeys: (codes: string[]) => this.input.setKeys(codes),
      setSteer: (v: number) => {
        this.input.setKeys(v > 0.1 ? ["KeyA"] : v < -0.1 ? ["KeyD"] : []);
      },
      titleMusic: () => this.audio.debugTitle(),
      getZoom: () => this.zoom,
      getWeapons: () => [...this.weapons],
      getScriptI: () => this.scriptI,
      getThreats: () => this.threatCount(),
    };
    window.__planeDebug = () =>
      this.planes
        .filter((p) => p.alive && !p.dead)
        .map((p) => ({
          type: p.type,
          state: p.state,
          x: Math.round(p.pos.x),
          y: Math.round(p.pos.y),
          z: Math.round(p.pos.z),
          r: Math.round(Math.hypot(p.pos.x, p.pos.z)),
          spd: Math.round(p.vel.length()),
          yaw: Math.round(THREE.MathUtils.radToDeg(p.yaw)),
          hitR: PLANES[p.type].hitR,
          hitLen: PLANES[p.type].hitLen,
          hp: Math.round(p.hp),
        }));
    window.__hitTest = {
      radii: () =>
        Object.fromEntries(Object.values(PLANES).map((d) => [d.id, { hitR: d.hitR, hitLen: d.hitLen }])),
      probeNearest: () => {
        const origin = this.camera.getWorldPosition(this.tmp3);
        this.fwd.set(0, 0, -1).applyQuaternion(this.camera.getWorldQuaternion(this._q));
        const p = this.nearestInSights(0.02);
        if (!p) return { hit: false, dist: 0, type: null as string | null, hitR: 0 };
        const to = origin.clone().addScaledVector(this.fwd, 2000);
        const hit = this.shotHitsPlane(p, origin, to, 1.6);
        return {
          hit,
          dist: Math.round(p.pos.distanceTo(origin)),
          type: p.type,
          hitR: PLANES[p.type].hitR,
          hp: Math.round(p.hp),
        };
      },
      rayHits: (ox: number, oy: number, oz: number, tx: number, ty: number, tz: number) => {
        this.shotFrom.set(ox, oy, oz);
        this.shotTo.set(tx, ty, tz);
        const hits: { type: string; hp: number }[] = [];
        for (const p of this.planes) {
          if (!p.alive || p.dead || p.friendly) continue;
          if (this.shotHitsPlane(p, this.shotFrom, this.shotTo, 1.6)) hits.push({ type: p.type, hp: p.hp });
        }
        return hits;
      },
    };
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.exitLock();
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    document.removeEventListener("visibilitychange", this.visHandler);
    this.input.dispose();
    this.audio.dispose();
    this.tracerGeo.dispose();
    this.tracerMat.dispose();
    this.smokeTex.dispose();
    this.flashTex.dispose();
    this.renderer.dispose();
    delete window.__controlsTest;
    delete window.__planeDebug;
    delete window.__hitTest;
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
      setSteer?: (v: number) => void;
      titleMusic?: () => { ctx: string; wanted: boolean; loaded: boolean; playing: boolean; dur: number };
      getZoom?: () => number;
      getWeapons?: () => WeaponId[];
      getScriptI?: () => number;
      getThreats?: () => number;
    };
    __planeDebug?: () => {
      type: PlaneId;
      state: string;
      x: number;
      y: number;
      z: number;
      r: number;
      spd: number;
      yaw: number;
      hitR: number;
      hitLen: number;
      hp: number;
    }[];
    __hitTest?: {
      radii: () => Record<string, { hitR: number; hitLen: number }>;
      probeNearest: () => { hit: boolean; dist: number; type: string | null; hitR: number; hp?: number };
      rayHits: (
        ox: number,
        oy: number,
        oz: number,
        tx: number,
        ty: number,
        tz: number,
      ) => { type: string; hp: number }[];
    };
  }
}
