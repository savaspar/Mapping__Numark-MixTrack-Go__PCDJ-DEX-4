//-----------------------------------------------------------------------------
// Custom DEX 4 controller mapping for Numark MixTrack Go
// v0.17: 2026-09-13
// Built for Savvas / live video-wall use
//
// MIDI information is based on the public Numark MixTrack Go mapping developed
// for Mixxx (2026) plus the structure/API used by PCDJ's existing Numark DEX
// controller scripts.
//
// v0.17 STABLE ROLLBACK:
// - Rolls jog handling back to the last reliable fast-search implementation.
// - Normal jog CC 0x06 keeps its original jog/scratch behavior.
// - SHIFT fast search is handled only by dedicated CC 0x2B.
// - When the capacitive top is touched with Vinyl ON, DEX may still engage
//   platter hold/scratch; this is intentionally left untouched for stability.
// - SHIFT+FADE FX is intentionally a safe no-op.
// - Samplers 1-4 left / 5-8 right, stems, load LEDs and fast browser remain.
//-----------------------------------------------------------------------------

function getLanguageVersion()
{
    return 1;
}

function getFileVersion()
{
    return 17;
}

function getControllerUserFriendlyName()
{
    return "Numark MixTrack Go";
}

function getControllerType()
{
    return 'midi';
}

function getSupportedHidDeviceVID(osId) { return false; }
function getSupportedHidDevicePID(osId) { return false; }
function getSupportedHidDeviceName(osId) { return false; }

// Use device-name matching for this first build. This avoids needing to know the
// exact USB PID and matches the name DEX 4 already displays on macOS.
function getSupportedMidiDeviceVID(osId) { return false; }
function getSupportedMidiDevicePID(osId) { return false; }
function getSupportedMidiSysExIdString(osId) { return false; }
function getSupportedMidiDeviceNameForInput(osId) { return "Numark MixTrack Go"; }
function getSupportedMidiDeviceNameForOutput(osId) { return "Numark MixTrack Go"; }

//-----------------------------------------------------------------------------
// Runtime state
var pitchMSB = [0, 0];
var pitchLSB = [0, 0];
var jogTouched = [0, 0];
// Updated from DEX play notifications. Used to gate SHIFT+JOG fast search.
var deckPlaying = [false, false];
var vinylMode = true;
var filterActsAsLowEQ = false;
// Performance-pad mode per deck, matching the controller labels exactly:
// 0=Hot Cue, 1=Loops, 2=Sampler, 3=Stems
var padMode = [0, 0];
// MODE buttons are also the hardware SHIFT modifiers. We delay changing the
// pad mode until MODE is released; if a shifted control was used while held,
// the release does not change modes.
var modeHeld = [false, false];
var modeShiftUsed = [false, false];
// Track normal LOAD LED state to avoid spamming MIDI output.
var loadLedState = [-1, -1];

// Tuning. If the jog feels too slow/fast, change this single value.
var JOG_SCALE = 1;
var SEARCH_JOG_SCALE = 4;

// LED values used by MixTrack Go
var LED_OFF = 0x00;
var LED_DIM = 0x01;
var LED_BRIGHT = 0x7F;

//-----------------------------------------------------------------------------
function sendNote(uniqueId, fullStatus, data1, data2)
{
    var status = fullStatus & 0xF0;
    var channel = fullStatus & 0x0F;
    sendMidi(uniqueId, status, channel, data1, data2);
}

function markShiftUsed(deck)
{
    if(deck == 0 || deck == 1)
    {
        if(modeHeld[deck]) modeShiftUsed[deck] = true;
    }
}

function markAnyHeldShiftUsed()
{
    for(var d=0; d<2; d++)
        if(modeHeld[d]) modeShiftUsed[d] = true;
}

function updateLoadLed(uniqueId, deck)
{
    // DEX does not expose a documented "track_loaded" notification like Mixxx.
    // A loaded track/video has a positive total duration; an empty deck reports 0.
    var elapsed = getValue('timeElapsed', deck);
    var remain  = getValue('timeRemain', deck);
    var total = elapsed + remain;
    var loaded = (total > 0.001);
    var value = loaded ? LED_BRIGHT : LED_DIM;

    if(loadLedState[deck] != value)
    {
        // Normal LOAD LEDs are global-channel notes 0x02 (left) / 0x03 (right).
        sendMidi(uniqueId, 0x90, 15, deck == 0 ? 0x02 : 0x03, value);
        loadLedState[deck] = value;
    }
}

