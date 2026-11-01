#!/usr/bin/env python3
"""Original 1940s swing title theme for Pacific Defender.

Inspired by the energy of a wartime big band — walking bass, brass stabs,
swung 8ths — but an original 12-bar chart in Bb. Not a transcription of
any copyrighted tune.
"""

from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np

SR = 44100
BPM = 160.0
BEAT = 60.0 / BPM
SWING = 2.0 / 3.0  # off-eighth lands at 2/3 of the beat
BARS = 24
N = int(round(BARS * 4 * BEAT * SR))


def midi_hz(m: float) -> float:
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))


def eighth_time(bar: int, eighth: int) -> float:
    beat = bar * 4 + eighth // 2
    off = eighth % 2
    return (beat + (SWING if off else 0.0)) * BEAT


def eighth_dur(bar: int, eighth: int, n_eighths: int) -> float:
    t0 = eighth_time(bar, eighth)
    e1 = eighth + n_eighths
    bar1 = bar + e1 // 8
    e1 = e1 % 8
    t1 = eighth_time(bar1, e1)
    if t1 <= t0:
        t1 = t0 + n_eighths * BEAT * 0.5
    return t1 - t0


def env(n: int, atk=0.01, rel=0.05, hold=1.0) -> np.ndarray:
    t = np.arange(n, dtype=np.float64) / SR
    dur = n / SR
    a = np.clip(t / max(atk, 1e-4), 0, 1)
    r0 = max(dur - rel, 0)
    r = np.clip((dur - t) / max(rel, 1e-4), 0, 1)
    body = np.minimum(a, r)
    return body * (hold + (1 - hold) * np.exp(-t * 6))


def add_partials(freq: float, n: int, amps: list[float], detune=0.002) -> np.ndarray:
    t = np.arange(n, dtype=np.float64) / SR
    sig = np.zeros(n, dtype=np.float64)
    for i, amp in enumerate(amps, start=1):
        if amp == 0:
            continue
        f = freq * i
        sig += amp * np.sin(2 * np.pi * f * t)
        if detune and i <= 3:
            sig += amp * 0.35 * np.sin(2 * np.pi * f * (1 + detune) * t)
    return sig


def place(bus: np.ndarray, t0: float, sig: np.ndarray, pan: float = 0.0, gain: float = 1.0) -> None:
    start = int(t0 * SR)
    n = sig.shape[0]
    i0 = max(0, start)
    i1 = min(bus.shape[1], start + n)
    if i1 <= i0:
        return
    sl = sig[i0 - start : i0 - start + (i1 - i0)] * gain
    l = math.sqrt(0.5 * (1.0 - pan))
    r = math.sqrt(0.5 * (1.0 + pan))
    bus[0, i0:i1] += sl * l
    bus[1, i0:i1] += sl * r


def noise(n: int) -> np.ndarray:
    return np.random.default_rng(7).standard_normal(n)


# --- one-shots ---
def kick() -> np.ndarray:
    n = int(0.28 * SR)
    t = np.arange(n) / SR
    f = 108 * np.exp(-t * 14) + 36
    sig = np.sin(2 * np.pi * f * t) * np.exp(-t * 10)
    sig += 0.15 * np.sin(2 * np.pi * 55 * t) * np.exp(-t * 8)
    return sig * env(n, 0.004, 0.12)


def snare() -> np.ndarray:
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(11)
    nz = rng.standard_normal(n)
    # crude highpass
    hp = np.diff(nz, prepend=0)
    sig = 0.7 * hp * np.exp(-t * 22)
    sig += 0.25 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 18)
    return sig * env(n, 0.003, 0.08)


