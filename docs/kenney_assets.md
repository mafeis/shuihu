# Kenney Open-Source Battle Assets

The battle presentation uses CC0 assets from Kenney instead of the previous
procedural combat effects and synthesized combat sounds.

## Sources

- Particle Pack: https://kenney.nl/assets/particle-pack
- Impact Sounds: https://kenney.nl/assets/impact-sounds
- RPG Audio: https://kenney.nl/assets/rpg-audio
- UI Audio: https://kenney.nl/assets/ui-audio

Author: Kenney (https://www.kenney.nl)

License: Creative Commons Zero 1.0 Universal (CC0-1.0)

https://creativecommons.org/publicdomain/zero/1.0/

Attribution is not required. Kenney does not endorse this game.

## Phaser VFX Derivatives

The source PNG particles were cropped to 320x320 WebP masks and are tinted at
runtime by the active path color.

| Runtime asset | Kenney source | Battle use |
| --- | --- | --- |
| `blade_arc.webp` | `slash_01.png` | Blade arc |
| `blade_cut.webp` | `slash_02.png` | Ultimate and restorative sweep |
| `impact_spark.webp` | `spark_03.png` | Heavy impact burst |
| `hit_spark.webp` | `spark_05.png` | Direct-hit flash |
| `heavy_dust.webp` | `smoke_03.png` | Heavy-weapon ground dust |
| `volley_trace.webp` | `trace_03.png` | Projectile travel streak |
| `ultimate_star.webp` | `star_05.png` | Chain and ultimate focal burst |
| `restore_glow.webp` | `light_02.png` | Guard and healing aura |

Runtime files are stored in `assets/vfx/kenney/`. The original license files
and expanded attribution are stored alongside them.

The previous path-specific generated VFX clips remain production reference
files only; they are excluded from the runtime manifest and production build.

## Combat Audio Derivatives

The ten runtime combat cues are mastered MP3 derivatives of Kenney source
clips. Reproducible WAV sources are kept in `assets/audio/sfx/source/`, with
short action variants in `assets/audio/sfx/actions/`.

| Runtime cue | Source cue | Battle use |
| --- | --- | --- |
| `battle-start.mp3` | `battle-start.wav` | Battle opening |
| `blade.mp3` | `blade.wav` | Single-target slash and stab |
| `impact.mp3` | `impact.wav` | Heavy weapon and area impact |
| `volley.mp3` | `volley.wav` | Arrows, darts, and thrown weapons |
| `guard.mp3` | `guard.wav` | Block, counter, and defensive support |
| `evade.mp3` | `evade.wav` | Miss and evasion |
| `restore.mp3` | `restore.wav` | Healing and restorative support |
| `ultimate.mp3` | `ultimate.wav` | Ultimate and chain attack |
| `victory.mp3` | `victory.wav` | Victory result |
| `defeat.mp3` | `defeat.wav` | Defeat result |

Menu feedback uses `assets/audio/ui/click.mp3` and
`assets/audio/sfx/actions/battle-open-01.mp3`.

## Runtime Integration

- Phaser 3 loads the eight VFX masks in `src/battle-stage.js`, applies additive
  blending, path-color tinting, scale, rotation, delay, and easing.
- `src/audio.js` decodes all combat cues through Web Audio and no longer falls
  back to synthesized noise or oscillator combat sounds.
- `assets/manifest.json` records hashes, dimensions, licensing, source URLs,
  and metadata for every runtime derivative.
