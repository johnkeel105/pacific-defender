import { useEffect, useRef, type RefObject } from "react";
import {
  MISSIONS,
  PLANES,
  WEAPONS,
  missionHasUnlocks,
  type MissionDef,
  type PlaneId,
  type WeaponId,
} from "./data";
import type { GameEngine } from "./engine";
import { loadSave, saveSettings } from "./save";
import { useGame } from "./store";

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const screen = useGame((s) => s.screen);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let engine: GameEngine | null = null;
    void (async () => {
      const { GameEngine } = await import("./engine");
      if (cancelled) return;
      engine = new GameEngine(canvas, useGame.getState().settings);
      engineRef.current = engine;
      await engine.init();
      if (cancelled) return;
      const sc = useGame.getState().screen;
      engine.setMenuMusic(sc !== "playing" && sc !== "paused");
    })();
    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const kick = () => {
      const eng = engineRef.current;
      if (!eng) return;
      eng.unlockAudio();
      const sc = useGame.getState().screen;
      eng.setMenuMusic(sc !== "playing" && sc !== "paused");
    };
    window.addEventListener("pointerdown", kick);
    window.addEventListener("keydown", kick);
    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setMenuMusic(screen !== "playing" && screen !== "paused");
  }, [screen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useGame.getState();
      if (e.code === "Escape") {
        if (st.screen === "playing") {
          engineRef.current?.exitLock();
          st.setScreen("paused");
        } else if (st.screen === "paused") {
          st.setScreen("playing");
          void engineRef.current?.requestLock();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const startMission = (id: string) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.unlockAudio();
    useGame.getState().resetHud();
    useGame.getState().setMission(id);
    useGame.getState().setScreen("playing");
    eng.startMission(id);
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onContextMenu={(e) => e.preventDefault()}
      />
      {screen === "playing" ? (
        <Hud
          onPause={() => {
            engineRef.current?.exitLock();
            useGame.getState().setScreen("paused");
          }}
          onFire={(on) => engineRef.current?.setFire(on)}
          onCycle={(d) => engineRef.current?.cycleWeapon(d)}
          onPick={(id) => engineRef.current?.pickWeapon(id)}
          onZoom={(on) => engineRef.current?.setZoomHold(on)}
          onRelock={() => void engineRef.current?.requestLock()}
        />
      ) : null}
      {screen === "title" ? <Title onStart={startMission} /> : null}
      {screen === "campaign" ? <Campaign onStart={startMission} /> : null}
      {screen === "briefing" ? <Briefing onStart={startMission} /> : null}
      {screen === "paused" ? (
        <Paused
          onResume={() => {
            useGame.getState().setScreen("playing");
            void engineRef.current?.requestLock();
          }}
          onQuit={() => {
            engineRef.current?.stopMission();
            useGame.getState().setScreen("title");
          }}
        />
      ) : null}
      {screen === "debrief" ? <Debrief onStart={startMission} /> : null}
      {screen === "armory" ? <Armory /> : null}
      {screen === "settings" ? <SettingsPanel engine={engineRef} /> : null}
    </div>
  );
}

function Title({ onStart }: { onStart: (id: string) => void }) {
  const setScreen = useGame((s) => s.setScreen);
  return (
    <div className="absolute inset-0 flex items-end sm:items-center">
      <div className="w-full max-w-xl bg-gradient-to-r from-bg via-bg/92 to-transparent p-6 pb-10 sm:p-12">
      <div className="max-w-xl">
        <p className="font-display text-sm tracking-[0.35em] text-muted uppercase">U.S. Pacific Fleet · 1941–1945</p>
        <h1 className="mt-3 font-display text-5xl leading-none tracking-tight text-fg sm:text-7xl">
          Pacific
          <br />
          Defender
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
          A sequel to Defend the Fleet. Man period anti-aircraft batteries — .50 caliber, 20 mm Oerlikon,
          40 mm Bofors, and the 5"/38 — against Zeroes, Vals, Kates, and the kamikazes that followed.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Btn primary onClick={() => setScreen("campaign")}>
            Start campaign
          </Btn>
          <Btn onClick={() => onStart("range")}>Gunnery range</Btn>
          <Btn onClick={() => setScreen("armory")}>Armory</Btn>
          <Btn onClick={() => setScreen("settings")}>Settings</Btn>
        </div>
        <p className="mt-4 text-xs tracking-wide text-subtle">Click to start the band — 1941 swing, original chart.</p>
      </div>
      </div>
    </div>
  );
}

function Campaign({ onStart }: { onStart: (id: string) => void }) {
  const save = loadSave();
  const setScreen = useGame((s) => s.setScreen);
  const setMission = useGame((s) => s.setMission);
  return (
    <Panel onBack={() => setScreen("title")} title="Campaign" kicker="Central Pacific">
      <div className="grid gap-3">
        {MISSIONS.map((m) => {
          const locked = !save.unlocked.includes(m.id) && m.id !== "pearl";
          const best = save.best[m.id];
          return (
            <button
              key={m.id}
              disabled={locked}
              onClick={() => {
                setMission(m.id);
                setScreen("briefing");
                void onStart;
              }}
              className="rounded-xl border border-border bg-raised/80 p-4 text-left transition hover:border-border-strong disabled:opacity-40"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-xl tracking-wide">{m.name}</span>
                <span className="text-xs text-subtle">{locked ? "Locked" : m.date}</span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {m.ship} · {m.location}
              </p>
              {best != null ? <p className="mt-2 text-xs text-steel">Best {best}</p> : null}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function Briefing({ onStart }: { onStart: (id: string) => void }) {
  const missionId = useGame((s) => s.missionId);
  const setScreen = useGame((s) => s.setScreen);
  const m = MISSIONS.find((x) => x.id === missionId) ?? MISSIONS[0]!;
  return (
    <Panel onBack={() => setScreen("campaign")} title={m.name} kicker={m.date}>
      <p className="text-sm leading-relaxed text-muted">{m.briefing}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Meta label="Ship" value={m.ship} />
        <Meta label="Station" value={m.location} />
        <Meta label="Battery" value={m.weapons.map((w) => WEAPONS[w].short).join(" · ")} />
        <Meta
          label="Fuzes"
          value={m.vt ? "VT proximity" : "Time / contact"}
        />
      </div>
      {missionHasUnlocks(m) ? (
        <p className="mt-4 text-sm text-muted">
          More mounts come online mid-action. Do not auto-shift — the talker will call the key.
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Btn primary onClick={() => onStart(m.id)}>
          Man the guns
        </Btn>
        <Btn onClick={() => setScreen("campaign")}>Back</Btn>
      </div>
    </Panel>
  );
}

function Paused({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg/70 p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-panel)]">
        <p className="font-display text-sm tracking-[0.25em] text-muted uppercase">Paused</p>
        <h2 className="mt-1 font-display text-3xl">Secure the mount</h2>
        <div className="mt-6 flex flex-col gap-3">
          <Btn primary onClick={onResume}>
            Resume
          </Btn>
          <Btn onClick={onQuit}>Return to title</Btn>
        </div>
        <p className="mt-5 text-xs leading-relaxed text-subtle">
          Mouse aims · LMB or Space fires · 1–4 batteries · Shift or RMB zooms · wheel sets zoom · R
          reloads · Esc pauses. On a touch screen, drag the right side to aim and hold Zoom.
        </p>
      </div>
    </div>
  );
}

function Debrief({ onStart }: { onStart: (id: string) => void }) {
  const d = useGame((s) => s.debrief);
  const setScreen = useGame((s) => s.setScreen);
  if (!d) return null;
  const idx = MISSIONS.findIndex((m) => m.id === d.missionId);
  const next = MISSIONS[idx + 1];
  return (
    <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-bg via-bg/80 to-bg/20 p-6 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface/95 p-6 shadow-[var(--shadow-panel)]">
        <p className="font-display text-sm tracking-[0.25em] text-muted uppercase">{d.win ? "Action complete" : "Ship lost"}</p>
        <h2 className="mt-1 font-display text-4xl">{d.win ? "Battery secure" : "Abandon ship"}</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat n={String(d.score)} l="Score" />
          <Stat n={String(d.kills)} l="Destroyed" />
          <Stat n={`${Math.round(d.accuracy * 100)}%`} l="Hits" />
          <Stat n={d.grade} l="Grade" />
        </div>
        <div className="mt-5 space-y-1 text-sm text-muted">
          {(Object.keys(d.byType) as PlaneId[]).map((k) => (
            <div key={k} className="flex justify-between">
              <span>{PLANES[k].allied}</span>
              <span className="tabular-nums text-fg">{d.byType[k]}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {d.win && next ? (
            <Btn
              primary
              onClick={() => {
                useGame.getState().setMission(next.id);
                setScreen("briefing");
              }}
            >
              Next action
            </Btn>
          ) : (
            <Btn primary onClick={() => onStart(d.missionId)}>
              Fight again
            </Btn>
          )}
          <Btn onClick={() => setScreen("title")}>Title</Btn>
        </div>
      </div>
    </div>
  );
}

function Armory() {
  const setScreen = useGame((s) => s.setScreen);
  return (
    <Panel onBack={() => setScreen("title")} title="Ship’s armory" kicker="Period batteries">
      <div className="grid gap-4">
        {(Object.keys(WEAPONS) as WeaponId[]).map((id) => {
          const w = WEAPONS[id];
          return (
            <article key={id} className="rounded-xl border border-border bg-raised/70 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-2xl">{w.name}</h3>
                <span className="text-xs text-subtle">{w.year}</span>
              </div>
              <p className="mt-1 text-xs tracking-wide text-steel uppercase">{w.caliber}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{w.blurb}</p>
              <p className="mt-3 text-xs text-subtle">
                {w.rpm} rpm · muzzle {w.muzzle} m/s · {w.auto ? "automatic" : "single"} · mag {w.mag}
              </p>
            </article>
          );
        })}
        <div className="rounded-xl border border-border bg-raised/70 p-4">
          <h3 className="font-display text-2xl">Aircraft you will see</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {(Object.keys(PLANES) as PlaneId[])
              .filter((id) => PLANES[id].hostile !== false)
              .map((id) => (
              <li key={id}>
                <span className="text-fg">{PLANES[id].allied}</span> — {PLANES[id].name}. {PLANES[id].blurb}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function SettingsPanel({ engine }: { engine: RefObject<GameEngine | null> }) {
  const settings = useGame((s) => s.settings);
  const patch = useGame((s) => s.patchSettings);
  const setScreen = useGame((s) => s.setScreen);
  const apply = (p: Partial<typeof settings>) => {
    const next = { ...settings, ...p };
    patch(p);
    saveSettings(next);
    engine.current?.applySettings(next);
  };
  return (
    <Panel onBack={() => setScreen("title")} title="Settings" kicker="Battery">
      <label className="block text-sm text-muted">
        Look sensitivity
        <input
          type="range"
          min={0.0008}
          max={0.005}
          step={0.0001}
          value={settings.sensitivity}
          onChange={(e) => apply({ sensitivity: Number(e.target.value) })}
          className="mt-2 w-full accent-steel"
        />
      </label>
      <label className="mt-4 flex items-center gap-3 text-sm text-muted">
        <input
          type="checkbox"
          checked={settings.invertY}
          onChange={(e) => apply({ invertY: e.target.checked })}
        />
        Invert vertical look
      </label>
      <label className="mt-4 block text-sm text-muted">
        Recoil shake
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.shake}
          onChange={(e) => apply({ shake: Number(e.target.value) })}
          className="mt-2 w-full accent-steel"
        />
      </label>
      <label className="mt-4 block text-sm text-muted">
        Master volume
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.master}
          onChange={(e) => apply({ master: Number(e.target.value) })}
          className="mt-2 w-full accent-steel"
        />
      </label>
      <label className="mt-4 block text-sm text-muted">
        Guns and hits
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.sfx}
          onChange={(e) => apply({ sfx: Number(e.target.value) })}
          className="mt-2 w-full accent-steel"
        />
      </label>
      <label className="mt-4 block text-sm text-muted">
        Title band
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.music}
          onChange={(e) => apply({ music: Number(e.target.value) })}
          className="mt-2 w-full accent-steel"
        />
      </label>
    </Panel>
  );
}

function Hud({
  onPause,
  onFire,
  onCycle,
  onPick,
  onZoom,
  onRelock,
}: {
  onPause: () => void;
  onFire: (on: boolean) => void;
  onCycle: (d: number) => void;
  onPick: (id: WeaponId) => void;
  onZoom: (on: boolean) => void;
  onRelock: () => void;
}) {
  const hud = useGame((s) => s.hud);
  const missionId = useGame((s) => s.missionId);
  const mission: MissionDef | undefined = missionId === "range" ? undefined : MISSIONS.find((m) => m.id === missionId);
  const w = WEAPONS[hud.weapon];
  const weapons = hud.weapons.length ? hud.weapons : mission ? mission.weapons : (Object.keys(WEAPONS) as WeaponId[]);
  const acc = hud.shots ? Math.round((hud.hits / hud.shots) * 100) : 0;

  return (
    <>
      <div className="pointer-events-none absolute inset-0">
        <Sight weapon={hud.weapon} zoom={hud.zoom} />
        <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-3">
          <div className="rounded-lg border border-border bg-bg/55 px-3 py-2 backdrop-blur-sm">
            <p className="font-display text-xs tracking-[0.2em] text-muted uppercase">{mission?.name ?? "Gunnery range"}</p>
            <p className="font-display text-2xl tabular-nums leading-none">{hud.score}</p>
            <p className="mt-1 text-[11px] text-subtle">
              {hud.kills} destroyed · {acc}% hits
            </p>
          </div>
          <div className="rounded-lg border border-border bg-bg/55 px-3 py-2 text-right backdrop-blur-sm">
            <p className="text-[11px] tracking-wide text-muted uppercase">{w.short}</p>
            <p className="font-display text-2xl tabular-nums leading-none">
              {hud.mag}
              <span className="text-sm text-muted">/{hud.ammo}</span>
            </p>
            <p className="mt-1 text-[11px] text-subtle">
              {hud.reloading ? "Loading" : hud.rangeYd > 0 ? `${Math.round(hud.rangeYd)} yd` : "No track"}
            </p>
          </div>
        </div>
        <div className="absolute top-28 left-4 w-40">
          <Bar label="Hull" value={hud.hull / hud.hullMax} warn />
        </div>
        {hud.waveLabel ? (
          <div className="absolute top-20 left-1/2 w-[min(92vw,32rem)] -translate-x-1/2 rounded-md border border-steel/40 bg-bg/75 px-4 py-2 text-center font-display text-lg tracking-[0.12em] text-fg uppercase">
            {hud.waveLabel}
          </div>
        ) : null}
        {hud.callout && hud.callout !== hud.waveLabel ? (
          <div className="absolute top-36 left-1/2 w-[min(92vw,28rem)] -translate-x-1/2 rounded-md border border-border bg-bg/70 px-3 py-2 text-center text-sm text-fg">
            {hud.callout}
          </div>
        ) : null}
        {hud.threats
          .filter((t) => t.onscreen)
          .slice(0, 6)
          .map((t, i) => (
            <div
              key={i}
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 border border-steel/80"
              style={{ left: `${50 + t.x * 50}%`, top: `${50 - t.y * 50}%` }}
            />
          ))}
      </div>

      {!hud.locked && !hud.mobile ? (
        <button
          className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface/90 px-4 py-2 font-display text-sm tracking-wide"
          onClick={onRelock}
        >
          Click to capture mouse
        </button>
      ) : null}

      <div className="absolute right-4 bottom-4 left-4 flex items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {weapons.map((id) => (
            <button
              key={id}
              onClick={() => onPick(id)}
              className={`min-h-11 rounded-md border px-3 py-2 font-display text-sm tracking-wide ${
                hud.weapon === id ? "border-steel bg-raised text-fg" : "border-border bg-bg/60 text-muted"
              }`}
            >
              {WEAPONS[id].key} {WEAPONS[id].short}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {hud.mobile ? (
            <>
              <button
                className="min-h-11 rounded-md border border-border bg-bg/70 px-3 font-display text-sm"
                onPointerDown={() => onZoom(true)}
                onPointerUp={() => onZoom(false)}
                onPointerCancel={() => onZoom(false)}
              >
                Zoom
              </button>
              <button
                className="min-h-11 rounded-md border border-border bg-bg/70 px-3 font-display text-sm"
                onClick={() => onCycle(1)}
              >
                Cycle
              </button>
              <button
                className="min-h-16 min-w-16 rounded-full border border-border-strong bg-raised font-display text-sm"
                onPointerDown={() => onFire(true)}
                onPointerUp={() => onFire(false)}
                onPointerCancel={() => onFire(false)}
              >
                Fire
              </button>
            </>
          ) : null}
          <button
            onClick={onPause}
            className="min-h-11 rounded-md border border-border bg-bg/70 px-4 font-display text-sm"
          >
            Pause
          </button>
        </div>
      </div>
    </>
  );
}

function Sight({ weapon, zoom }: { weapon: WeaponId; zoom: number }) {
  const heavy = weapon === "fiveinch" || weapon === "bofors";
  const size = heavy ? 96 : 56;
  const s = size * (1 - zoom * 0.28);
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <div
        className={`rounded-full border ${heavy ? "border-steel/70" : "border-fg/70"}`}
        style={{ width: s, height: s }}
      />
      <div className="absolute top-1/2 left-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-fg" />
      <div className="absolute top-1/2 left-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-fg" />
    </div>
  );
}

function Panel({
  title,
  kicker,
  onBack,
  children,
}: {
  title: string;
  kicker: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 overflow-y-auto bg-gradient-to-r from-bg via-bg/88 to-bg/25 p-5 sm:p-10">
      <div className="mx-auto w-full max-w-2xl pb-16">
        <button onClick={onBack} className="text-sm text-muted hover:text-fg">
          Back
        </button>
        <p className="mt-6 font-display text-sm tracking-[0.3em] text-muted uppercase">{kicker}</p>
        <h2 className="font-display text-4xl tracking-tight">{title}</h2>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-11 rounded-lg px-5 py-2.5 font-display text-base tracking-wide transition ${
        primary ? "bg-fg text-bg hover:bg-steel" : "border border-border bg-surface/80 text-fg hover:border-border-strong"
      }`}
    >
      {children}
    </button>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-raised/60 px-3 py-2">
      <p className="text-[11px] tracking-wide text-subtle uppercase">{label}</p>
      <p className="mt-0.5 text-sm text-fg">{value}</p>
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <p className="font-display text-2xl tabular-nums">{n}</p>
      <p className="text-[11px] tracking-wide text-subtle uppercase">{l}</p>
    </div>
  );
}

function Bar({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  const v = Math.max(0, Math.min(1, value));
  const color = warn ? (v < 0.35 ? "bg-danger" : v < 0.65 ? "bg-warn" : "bg-ok") : v > 0.8 ? "bg-danger" : "bg-steel";
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] tracking-wide text-subtle uppercase">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(v * 100)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-raised">
        <div className={`h-full ${color}`} style={{ width: `${v * 100}%` }} />
      </div>
    </div>
  );
}