def hat(closed=True) -> np.ndarray:
    n = int((0.07 if closed else 0.16) * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(3)
    nz = rng.standard_normal(n)
    hp = np.diff(nz, prepend=0)
    k = 28 if closed else 14
    return hp * np.exp(-t * k) * env(n, 0.001, 0.03)


def ride() -> np.ndarray:
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(19)
    nz = rng.standard_normal(n)
    hp = np.diff(nz, prepend=0)
    sig = 0.45 * hp * np.exp(-t * 9)
    sig += 0.22 * np.sin(2 * np.pi * 3400 * t) * np.exp(-t * 12)
    sig += 0.14 * np.sin(2 * np.pi * 5100 * t) * np.exp(-t * 16)
    sig += 0.08 * np.sin(2 * np.pi * 7800 * t) * np.exp(-t * 20)
    return sig * env(n, 0.001, 0.12)


KICK = kick()
SNARE = snare()
HAT = hat(True)
RIDE = ride()

# 12-bar blues in Bb: I I I I | IV IV I I | V IV I V
CHORDS = [
    "Bb7", "Bb7", "Bb7", "Bb7",
    "Eb7", "Eb7", "Bb7", "Bb7",
    "F7", "Eb7", "Bb7", "F7",
]
VOICES = {
    "Bb7": (58, 62, 65, 68),   # Bb D F Ab
    "Eb7": (58, 63, 67, 70),   # Bb Eb G C
    "F7": (57, 60, 65, 68),    # A C F Ab
}
BASS = [
    [34, 38, 41, 38],
    [34, 36, 37, 38],
    [34, 38, 39, 40],
    [41, 38, 34, 33],
    [39, 43, 46, 43],
    [39, 41, 43, 44],
    [34, 38, 41, 45],
    [46, 45, 43, 41],
    [41, 45, 48, 45],
    [39, 43, 46, 43],
    [34, 38, 41, 38],
    [41, 43, 44, 45],
]
# stab pattern per bar-in-form: list of (eighth, dur_eighths)
STABS = [
    [(0, 3), (6, 2)],
    [(0, 1), (3, 1), (6, 2)],
    [(0, 3), (6, 2)],
    [(0, 1), (3, 1), (4, 2)],
    [(0, 2), (4, 3)],
    [(0, 1), (3, 1), (6, 2)],
    [(0, 3), (6, 2)],
    [(0, 1), (3, 1), (6, 2)],
    [(0, 2), (3, 1), (6, 2)],
    [(0, 2), (4, 3)],
    [(0, 3), (6, 2)],
    [(0, 2), (3, 1), (6, 1)],
]

# Chorus-2 trumpet obligato: (bar, eighth, dur_eighths, midi)
LEAD = [
    (12, 6, 2, 70),
    (13, 0, 2, 70), (13, 2, 2, 73), (13, 4, 3, 70),
    (14, 6, 2, 65),
    (15, 0, 2, 68), (15, 2, 2, 70), (15, 4, 4, 74),
    (16, 2, 2, 75), (16, 4, 2, 73), (16, 6, 2, 70),
    (17, 0, 4, 68), (17, 6, 2, 70),
    (18, 4, 2, 77), (18, 6, 2, 75),
    (19, 0, 2, 73), (19, 2, 2, 70), (19, 4, 4, 68),
    (20, 0, 3, 72), (20, 4, 4, 70),
    (21, 0, 4, 68), (21, 4, 2, 70),
    (22, 0, 6, 70),
    (23, 0, 3, 69), (23, 4, 4, 65),
]


def brass_note(midi: float, dur: float, bite: float) -> np.ndarray:
    n = int(max(dur, 0.04) * SR)
    sig = add_partials(midi_hz(midi), n, [1.0, 0.55, 0.38, 0.22, 0.12, 0.08], detune=0.0018)
    e = env(n, atk=0.008, rel=min(0.09, dur * 0.45), hold=0.55)
    # tonguing click
    t = np.arange(n) / SR
    click = np.exp(-t * 80) * 0.15
    return (sig * 0.22 * e + click * np.sign(sig + 1e-6)) * bite


def sax_note(midi: float, dur: float) -> np.ndarray:
    n = int(max(dur, 0.04) * SR)
    sig = add_partials(midi_hz(midi), n, [1.0, 0.4, 0.18, 0.08, 0.04], detune=0.001)
    e = env(n, atk=0.012, rel=min(0.1, dur * 0.5), hold=0.6)
    return sig * 0.16 * e


def bass_note(midi: float, dur: float) -> np.ndarray:
    n = int(max(dur, 0.05) * SR)
    sig = add_partials(midi_hz(midi), n, [1.0, 0.45, 0.18, 0.06], detune=0)
    e = env(n, atk=0.006, rel=0.08, hold=0.4)
    t = np.arange(n) / SR
    e = e * np.exp(-t * 2.8)
    return sig * 0.55 * e


def piano_stab(midis: tuple[int, ...], dur: float) -> np.ndarray:
    n = int(max(dur, 0.04) * SR)
    sig = np.zeros(n)
    for m in midis:
        sig += add_partials(midi_hz(m), n, [1.0, 0.35, 0.18, 0.07], detune=0) / len(midis)
    e = env(n, atk=0.003, rel=0.07, hold=0.25)
    t = np.arange(n) / SR
    return sig * 0.22 * e * np.exp(-t * 10)


def lead_note(midi: float, dur: float) -> np.ndarray:
    n = int(max(dur, 0.05) * SR)
    sig = add_partials(midi_hz(midi), n, [1.0, 0.5, 0.32, 0.18, 0.1], detune=0.0025)
    e = env(n, atk=0.01, rel=min(0.12, dur * 0.4), hold=0.7)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t)
    sig = add_partials(midi_hz(midi), n, [1.0, 0.5, 0.32, 0.18, 0.1], detune=0.0025)
    # cheap vibrato by mixing a delayed copy
    d = int(0.012 * SR * np.mean(vib))
    delayed = np.zeros_like(sig)
    delayed[d:] = sig[:-d] * 0.2
    return (sig + delayed) * 0.2 * e


