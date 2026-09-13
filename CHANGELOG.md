# Changelog

All notable changes to the custom **Numark MixTrack Go -> PCDJ DEX 4** mapping are documented here.

The project was developed rapidly around real-world live testing. Some versions were experimental and intentionally superseded by later stable rollbacks.

## [0.17] - 2026-09-13 - Stable rollback

Current recommended stable build.

- Rolled jog handling back to the last reliable fast-search implementation.
- Normal jog `CC 0x06` keeps normal jog/scratch behavior.
- SHIFT fast search is handled only by the dedicated shifted-jog `CC 0x2B`.
- Preserved the rule that fast search is always allowed when stopped/paused, and while playing only when Vinyl mode is ON.
- Left the capacitive-top/Vinyl platter-hold behavior untouched rather than introducing further regressions.
- Kept sampler split: left pads = slots 1-4, right pads = slots 5-8.
- Kept AIUnmixEQ/stem controls, LOAD LED states, fast browser, 14-bit pitch, reverse, key lock, and the other stable mappings.
- `SHIFT + FADE FX` is a safe no-op.

## [0.16] - 2026-09-13 - Experimental jog routing

Not recommended; superseded by `0.17`.

- Tried hybrid SHIFT+Jog routing for the capacitive top surface.
- When the top was touched, normal jog `CC 0x06` was used as the search stream.
- When using the rim only, shifted jog `CC 0x2B` was used as the search stream.
- Explicitly released Vinyl platter hold before top-surface fast search.
- Did not solve the DEX capacitive-touch limitation reliably and introduced unwanted behavior, so it was rolled back.

## [0.15] - 2026-09-13 - Experimental capacitive-touch suppression

Not recommended; superseded by `0.17`.

- Attempted to make SHIFT+Jog fast search work from both the rim and capacitive top.
- Suppressed normal jog input while SHIFT was held and relied on shifted jog `CC 0x2B`.
- Added explicit release/restore handling for jog platter hold while entering/leaving SHIFT.
- Did not reliably override DEX's Vinyl/capacitive-touch behavior.

## 0.13-0.14

No repository release packages were produced for these version numbers during the development thread.

## [0.12] - 2026-09-13 - Fast-search stabilization

Two test packages existed for this version.

### 0.12 Stable

- Restored the original fast-search architecture.
- Normal jog `CC 0x06` is never converted into search just because MODE/SHIFT is held.
- Dedicated shifted-jog `CC 0x2B` alone handles fast search.
- Fixed the rapid `+/- ~1 second` oscillation caused by normal and shifted jog streams fighting each other.
- Retained play-state/Vinyl gating for fast search.
- Preserved sampler, stems, LOAD LED, and fast-browser mappings.

### 0.12 Overlay Test

Experimental; not recommended.

- Tested the PCDJ controller action `videoOverlays` as a button pulse for `SHIFT + FADE FX`.
- The tested DEX 4 build still crashed when the action was invoked from the controller JavaScript.
- Overlay control from JavaScript was abandoned for the stable build.

## [0.11] - 2026-09-13

- Corrected SHIFT+Jog permission logic:
  - stopped/paused: fast search works regardless of Vinyl mode;
  - playing: fast search works only with Vinyl mode ON.
- Added deck play-state tracking from DEX notifications.
- Continued experiments to let a generic MIDI Learn binding for `SHIFT + FADE FX` coexist with the custom script.
- Confirmed that the generic Learn path does not remain usable once the custom mapping owns the MIDI device.

## [0.10] - 2026-09-13

- Kept `SHIFT + FADE FX` unconsumed in an attempt to allow DEX's generic MIDI Learn layer to execute `enable_video_overlays`.
- Added local LED state mirroring for shifted FADE FX.
- The LED state could not be synchronized from DEX because no usable overlay-state notification was available.
- Native Learn still did not coexist successfully with the loaded custom controller script.

## [0.9] - 2026-09-13

- Added normal LOAD 1/2 LED states:
  - dim = empty deck;
  - bright = track/video loaded.
- Kept shifted LOAD indicators for Filter/Low-EQ and Vinyl mode state.
- Temporarily disabled SHIFT+Jog fast search whenever Vinyl mode was OFF.
- Left `SHIFT + FADE FX` unconsumed so native MIDI Learn could be tested for Video Overlays.

## [0.8] - 2026-09-13

