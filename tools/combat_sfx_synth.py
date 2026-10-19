#!/usr/bin/env python3
"""Build deterministic transient layers for the ComfyUI combat sound palette."""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path


SAMPLE_RATE = 44100
TAU = math.pi * 2


def equal_power_pan(pan: float) -> tuple[float, float]:
    angle = (max(-1.0, min(1.0, pan)) + 1.0) * math.pi * 0.25
    return math.cos(angle), math.sin(angle)


def envelope(position: float, attack: float, decay: float) -> float:
    if position < 0 or position > attack + decay:
        return 0.0
    rise = min(1.0, position / max(0.001, attack))
    fall = math.exp(-max(0.0, position - attack) / max(0.01, decay))
    return rise * fall


def add_tone(
    channels: list[list[float]],
    *,
    start: float,
    duration: float,
    amplitude: float,
    frequency: float,
    end_frequency: float | None = None,
    attack: float = 0.004,
    decay: float = 0.12,
    pan: float = 0.0,
    partials: tuple[float, ...] = (1.0,),
) -> None:
    left_gain, right_gain = equal_power_pan(pan)
    total = len(channels[0])
    start_index = max(0, int(start * SAMPLE_RATE))
    sample_count = min(
        int((attack + decay + 0.04) * SAMPLE_RATE),
        total - start_index,
    )
    phase = 0.0
    target = frequency if end_frequency is None else end_frequency
    for offset in range(sample_count):
        position = offset / SAMPLE_RATE
        current_frequency = frequency + (target - frequency) * min(
            1.0,
            position / max(duration, 0.001),
        )
        phase += TAU * current_frequency / SAMPLE_RATE
        value = 0.0
        for harmonic, weight in enumerate(partials, start=1):
            value += math.sin(phase * harmonic) * weight
        value *= amplitude * envelope(position, attack, decay)
        index = start_index + offset
        channels[0][index] += value * left_gain
        channels[1][index] += value * right_gain


def add_noise_burst(
    channels: list[list[float]],
    *,
    start: float,
    duration: float,
    amplitude: float,
    frequency: float,
    end_frequency: float | None = None,
    resonance: float = 0.72,
    attack: float = 0.003,
    decay: float = 0.12,
    pan: float = 0.0,
    seed: int = 1,
) -> None:
    left_gain, right_gain = equal_power_pan(pan)
    rng = random.Random(seed)
    total = len(channels[0])
    start_index = max(0, int(start * SAMPLE_RATE))
    sample_count = min(
        int((attack + decay + 0.04) * SAMPLE_RATE),
        total - start_index,
    )
    target = frequency if end_frequency is None else end_frequency
    last_cutoff = -1.0
    b0 = b1 = b2 = a1 = a2 = 0.0
    z1 = z2 = 0.0
    for offset in range(sample_count):
        position = offset / SAMPLE_RATE
        ratio = min(1.0, position / max(duration, 0.001))
        cutoff = frequency + (target - frequency) * ratio
        if abs(cutoff - last_cutoff) > 4:
            omega = TAU * min(SAMPLE_RATE * 0.45, max(30.0, cutoff)) / SAMPLE_RATE
            alpha = math.sin(omega) / (2 * max(0.18, resonance))
            a0 = 1.0 + alpha
            b0 = alpha / a0
            b1 = 0.0
            b2 = -alpha / a0
            a1 = (-2.0 * math.cos(omega)) / a0
            a2 = (1.0 - alpha) / a0
            last_cutoff = cutoff
        white = rng.uniform(-1.0, 1.0)
        filtered = b0 * white + z1
        z1 = b1 * white - a1 * filtered + z2
        z2 = b2 * white - a2 * filtered
        value = filtered * amplitude * envelope(position, attack, decay)
        index = start_index + offset
        channels[0][index] += value * left_gain
        channels[1][index] += value * right_gain


def add_impact(
    channels: list[list[float]],
    start: float,
    *,
    amplitude: float = 1.0,
    pan: float = 0.0,
    seed: int,
) -> None:
    add_tone(
        channels,
        start=start,
        duration=0.34,
        amplitude=0.68 * amplitude,
        frequency=112,
        end_frequency=42,
        attack=0.002,
        decay=0.3,
        pan=pan,
        partials=(1.0, 0.34, 0.17),
    )
    add_noise_burst(
        channels,
        start=start,
        duration=0.18,
        amplitude=0.72 * amplitude,
        frequency=1450,
        end_frequency=170,
        resonance=0.55,
        attack=0.001,
        decay=0.16,
        pan=pan,
        seed=seed,
    )
    add_tone(
        channels,
        start=start,
        duration=0.16,
        amplitude=0.18 * amplitude,
        frequency=620,
        end_frequency=510,
        attack=0.001,
        decay=0.13,
        pan=pan * -0.35,
        partials=(1.0, 0.55, 0.24),
    )
    add_noise_burst(
        channels,
        start=start + 0.04,
        duration=0.38,
        amplitude=0.12 * amplitude,
        frequency=2400,
        end_frequency=900,
        resonance=0.95,
        attack=0.004,
        decay=0.33,
        pan=pan,
        seed=seed + 7,
    )


