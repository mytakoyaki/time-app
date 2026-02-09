// Simple beep generator using Web Audio API

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext!;
}

export function playBeep(count: number = 1, frequency: number = 880, duration: number = 0.1) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const now = ctx.currentTime;

    for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = frequency;

        // Envelope for smooth sound
        gain.gain.setValueAtTime(0, now + i * 0.2);
        gain.gain.linearRampToValueAtTime(0.5, now + i * 0.2 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.2);
        osc.stop(now + i * 0.2 + duration + 0.1);
    }
  } catch (e) {
    console.error("Failed to play audio:", e);
  }
}

// 警告音: ピッ
export function playWarningSound() {
    playBeep(1, 880, 0.15); 
}

// 終了/超過音: ピピッ
export function playOvertimeSound() {
    playBeep(2, 1760, 0.1);
}
