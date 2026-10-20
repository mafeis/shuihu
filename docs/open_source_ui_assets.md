# Open-source UI and sound assets

Version 1.0.4 adds interface sound effects and lightweight UI particles from
Kenney. All files are released under CC0 1.0 Universal and may be used in
commercial projects.

| Source | Files used | License |
| --- | --- | --- |
| [Kenney Interface Sounds](https://github.com/Calinou/kenney-interface-sounds) | `click`, `confirm`, `open`, `back`, `error`, `select` WAV files | CC0 1.0 |
| [Kenney asset mirror](https://github.com/shorepine/kenney) | `window-frame.png`, `spark-gold.png`, `spark-white.png` | CC0 1.0 |

The sound files remain uncompressed 44.1 kHz PCM. They were trimmed of silent
edges, converted to mono, and normalized to a quieter interface level with
FFmpeg. UI images are loaded through Vite and scaled in CSS, so no generated
asset pipeline dependency is introduced.

Runtime locations:

```text
assets/audio/ui/kenney/
assets/ui/open-source/kenney/
```

Attribution is optional under CC0, but the source and license are retained
alongside the files and in `public/THIRD_PARTY_NOTICES.txt`.