def apply_short_space(channels: list[list[float]], amount: float = 0.16) -> None:
    total = len(channels[0])
    taps = ((0.041, 0.11), (0.083, 0.075), (0.137, 0.05))
    dry_left = list(channels[0])
    dry_right = list(channels[1])
    for delay, gain in taps:
        offset = int(delay * SAMPLE_RATE)
        for index in range(offset, total):
            channels[0][index] += dry_right[index - offset] * gain * amount
            channels[1][index] += dry_left[index - offset] * gain * amount


def write_wav(path: Path, channels: list[list[float]], peak: float = 0.92) -> None:
    measured = max(
        0.0001,
        max(abs(sample) for channel in channels for sample in channel),
    )
    scale = peak / measured
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for left, right in zip(channels[0], channels[1]):
            for sample in (left, right):
                frames.extend(
                    struct.pack(
                        "<h",
                        int(max(-1.0, min(1.0, sample * scale)) * 32767),
                    )
                )
        output.writeframes(frames)


def render_combat_sfx(cue: str, destination: Path, duration: float) -> None:
    frame_count = int(duration * SAMPLE_RATE)
    channels = [[0.0] * frame_count, [0.0] * frame_count]

    if cue == "battle-start":
        add_impact(channels, 0.02, amplitude=0.92, seed=101)
        add_tone(
            channels,
            start=0.08,
            duration=1.15,
            amplitude=0.23,
            frequency=96,
            end_frequency=62,
            attack=0.08,
            decay=1.0,
            partials=(1.0, 0.42, 0.23, 0.11),
        )
        add_tone(
            channels,
            start=0.18,
            duration=0.72,
            amplitude=0.1,
            frequency=146,
            end_frequency=98,
            attack=0.08,
            decay=0.68,
            partials=(1.0, 0.38, 0.17),
        )
    elif cue == "blade":
        add_noise_burst(
            channels,
            start=0.015,
            duration=0.2,
            amplitude=0.52,
            frequency=3900,
            end_frequency=900,
            resonance=0.82,
            attack=0.006,
            decay=0.19,
            pan=-0.34,
            seed=211,
        )
        add_tone(
            channels,
            start=0.065,
            duration=0.11,
            amplitude=0.26,
            frequency=2680,
            end_frequency=2200,
            attack=0.001,
            decay=0.09,
            pan=0.34,
            partials=(1.0, 0.44, 0.18),
        )
        add_noise_burst(
            channels,
            start=0.07,
            duration=0.1,
            amplitude=0.24,
            frequency=6100,
            end_frequency=3200,
            resonance=1.2,
            attack=0.001,
            decay=0.09,
            pan=0.42,
            seed=219,
        )
    elif cue == "impact":
        add_impact(channels, 0.005, amplitude=1.18, seed=307)
        add_noise_burst(
            channels,
            start=0.08,
            duration=0.5,
            amplitude=0.18,
            frequency=1100,
            end_frequency=180,
            resonance=0.68,
            attack=0.005,
            decay=0.45,
            pan=-0.18,
            seed=313,
        )
    elif cue == "volley":
        for index in range(3):
            add_noise_burst(
                channels,
                start=0.01 + index * 0.085,
                duration=0.34,
                amplitude=0.27,
                frequency=4900 - index * 280,
                end_frequency=1200,
                resonance=0.9,
                attack=0.005,
                decay=0.25,
                pan=-0.55 + index * 0.18,
                seed=401 + index,
            )
        add_impact(channels, 0.34, amplitude=0.58, pan=-0.05, seed=409)
        add_noise_burst(
            channels,
            start=0.34,
            duration=0.22,
            amplitude=0.28,
            frequency=1850,
            end_frequency=620,
            resonance=1.1,
            attack=0.001,
            decay=0.19,
            seed=419,
        )
    elif cue == "guard":
        add_noise_burst(
            channels,
            start=0.005,
            duration=0.08,
            amplitude=0.6,
            frequency=3100,
            end_frequency=1400,
            resonance=0.75,
            attack=0.001,
            decay=0.07,
            seed=503,
        )
        for index, (frequency, amplitude) in enumerate(
            ((790, 0.3), (1180, 0.2), (1760, 0.13), (2490, 0.08))
        ):
            add_tone(
                channels,
                start=0.01 + index * 0.004,
                duration=0.5,
                amplitude=amplitude,
                frequency=frequency,
                end_frequency=frequency * 0.97,
                attack=0.001,
                decay=0.46 - index * 0.05,
                pan=(index - 1.5) * 0.12,
                partials=(1.0, 0.22),
            )
    elif cue == "evade":
        add_noise_burst(
            channels,
            start=0.01,
            duration=0.34,
            amplitude=0.42,
            frequency=2300,
            end_frequency=3400,
            resonance=1.25,
            attack=0.02,
            decay=0.28,
            pan=-0.4,
            seed=601,
        )
        add_noise_burst(
            channels,
            start=0.1,
            duration=0.25,
            amplitude=0.18,
            frequency=850,
            end_frequency=1600,
            resonance=0.72,
            attack=0.01,
            decay=0.2,
            pan=0.45,
            seed=607,
        )
    elif cue == "restore":
        notes = ((523.25, 0.0), (659.25, 0.09), (783.99, 0.18), (1046.5, 0.3))
        for index, (frequency, start) in enumerate(notes):
            add_tone(
                channels,
                start=start,
                duration=0.95 - index * 0.08,
                amplitude=0.18 - index * 0.018,
                frequency=frequency,
                attack=0.018,
                decay=0.82 - index * 0.07,
                pan=-0.28 + index * 0.18,
                partials=(1.0, 0.28, 0.1),
            )
        add_noise_burst(
            channels,
            start=0.12,
            duration=0.95,
            amplitude=0.055,
            frequency=4800,
            end_frequency=7600,
            resonance=1.6,
            attack=0.16,
            decay=0.75,
            seed=701,
        )
    elif cue == "ultimate":
        for index in range(3):
            add_noise_burst(
                channels,
                start=0.01 + index * 0.12,
                duration=0.3,
                amplitude=0.32,
                frequency=4600 - index * 500,
                end_frequency=900,
                resonance=0.82,
                attack=0.004,
                decay=0.25,
                pan=-0.45 + index * 0.35,
                seed=801 + index,
            )
            add_tone(
                channels,
                start=0.02 + index * 0.12,
                duration=0.16,
                amplitude=0.16,
                frequency=2400 - index * 180,
                end_frequency=1500,
                attack=0.001,
                decay=0.14,
                pan=-0.4 + index * 0.3,
                partials=(1.0, 0.42),
            )
        add_impact(channels, 0.43, amplitude=1.25, seed=811)
        add_tone(
            channels,
            start=0.4,
            duration=0.75,
            amplitude=0.16,
            frequency=156,
            end_frequency=78,
            attack=0.01,
            decay=0.68,
            partials=(1.0, 0.38, 0.16),
        )
    elif cue == "victory":
        add_noise_burst(
            channels,
            start=0.01,
            duration=0.2,
            amplitude=0.24,
            frequency=900,
            end_frequency=240,
            resonance=0.6,
            attack=0.002,
            decay=0.17,
            seed=901,
        )
        notes = ((261.63, 0.04), (329.63, 0.17), (392.0, 0.3), (523.25, 0.45))
        for index, (frequency, start) in enumerate(notes):
            add_tone(
                channels,
                start=start,
                duration=1.05,
                amplitude=0.2 + index * 0.025,
                frequency=frequency,
                attack=0.008,
                decay=0.92,
                pan=-0.35 + index * 0.23,
                partials=(1.0, 0.36, 0.18, 0.07),
            )
        add_tone(
            channels,
            start=0.45,
            duration=1.15,
            amplitude=0.11,
            frequency=261.63,
            attack=0.02,
            decay=1.05,
            pan=0.0,
            partials=(1.0, 0.25),
        )
    elif cue == "defeat":
        add_impact(channels, 0.01, amplitude=0.52, seed=1001)
        notes = ((220.0, 0.08), (174.61, 0.34), (130.81, 0.64))
        for index, (frequency, start) in enumerate(notes):
            add_tone(
                channels,
                start=start,
                duration=1.1,
                amplitude=0.2 - index * 0.025,
                frequency=frequency,
                end_frequency=frequency * 0.87,
                attack=0.03,
                decay=0.95,
                pan=0.24 - index * 0.22,
                partials=(1.0, 0.31, 0.12),
            )
        add_tone(
            channels,
            start=1.05,
            duration=0.9,
            amplitude=0.08,
            frequency=196,
            end_frequency=98,
            attack=0.03,
            decay=0.78,
            partials=(1.0, 0.2),
        )
    else:
        raise ValueError(f"Unknown combat SFX cue: {cue}")

    apply_short_space(channels)
    write_wav(destination, channels)
