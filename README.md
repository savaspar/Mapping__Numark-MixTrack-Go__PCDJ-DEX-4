# Numark MixTrack Go mapping for PCDJ DEX 4

Unofficial custom MIDI controller mapping for the **Numark MixTrack Go** in **PCDJ DEX 4**.

This mapping was built and tested primarily for live video-performance use: two-deck video playback, precise transport control, tempo changes, reverse playback, fast browsing/searching, crossfading, sampler triggering, and AIUnmixEQ/stem-style controls.

**Current stable version:** `v0.17`  
**Last updated:** 2026-09-13  
**Tested on:** DEX 4 on macOS + Numark MixTrack Go  
**Status:** Stable for the core mappings listed below; see [Known limitations](#known-limitations).

> This is an unofficial community mapping. It is not affiliated with or endorsed by PCDJ or Numark.

## Installation

1. Quit DEX 4 completely.
2. In DEX, locate the **Data Folder** from the application settings, then open its `Controllers` folder.
3. Back up any older `Numark__MixTrack_Go.js` file.
4. Copy `Numark__MixTrack_Go.js` from this repository into the `Controllers` folder.
5. Connect the MixTrack Go before launching DEX 4.
6. Start DEX 4. The controller should initialize, the LEDs should light, and the mapping should load automatically by MIDI device name.

If you previously created generic MIDI Learn mappings for the MixTrack Go, they may conflict with this script. Back up `settings/shortcuts_midi.xml` before removing or resetting those Learn bindings.

## Control map

### Mixer and browser

| MixTrack Go control | DEX 4 action |
|---|---|
| Browse encoder | Move browser cursor one item at a time |
| **MODE/SHIFT + Browse** | Fast browser scroll, approximately 10 cursor steps per encoder tick |
| Browse encoder press | Browser select/toggle |
| LOAD 1 | Load selected item into Deck 1 |
| LOAD 2 | Load selected item into Deck 2 |
| Crossfader | DEX crossfader |
| Main Level | Master gain |
| Cue Level | Monitor/headphone gain |
| Channel fader 1/2 | Deck volume |
| Filter knob 1/2 | Deck filter cutoff by default |
| **MODE/SHIFT + LOAD 1** | Toggle both Filter knobs between **Filter** and **Low EQ** mode |
| **MODE/SHIFT + LOAD 2** | Toggle **Vinyl/Scratch mode** |

If DEX's audio/video crossfader lock is enabled, the physical crossfader controls the linked video crossfade as well.

### Deck controls

| MixTrack Go control | DEX 4 action |
|---|---|
| PLAY | Play/Pause |
| CUE | Cue |
| SYNC | Sync |
| Channel CUE/PFL | Monitor that deck in headphones |
| Pitch fader | High-resolution **14-bit pitch/tempo** control |
| Jog wheel | Jog / pitch-bend |
| Capacitive jog top + Vinyl ON | Scratch / platter hold behavior |
| **MODE/SHIFT + Jog** | Fast track search using the controller's dedicated shifted-jog message |
| ACAPELLA | **Reverse playback** |
| INSTRUMENTAL | **Key Lock** |

### MODE / SHIFT behavior

The physical **MODE** button serves two purposes:

- **Tap MODE:** cycles the performance-pad layer:
  `HOT CUE -> LOOPS -> SAMPLER -> STEMS -> HOT CUE`
- **Hold MODE:** acts as **SHIFT**.

If a shifted control is used while MODE is held, releasing MODE does **not** advance the pad mode.

### Performance pads

#### HOT CUE

| Pad | Action |
|---|---|
| 1-4 | Hot Cue 1-4 |
| SHIFT + Pad 1-4 | Clear Hot Cue 1-4 |

The pad LEDs reflect stored cue points.

#### LOOPS

| Pad | Action |
|---|---|
| 1 | 1-beat auto loop |
| 2 | 2-beat auto loop |
| 3 | 4-beat auto loop |
| 4 | 8-beat auto loop |

#### SAMPLER

| Side | Pads |
|---|---|
| Left deck | Sampler slots 1-4 |
| Right deck | Sampler slots 5-8 |

**Important:** load a file into a sampler slot before triggering it from the controller. On the tested DEX 4 build, calling `samplerPlay` on an empty slot may move that sampler's filter to maximum instead of opening the file picker.

#### STEMS / AIUnmixEQ

This mode is adapted to DEX's AIUnmixEQ / EQ-kill controls for ordinary audio/video files:

| Pad | Action |
|---|---|
| 1 | Drums / Low stem toggle |
| 2 | Instruments / Mid stem toggle |
| 3 | Vocals / High stem toggle |
| 4 | Restore all three |

With AIUnmixEQ enabled, these correspond to separated musical parts. Without AIUnmixEQ, they behave as the corresponding Low/Mid/High kill controls.

## LED behavior

The script provides bidirectional LED feedback where DEX exposes usable state information.

- PLAY and CUE LEDs follow deck state.
- Hot Cue LEDs reflect stored cue points.
- Pad-mode LEDs show the active mode.
- STEMS-mode pad LEDs reflect the current Low/Mid/High kill state.
- Normal LOAD 1/2 LEDs are **dim when the deck is empty** and **bright when a track/video is loaded**.
- Shifted LOAD function LEDs indicate the Filter/Low-EQ mode and Vinyl mode state.
- Reverse and Key Lock buttons use dim/bright state feedback.

## Fast search behavior

The stable mapping deliberately keeps normal jog and fast-search messages separate:

- Normal jog uses the controller's normal jog message.
- SHIFT + Jog uses the dedicated shifted-jog message.
- If the deck is stopped/paused, fast search is allowed regardless of Vinyl mode.
- If the deck is playing, fast search is allowed only when Vinyl mode is ON.

This avoids the rapid forward/backward oscillation seen when normal and shifted jog streams are both treated as search input.

## Known limitations

### FADE FX / video transitions

`FADE FX` is intentionally left unassigned in the stable mapping.

DEX 4 exposes the video-transition selector as a skin dropdown, but the tested build does not expose a reliable controller-script action to cycle that dropdown, and the dropdown does not accept MIDI Learn. Video transitions therefore still need to be selected with the mouse.

### SHIFT + FADE FX / video overlays

This is intentionally a safe no-op in `v0.17`.

The DEX GUI action `enable_video_overlays` can be assigned through generic MIDI Learn when the custom JavaScript controller mapping is **not** loaded. The MixTrack Go shifted FADE FX message appears there as **K71 / MIDI note 71 (`0x47`)**.

However:

- when this custom controller script owns the MIDI device, the saved generic Learn binding is no longer reached; and
- calling the legacy controller-side `videoOverlays` action directly from JavaScript crashes the tested DEX 4 build.

For stability, video overlays should currently be toggled with the DEX GUI/mouse.

### Capacitive jog top during fast search

With Vinyl mode ON, touching the capacitive top of a jog wheel can make DEX engage its platter-hold/scratch path. Attempts to override this reliably during SHIFT + Jog introduced regressions, so `v0.17` intentionally rolls back to the stable jog implementation.

For reliable fast search, use the jog rim when the capacitive top / Vinyl behavior interferes.

### Generic MIDI Learn

DEX's generic MIDI Learn layer does not reliably coexist with this custom controller script for the same MixTrack Go MIDI device. Prefer adding mappings to this JavaScript file rather than adding parallel Learn bindings.

## Why the custom pitch implementation matters

The MixTrack Go pitch faders send **14-bit MIDI** using separate MSB and LSB messages. Generic DEX Learn interpreted the pitch incorrectly, causing small physical movements to jump to extreme positive/negative values.

This mapping combines both messages into a 14-bit value and converts it to DEX's pitch input, giving smooth, usable tempo adjustment.

## Project history

The mapping started as a live-use workaround because DEX 4 recognized the MixTrack Go MIDI device but had no native mapping for it. The first usable version was already used successfully during a live video-wall performance, and the mapping was subsequently expanded and refined.

See [`CHANGELOG.md`](CHANGELOG.md) for the full development history from `v0.1` onward.

## Development references and credits

The mapping was developed using:

- PCDJ's existing DEX JavaScript controller mappings and controller scripting API/documentation.
- Public MIDI information from the Numark MixTrack Go mapping work for Mixxx.
- The official Numark MixTrack Go documentation for the hardware layout and intended control modes.

Useful references:

- PCDJ controller scripting documentation: https://pcdj.com/creating-your-own-dex-3-dj-controller-scripts/
- PCDJ DEX 4 support / scripting updates: https://pcdj.com/support/dex-4-support/
- Numark MixTrack Go: https://www.numark.com/new/mixtrack-go/
- Mixxx MixTrack Go mapping work, PR #16813: https://github.com/mixxxdj/mixxx/pull/16813