function setPadModeLeds(uniqueId, deck)
{
    var ch = deck + 4;

    // One-to-one with the four labels printed on MixTrack Go.
    sendMidi(uniqueId, 0x90, ch, 0x01, padMode[deck] == 0 ? LED_BRIGHT : LED_DIM); // HOT CUE
    sendMidi(uniqueId, 0x90, ch, 0x02, padMode[deck] == 1 ? LED_BRIGHT : LED_DIM); // LOOPS
    sendMidi(uniqueId, 0x90, ch, 0x03, padMode[deck] == 2 ? LED_BRIGHT : LED_DIM); // SAMPLER
    sendMidi(uniqueId, 0x90, ch, 0x04, padMode[deck] == 3 ? LED_BRIGHT : LED_DIM); // STEMS

    if(padMode[deck] == 0)
    {
        // Restore the actual hot-cue states.
        for(var c=1; c<=4; c++)
            sendMidi(uniqueId, 0x90, ch, 0x13+c,
                     getValue('cuepos'+c, deck) ? LED_BRIGHT : LED_OFF);
    }
    else if(padMode[deck] == 1)
    {
        // Loop LEDs start dim; loop state notifications can update them later.
        for(var l=0; l<4; l++)
            sendMidi(uniqueId, 0x90, ch, 0x14+l, LED_DIM);
    }
    else if(padMode[deck] == 2)
    {
        // DEX samplers are global, but we split the 8 slots across the two sides:
        // left pads = 1..4, right pads = 5..8.
        var samplerBase = deck * 4 + 1;
        for(var s=0; s<4; s++)
        {
            var samplerSlot = samplerBase + s;
            sendMidi(uniqueId, 0x90, ch, 0x14+s,
                     getValue('sampler'+samplerSlot+'loaded') ? LED_BRIGHT : LED_OFF);
        }
    }
    else // STEMS / AIUnmixEQ kills
    {
        // DEX AIUnmixEQ on normal audio/video files exposes three separated parts
        // through the EQ kill states: Low=Drums, Mid=Instruments, High=Vocals.
        sendMidi(uniqueId, 0x90, ch, 0x14, getValue('killLow', deck)  ? LED_OFF : LED_BRIGHT);
        sendMidi(uniqueId, 0x90, ch, 0x15, getValue('killMid', deck)  ? LED_OFF : LED_BRIGHT);
        sendMidi(uniqueId, 0x90, ch, 0x16, getValue('killHigh', deck) ? LED_OFF : LED_BRIGHT);
        sendMidi(uniqueId, 0x90, ch, 0x17, LED_DIM); // restore-all utility
    }
}

function setDeckBaseLeds(uniqueId, deck)
{
    // Transport LEDs
    sendMidi(uniqueId, 0x90, deck, 0x00, LED_DIM); // PLAY
    sendMidi(uniqueId, 0x90, deck, 0x01, LED_DIM); // CUE
    sendMidi(uniqueId, 0x90, deck, 0x02, LED_DIM); // SYNC

    // Repurposed STEMS buttons: ACAPELLA=Reverse, INSTRUMENTAL=Key Lock
    sendMidi(uniqueId, 0x90, deck, 0x46, LED_DIM);
    sendMidi(uniqueId, 0x90, deck, 0x48, LED_DIM);

    // Pad mode starts in Hot Cue
    padMode[deck] = 0;
    sendMidi(uniqueId, 0x90, deck + 4, 0x01, LED_BRIGHT);
    sendMidi(uniqueId, 0x90, deck + 4, 0x02, LED_DIM);
    sendMidi(uniqueId, 0x90, deck + 4, 0x03, LED_DIM);
    sendMidi(uniqueId, 0x90, deck + 4, 0x04, LED_DIM);

    sendMidi(uniqueId, 0x90, deck + 4, 0x14, LED_OFF);
    sendMidi(uniqueId, 0x90, deck + 4, 0x15, LED_OFF);
    sendMidi(uniqueId, 0x90, deck + 4, 0x16, LED_OFF);
    sendMidi(uniqueId, 0x90, deck + 4, 0x17, LED_OFF);
}

