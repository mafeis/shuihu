# Xingming Shuihu Accessibility

Updated: 2026-10-20

## Controls

- Keyboard: `Space` / `Enter` advances dialogue, `Esc` opens the pause menu, `A` toggles auto-battle, `T` cycles auto-battle doctrines, `1` / `2` / `4` sets battle speed, and `C` triggers a Star Combo when ready.
- Gamepad: standard gamepad layout is supported. Use the D-pad or left stick to navigate and the confirm button to activate controls. In battle, `X` toggles auto-battle, `Y` cycles speed, and `LB / L1` cycles the auto-battle doctrine.
- Mouse and touch: all primary flows expose clickable or touchable controls.
- Auto-battle can be enabled by default or toggled during combat. Balanced, Breaker, Guardian, and Hunter doctrines can be cycled with the battle control or the `T` key.
- Battle speed supports `1x`, `2x`, and `4x` to reduce repeated input.
- Arena auto-advance follows the advisor after the battle report and starts the next wave, but pauses for inter-wave events and can be disabled at any time.
- The one-time first-battle guide is limited to path counters, choosing a skill and target, and the three-path chain.
- Five primary navigation actions remain visible: Campaign, Heroes, Quests, Camp, and More. Story, Arena, Codex, and Settings open from More.

## Visual and Motion

- Reduced Motion disables interface movement, flashes, and long-running animation.
- High Contrast strengthens text, borders, focus rings, and interactive states.
- Three UI text sizes (Normal, Large, and Largest) enlarge buttons, combat information, and supporting text without changing character art proportions.
- The game also respects the operating system `prefers-reduced-motion` preference.
- Important controls use both text and icons, with labels on unfamiliar icons.
- The More menu exposes its expanded state and current secondary page, dims the underlying screen, and closes with Back or the gamepad back button.
- The interface is responsive from 390px through 4K without requiring horizontal scrolling for the main flow.
- Character, enemy, scene, and UI assets preserve their source aspect ratio.

## Audio and Text

- Music and sound effects have independent volume controls and a global mute.
- Dialogue supports slow, normal, and fast text pacing.
- The current build has no voice-over, so story choices do not rely on audio.
- Combat results, rewards, and errors use text as well as color.
- Kenney CC0 interface sounds are used by default and remain controlled by the independent sound-effects volume and mute settings.

## Save Recovery

- Autosave keeps the previous valid local copy.
- Players can save immediately and import or export JSON save files.
- Legacy saves migrate automatically, and corrupt input does not replace a valid local backup.
- Save write failures produce a visible error.
- Desktop builds keep local diagnostic logs, which are never uploaded automatically.

## Lower text density

- Supporting copy on the title, quest, story, hero, camp, and arena screens is shortened. Longer biographies and quest premises open on demand.
- The first campaign battle shows three executable steps. The battle log starts collapsed and opens from Status.

## Known Limitations

- A complete screen-reader semantic tree and full spoken narrative are not yet implemented.
- Combat does not yet have a dedicated text-only log mode, although auto-battle reduces input load.
- A dedicated color-vision palette preset is not yet available.
- Native accessibility regression is still required on Windows, macOS, Steam Deck, and common controllers.