def render() -> np.ndarray:
    mix = np.zeros((2, N + SR), dtype=np.float64)
    drums = np.zeros((2, mix.shape[1]), dtype=np.float64)
    brass = np.zeros((2, mix.shape[1]), dtype=np.float64)

    for bar in range(BARS):
        form = bar % 12
        chord = CHORDS[form]
        voices = VOICES[chord]

        # drums
        for b in range(4):
            t = eighth_time(bar, b * 2)
            # ride every 8th
            place(drums, t, RIDE, pan=0.25, gain=0.28 if b in (1, 3) else 0.2)
            place(drums, eighth_time(bar, b * 2 + 1), RIDE, pan=0.28, gain=0.12)
            if b in (1, 3):
                place(drums, t, SNARE, pan=-0.05, gain=0.38)
                place(drums, t, HAT, pan=0.15, gain=0.22)
            if b == 0 or (b == 2 and form in (0, 4, 8, 10)):
                place(drums, t, KICK, pan=0.0, gain=0.55 if b == 0 else 0.32)

        # walking bass — four quarters
        for b, m in enumerate(BASS[form]):
            t = eighth_time(bar, b * 2)
            d = BEAT * 0.92
            place(mix, t, bass_note(m, d), pan=0.0, gain=1.0)

        # Freddie-Green-ish chops on 2 and 4
        for b in (1, 3):
            t = eighth_time(bar, b * 2)
            place(mix, t, piano_stab(voices, 0.11), pan=-0.35, gain=0.7 if b == 3 else 0.55)

        # brass / sax stabs
        for eighth, dur_e in STABS[form]:
            t = eighth_time(bar, eighth)
            d = eighth_dur(bar, eighth, dur_e) * 0.92
            bite = 1.05 if eighth == 0 else 0.85
            # trumpets
            for i, m in enumerate(voices[1:]):
                pan = -0.15 + i * 0.18
                place(brass, t, brass_note(m, d, bite), pan=pan, gain=0.9)
            # saxes an octave down on the long notes
            if dur_e >= 2:
                place(brass, t, sax_note(voices[0] - 12, d), pan=-0.4, gain=0.85)
                place(brass, t, sax_note(voices[1] - 12, d), pan=-0.25, gain=0.7)

    for bar, eighth, dur_e, midi in LEAD:
        t = eighth_time(bar, eighth)
        d = eighth_dur(bar, eighth, dur_e) * 0.95
        place(brass, t, lead_note(midi, d), pan=0.18, gain=1.15)

    # short slapback on the brass section — ballroom, not a copy of any mix
    dly = int(0.108 * SR)
    echo = np.zeros_like(brass)
    echo[:, dly:] = brass[:, :-dly] * 0.22
    brass = brass + echo

    mix += drums + brass

    # 12ms loop crossfade
    x = int(0.012 * SR)
    head = mix[:, :x].copy()
    mix = mix[:, :N]
    fade = np.linspace(1, 0, x)
    mix[:, -x:] = mix[:, -x:] * fade + head * (1 - fade)

    # fade in the very first 30ms so the first click isn't a pop
    fin = int(0.03 * SR)
    mix[:, :fin] *= np.linspace(0, 1, fin)

    peak = np.max(np.abs(mix))
    mix = np.tanh(mix / (peak * 0.92) * 0.9) * 0.92
    return mix


def write_wav(path: Path, mix: np.ndarray) -> None:
    pcm = np.clip(mix * 32767.0, -32767, 32767).astype(np.int16)
    interleaved = np.empty(pcm.shape[1] * 2, dtype=np.int16)
    interleaved[0::2] = pcm[0]
    interleaved[1::2] = pcm[1]
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(interleaved.tobytes())


def main() -> None:
    out_dir = Path("/workspace/public/audio")
    out_dir.mkdir(parents=True, exist_ok=True)
    wav = Path("/tmp/title-theme.wav")
    mix = render()
    write_wav(wav, mix)
    rms = float(np.sqrt(np.mean(mix**2)))
    peak = float(np.max(np.abs(mix)))
    print(f"wrote {wav}  peak={peak:.3f} rms={rms:.3f} dur={mix.shape[1]/SR:.2f}s")


if __name__ == "__main__":
    main()