//-----------------------------------------------------------------------------
function controllerInit(uniqueId)
{
    debug('controllerInit Numark MixTrack Go [' + uniqueId + ']');

    // Standard MIDI identity request. The public MixTrack Go mapping uses this
    // to stop the controller's light-demo state.
    sendMidiSysEx(uniqueId, [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7], 6);

    // Clear LEDs first (MixTrack Go global LED command: status 0x9E, note 0x7F)
    sendMidi(uniqueId, 0x90, 14, 0x7F, LED_OFF);

    setDeckBaseLeds(uniqueId, 0);
    setDeckBaseLeds(uniqueId, 1);

    // LOAD buttons / shifted LOAD functions. Normal LOAD LEDs indicate
    // whether a track is loaded (dim=empty, bright=loaded).
    loadLedState[0] = -1;
    loadLedState[1] = -1;
    updateLoadLed(uniqueId, 0);
    updateLoadLed(uniqueId, 1);
    sendMidi(uniqueId, 0x90, 15, 0x48, filterActsAsLowEQ ? LED_BRIGHT : LED_DIM);
    sendMidi(uniqueId, 0x90, 15, 0x49, vinylMode ? LED_BRIGHT : LED_DIM);
    // Plain FADE FX is reserved for video-transition cycling if PCDJ exposes
    // a controller action in a future DEX update. SHIFT+FADE FX is mapped below.
    sendMidi(uniqueId, 0x90, 15, 0x46, LED_DIM);
    sendMidi(uniqueId, 0x90, 15, 0x47, LED_DIM);

    // Ask DEX to push its current state so PLAY/CUE/cues/etc LEDs synchronize.
    callSendAllNotifications(uniqueId, true);
    call('sleep', 10);
}

//-----------------------------------------------------------------------------
function controllerDeinit(uniqueId)
{
    callSendAllNotifications(uniqueId, false);
    sendMidi(uniqueId, 0x90, 14, 0x7F, LED_OFF);
    call('sleep', 10);
}

//-----------------------------------------------------------------------------
// Correct handling for the MixTrack Go's 14-bit tempo fader.
// Hardware sends:
//   CC 0x09 = MSB
//   CC 0x29 = LSB
// on MIDI channel 1 (DEX channel 0) / channel 2 (DEX channel 1).
function updatePitch14Bit(deck)
{
    var value14 = (pitchMSB[deck] << 7) | pitchLSB[deck]; // 0..16383

    // DEX's setDeckPitch is used by its stock mappings with a 0..127 control
    // value. We deliberately keep this as a FLOAT rather than rounding to retain
    // as much of the 14-bit hardware resolution as DEX's scripting bridge accepts.
    // MixTrack Go's physical direction is inverted, hence 127 - normalized.
    var dexPitchValue = 127.0 - ((value14 * 127.0) / 16383.0);
    call('setDeckPitch', deck, dexPitchValue);
}