Experimental overlay-control attempt.

- Captured the exact keyboard/skin Learn action `enable_video_overlays` from DEX's `shortcuts_kb.xml`.
- Tried calling `enable_video_overlays` directly from the controller script for `SHIFT + FADE FX`.
- The action did not toggle the overlays when invoked this way.
- Preserved fast track search, fast browser, sampler split, pitch, jog, stems, and crossfader mappings.

## [0.7] - 2026-09-13

- Added `MODE/SHIFT + Jog` fast track search/scrub.
- Initially supported both ordinary jog messages and the dedicated shifted-jog message as possible fast-search inputs.
- Suppressed jog scratch-hold while SHIFT was held.
- This dual-stream approach was later found to cause forward/backward oscillation on some jog interactions and was revised in `0.12`.
- `SHIFT + FADE FX` remained unassigned while the exact DEX overlay action was investigated.

## [0.6] - 2026-09-13

Stability fix.

- Removed `SHIFT + FADE FX -> videoOverlays` because the legacy controller action crashed the tested DEX 4 build.
- `SHIFT + FADE FX` became a safe no-op.
- Preserved sampler split, fast browser, pitch, jog, stems, crossfader, transport, and browser mappings.

## [0.5] - 2026-09-13

- Corrected sampler layout:
  - left deck pads -> Samplers 1-4;
  - right deck pads -> Samplers 5-8.
- Reworked MODE so it can also behave as a proper SHIFT modifier.
- A plain MODE tap changes pad mode; using a shifted function while MODE is held prevents a mode change on release.
- Added `SHIFT + Browse` fast browser scrolling.
- Added the first `SHIFT + FADE FX -> videoOverlays` experiment. This was later removed because it crashed DEX 4.
- Preserved existing pitch, jog, crossfader, stems, cues, loops, reverse, and key-lock behavior.

## [0.4] - 2026-09-12

Major pad-handling cleanup.

- Reworked pad input to more closely follow PCDJ's stock Numark mapping semantics.
- Hot Cue and Loop pads pass the controller's raw MIDI values to DEX.
- Sampler pads use DEX's `samplerPlay(slot)` calls.
- Replaced the earlier native `deckStem1..4` experiment with AIUnmixEQ / EQ-kill behavior:
  - Pad 1 = Drums / Low;
  - Pad 2 = Instruments / Mid;
  - Pad 3 = Vocals / High;
  - Pad 4 = restore all.
- Removed the experimental direct call to the skin-only `dropdown_video_transition` action.
- Left FADE FX available for a MIDI Learn experiment.

## [0.3] - 2026-09-12

- Changed the MODE cycle to match the four labels printed on the controller:
  `HOT CUE -> LOOPS -> SAMPLER -> STEMS`.
- Sampler pads initially triggered slots 1-4 from either side.
- STEMS initially used DEX native `deckStem1..4` actions.
- Experimentally attempted to make FADE FX advance the skin action `dropdown_video_transition`.
- The transition dropdown proved to be a skin-only action, not a usable controller action.

## [0.2] - 2026-09-12

- Added working MODE cycling.
- Added four initial pad layers: Hot Cue / Loop / FX / Sampler.
- Added mode LED feedback.
- Captured the FADE FX MIDI input for future use.
- Video-transition cycling remained unresolved because DEX did not expose a controller action for the transition selector.

## [0.1] - 2026-09-12 - Initial public test build

First working custom mapping.

- Added MixTrack Go MIDI device-name detection in DEX.
- Added controller LED initialization/feedback.
- Implemented correct **14-bit pitch fader** handling from MSB/LSB MIDI data.
- Mapped core transport controls: Play/Pause, Cue, Sync, headphone CUE/PFL.
- Mapped browser encoder, browser press, LOAD 1/2, crossfader, master gain, monitor gain, and channel faders.
- Mapped Filter knobs, with `SHIFT + LOAD 1` toggling Filter vs Low-EQ behavior.
- Added `SHIFT + LOAD 2` Vinyl/Scratch mode toggle.
- Added jog-wheel movement, capacitive touch, scratch/hold behavior, and initial shifted fast-search support.
- Repurposed ACAPELLA as **Reverse** and INSTRUMENTAL as **Key Lock** for the live-video workflow.
- Added Hot Cue 1-4 pads and shifted Hot Cue clear actions.

