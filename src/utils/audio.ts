import { SoundType } from "../types";

// Simple beep generator using Web Audio API

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext!;
}

export function playBeep(
  count: number = 1, 
  frequency: number = 880, 
  duration: number = 0.1, 
  type: OscillatorType = 'sine',
  interval: number = 0.2
) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const now = ctx.currentTime;

    for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.value = frequency;

        // Envelope for smooth sound
        gain.gain.setValueAtTime(0, now + i * interval);
        gain.gain.linearRampToValueAtTime(0.5, now + i * interval + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * interval + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * interval);
        osc.stop(now + i * interval + duration + 0.1);
    }
  } catch (e) {
    console.error("Failed to play audio:", e);
  }
}

// 警告音のパターン定義
export function playWarningSound(soundType: SoundType = "standard") {
    switch (soundType) {
        case "electronic":
            playBeep(1, 1200, 0.05, 'square');
            break;
        case "bell":
            playBeep(1, 660, 0.5, 'sine');
            break;
        case "chime":
            playBeep(2, 880, 0.3, 'sine', 0.4);
            break;
        default: // standard
            playBeep(1, 880, 0.15, 'sine');
            break;
    }
}

// 終了/超過音のパターン定義
export function playOvertimeSound(soundType: SoundType = "standard") {
    switch (soundType) {
        case "electronic":
            playBeep(2, 1000, 0.08, 'square', 0.12);
            break;
        case "bell":
            playBeep(2, 523.25, 0.6, 'sine', 0.8); // C5
            break;
        case "chime":
            playBeep(3, 1174.66, 0.2, 'sine', 0.3); // D6
            break;
        default: // standard
            playBeep(2, 1760, 0.1, 'sine', 0.2);
            break;
    }
}

// 全終了音（質疑応答終了）のパターン定義
export function playFinishSound(soundType: SoundType = "standard") {
    switch (soundType) {
        case "electronic":
            playBeep(3, 800, 0.1, 'square', 0.15);
            break;
        case "bell":
            playBeep(3, 440, 0.8, 'sine', 1.0); // A4
            break;
        case "chime":
            playBeep(4, 1318.51, 0.2, 'sine', 0.25); // E6
            break;
        default: // standard
            playBeep(3, 1760, 0.1, 'sine', 0.2);
            break;
    }
}