//-----------------------------------------------------------------------------
function messageReceived(uniqueId, status, channel, data1, data2, timestamp)
{
    var processed = false;

    // --------------------------- CC / continuous controls --------------------
    if(status == 0xB0)
    {
        // Master controls are on MIDI channel 16 -> DEX channel 15
        if(channel == 15)
        {
            switch(data1)
            {
                case 0x00: // Browse encoder (relative)
                    if(data2 >= 1 && data2 <= 0x3F)
                        call('lbMoveCursor', 1);
                    else if(data2 >= 0x40)
                        call('lbMoveCursor', -1);
                    processed = true;
                    break;

                case 0x01: // SHIFT + Browse encoder: fast scroll
                    markAnyHeldShiftUsed();
                    if(data2 >= 1 && data2 <= 0x3F)
                    {
                        for(var bf=0; bf<10; bf++) call('lbMoveCursor', 1);
                    }
                    else if(data2 >= 0x40)
                    {
                        for(var bb=0; bb<10; bb++) call('lbMoveCursor', -1);
                    }
                    processed = true;
                    break;

                case 0x08: // Crossfader
                    call('setCrossfader', data2);
                    processed = true;
                    break;

                case 0x0A: // Main level
                    call('setMasterGain', data2);
                    processed = true;
                    break;

                case 0x0C: // Cue/headphone level
                    call('setMonitorGain', data2);
                    processed = true;
                    break;
            }
        }
        // Deck controls are on channels 0 and 1
        else if(channel == 0 || channel == 1)
        {
            switch(data1)
            {
                case 0x06: // Jog turn
                {
                    var jogDelta = (data2 > 0x40 ? data2 - 0x80 : data2);

                    // IMPORTANT: do NOT convert the normal jog message to search
                    // merely because MODE is held. MixTrack Go emits a dedicated shifted
                    // jog CC (0x2B). Handling both 0x06 and 0x2B as search causes the
                    // rapid +/- ~1s oscillation seen in testing. This restores the v0.1
                    // transport behavior.
                    if(jogTouched[channel] && vinylMode)
                        call('scratchDeckJW', channel, jogDelta * JOG_SCALE, 600);
                    else
                        call('moveDeckJogWheel', channel, jogDelta * JOG_SCALE, 600);
                    processed = true;
                    break;
                }

                case 0x2B: // Shift + jog: fast search/scrub (if firmware emits it)
                {
                    markShiftUsed(channel);
                    var searchDelta = (data2 > 0x40 ? data2 - 0x80 : data2);
                    if(!deckPlaying[channel] || vinylMode)
                        call('searchDeckJW', channel, searchDelta * SEARCH_JOG_SCALE, 600);
                    processed = true;
                    break;
                }

                case 0x09: // Pitch MSB
                    pitchMSB[channel] = data2;
                    updatePitch14Bit(channel);
                    processed = true;
                    break;

                case 0x29: // Pitch LSB
                    pitchLSB[channel] = data2;
                    updatePitch14Bit(channel);
                    processed = true;
                    break;

                case 0x16: // Channel level
                    call('setDeckVolume', channel, data2);
                    processed = true;
                    break;

                case 0x1A: // Filter / Low EQ dual-purpose knob
                    if(filterActsAsLowEQ)
                        call('setDeckEqLow', channel, data2);
                    else
                        call('setDeckCutoff', channel, data2);
                    processed = true;
                    break;
            }
        }
    }

    // --------------------------- buttons ------------------------------------
    if(status == 0x90 || status == 0x80)
    {
        // Normalize Note-On/Note-Off into the 0x7F/0 values expected by DEX.
        var pressed = (status == 0x90 && data2 > 0) ? 0x7F : 0x00;

        // Main/global buttons (MIDI channel 16 -> DEX channel 15)
        if(channel == 15)
        {
            switch(data1)
            {
                case 0x02: // LOAD left
                    if(pressed) call('deckLBLoad', 0, 0x7F);
                    processed = true;
                    break;

                case 0x03: // LOAD right
                    if(pressed) call('deckLBLoad', 1, 0x7F);
                    processed = true;
                    break;

                case 0x07: // Browse encoder push
                    if(pressed) call('lbToggleSelect', 0x7F);
                    processed = true;
                    break;

                case 0x47: // SHIFT + FADE FX / MIDI K71
                    // DEX routes the whole device to the custom controller script, so a
                    // generic LEARN binding for K71 is no longer reached. Stable build:
                    // intentionally do not call the overlay scripting action because the
                    // prior DEX 4 test crashed the application.
                    markAnyHeldShiftUsed();
                    processed = true;
                    break;

                case 0x48: // Shift+LOAD 1: toggle Filter <-> Low EQ mode
                    markAnyHeldShiftUsed();
                    if(pressed)
                    {
                        filterActsAsLowEQ = !filterActsAsLowEQ;
                        sendMidi(uniqueId, 0x90, 15, 0x48,
                                 filterActsAsLowEQ ? LED_BRIGHT : LED_DIM);
                    }
                    processed = true;
                    break;

                case 0x49: // Shift+LOAD 2: toggle vinyl/scratch jog mode
                    markAnyHeldShiftUsed();
                    if(pressed)
                    {
                        vinylMode = !vinylMode;
                        sendMidi(uniqueId, 0x90, 15, 0x49,
                                 vinylMode ? LED_BRIGHT : LED_DIM);
                    }
                    processed = true;
                    break;
            }
        }
        // Deck transport / stems / monitor / jog touch
        else if(channel == 0 || channel == 1)
        {
            switch(data1)
            {
                case 0x00: // PLAY
                    call('deckPlayPause', channel, pressed);
                    processed = true;
                    break;

                case 0x01: // CUE
                    call('deckCue', channel, pressed);
                    processed = true;
                    break;

                case 0x02: // SYNC
                    call('deckSync', channel, pressed);
                    processed = true;
                    break;

                case 0x1B: // Channel headphone CUE/PFL
                    call('deckMonitor', channel, pressed);
                    processed = true;
                    break;

                case 0x46: // ACAPELLA repurposed as REVERSE
                    call('deckReverse', channel, pressed);
                    processed = true;
                    break;

                case 0x48: // INSTRUMENTAL repurposed as KEY LOCK
                    call('deckKeyLock', channel, pressed);
                    processed = true;
                    break;

                case 0x50: // Capacitive jog touch
                    jogTouched[channel] = pressed ? 1 : 0;
                    if(modeHeld[channel])
                    {
                        // SHIFT+JOG is search, not scratch. Do not engage the
                        // platter hold while the modifier is down.
                        markShiftUsed(channel);
                        if(!pressed && vinylMode)
                            call('holdDeckJogWheel', channel, 0x00);
                    }
                    else if(vinylMode)
                        call('holdDeckJogWheel', channel, pressed);
                    processed = true;
                    break;
            }
        }
        // Performance pads + MODE. Left deck uses MIDI channel 5 -> DEX 4,
        // right deck uses MIDI channel 6 -> DEX 5. MODE itself is note 0x00
        // on those same channels.
        else if(channel == 4 || channel == 5)
        {
            var deck = channel - 4;

            if(data1 == 0x00) // MODE / SHIFT button
            {
                if(pressed)
                {
                    modeHeld[deck] = true;
                    modeShiftUsed[deck] = false;
                }
                else
                {
                    // A plain tap changes pad mode. If MODE was used as SHIFT for
                    // another control, keep the current pad mode unchanged.
                    if(!modeShiftUsed[deck])
                    {
                        padMode[deck] = (padMode[deck] + 1) % 4;
                        setPadModeLeds(uniqueId, deck);
                    }
                    modeHeld[deck] = false;
                    modeShiftUsed[deck] = false;
                }
                processed = true;
            }
            else if(data1 >= 0x14 && data1 <= 0x17)
            {
                var pad = data1 - 0x14; // 0..3

                // IMPORTANT: for DEX deck button actions use the raw MIDI value,
                // matching PCDJ's stock Numark maps. Do not synthesize a new value.
                var rawValue = data2;

                switch(padMode[deck])
                {
                    case 0: // HOT CUE 1..4
                        if(pad == 0) call('deckCuePos1', deck, rawValue);
                        if(pad == 1) call('deckCuePos2', deck, rawValue);
                        if(pad == 2) call('deckCuePos3', deck, rawValue);
                        if(pad == 3) call('deckCuePos4', deck, rawValue);
                        break;

                    case 1: // AUTO LOOP: 1 / 2 / 4 / 8 beats
                        if(pad == 0) call('deckLoop1', deck, rawValue);
                        if(pad == 1) call('deckLoop2', deck, rawValue);
                        if(pad == 2) call('deckLoop4', deck, rawValue);
                        if(pad == 3) call('deckLoop8', deck, rawValue);
                        break;

                    case 2: // SAMPLER: left = 1..4, right = 5..8
                        // PCDJ's own Numark maps call samplerPlay only on press.
                        if(data2)
                        {
                            var samplerSlot = (deck * 4) + pad + 1;
                            call('samplerPlay', samplerSlot);
                        }
                        break;

                    case 3: // STEMS label -> DEX AIUnmixEQ / EQ-kill controls
                        // On ordinary audio/video files DEX AIUnmixEQ has 3 stems:
                        // Low=Drums, Mid=Instruments, High=Vocals.
                        if(pad == 0) call('deckEqLowKill', deck, rawValue);
                        if(pad == 1) call('deckEqMidKill', deck, rawValue);
                        if(pad == 2) call('deckEqHighKill', deck, rawValue);
                        if(pad == 3 && data2)
                        {
                            // Restore all three only if currently killed.
                            if(getValue('killLow', deck))
                            {
                                call('deckEqLowKill', deck, 0x7F);
                                call('deckEqLowKill', deck, 0x00);
                            }
                            if(getValue('killMid', deck))
                            {
                                call('deckEqMidKill', deck, 0x7F);
                                call('deckEqMidKill', deck, 0x00);
                            }
                            if(getValue('killHigh', deck))
                            {
                                call('deckEqHighKill', deck, 0x7F);
                                call('deckEqHighKill', deck, 0x00);
                            }
                        }
                        break;
                }
                processed = true;
            }
            else if(data1 >= 0x1C && data1 <= 0x1F)
            {
                // Shifted pads clear hot cues only while in Hot Cue mode. This
                // avoids destructive surprises in the other modes.
                var shiftedPad = data1 - 0x1C;
                markShiftUsed(deck);
                if(padMode[deck] == 0)
                {
                    if(shiftedPad == 0) call('deckCuePos1Clear', deck, pressed);
                    if(shiftedPad == 1) call('deckCuePos2Clear', deck, pressed);
                    if(shiftedPad == 2) call('deckCuePos3Clear', deck, pressed);
                    if(shiftedPad == 3) call('deckCuePos4Clear', deck, pressed);
                }
                processed = true;
            }
        }
    }

    if(!processed)
        debug('MixTrack Go unprocessed MIDI [' + uniqueId + '] status:' + status +
              ' channel:' + channel + ' data1:' + data1 + ' data2:' + data2);

    // false leaves unknown messages available to DEX LEARN; true consumes mapped ones.
    return processed;
}

//-----------------------------------------------------------------------------
// DEX -> controller LED feedback
function notificationReceived(uniqueId, name, deck, param1, param2, param3)
{
    if(deck == 0 || deck == 1)
    {
        if(name == 'play')
        {
            deckPlaying[deck] = param1 ? true : false;
            sendMidi(uniqueId, 0x90, deck, 0x00, param1 ? LED_BRIGHT : LED_DIM);
        }

        if(name == 'cue')
            sendMidi(uniqueId, 0x90, deck, 0x01, param1 ? LED_BRIGHT : LED_DIM);

        if(name == 'monitor')
            sendMidi(uniqueId, 0x80, deck, 0x1B, param1 ? LED_BRIGHT : LED_OFF);

        // Dedicated buttons repurposed for this live-video workflow.
        if(name == 'reverse')
            sendMidi(uniqueId, 0x90, deck, 0x46, param1 ? LED_BRIGHT : LED_DIM);

        if(name == 'keyLock')
            sendMidi(uniqueId, 0x90, deck, 0x48, param1 ? LED_BRIGHT : LED_DIM);

        if(name == 'justLoaded')
            updateLoadLed(uniqueId, deck);

        if(padMode[deck] == 3)
        {
            // Kill notifications are 1 when that part/band is muted.
            if(name == 'killLow')  sendMidi(uniqueId, 0x90, deck + 4, 0x14, param1 ? LED_OFF : LED_BRIGHT);
            if(name == 'killMid')  sendMidi(uniqueId, 0x90, deck + 4, 0x15, param1 ? LED_OFF : LED_BRIGHT);
            if(name == 'killHigh') sendMidi(uniqueId, 0x90, deck + 4, 0x16, param1 ? LED_OFF : LED_BRIGHT);
        }

        if(padMode[deck] == 0)
        {
            if(name == 'cuepos1') sendMidi(uniqueId, 0x90, deck + 4, 0x14, param1 ? LED_BRIGHT : LED_OFF);
            if(name == 'cuepos2') sendMidi(uniqueId, 0x90, deck + 4, 0x15, param1 ? LED_BRIGHT : LED_OFF);
            if(name == 'cuepos3') sendMidi(uniqueId, 0x90, deck + 4, 0x16, param1 ? LED_BRIGHT : LED_OFF);
            if(name == 'cuepos4') sendMidi(uniqueId, 0x90, deck + 4, 0x17, param1 ? LED_BRIGHT : LED_OFF);
        }
    }
}

//-----------------------------------------------------------------------------
function timerTick(uniqueId)
{
    // Keep normal LOAD LEDs synchronized with whether each deck contains a track.
    // updateLoadLed only sends MIDI when the state actually changes.
    updateLoadLed(uniqueId, 0);
    updateLoadLed(uniqueId, 1);
}
