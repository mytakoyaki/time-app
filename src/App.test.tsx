import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';

// Mock setup to capture event listeners
let listeners: Record<string, (event: any) => void> = {};

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((event, callback) => {
    listeners[event] = callback;
    return Promise.resolve(() => {
      delete listeners[event];
    });
  }),
}));

describe('App Component Behavior Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listeners = {};
    // Use fake timers to control any time-based logic if necessary (though mostly driven by events here)
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setupTimerView = async () => {
    render(<App />);
    const button = screen.getByText('タイマー表示へ');
    await act(async () => {
      fireEvent.click(button);
    });
  };

  const simulateTimerUpdate = (remainingSeconds: number) => {
    act(() => {
      if (listeners['timer-update']) {
        listeners['timer-update']({ payload: remainingSeconds });
      }
    });
  };

  it('shows warning color when time is low', async () => {
    await setupTimerView();

    // Default warning threshold is 60s. Simulate 59s.
    simulateTimerUpdate(59);

    const display = screen.getByText('59').closest('.timer-display');
    expect(display).toHaveClass('warning');
    expect(display).not.toHaveClass('overtime');
  });

  it('shows overtime color and negative time when time is exceeded', async () => {
    await setupTimerView();

    // Simulate -5 seconds (Overtime)
    simulateTimerUpdate(-5);

    const display = screen.getByText('05').closest('.timer-display');
    expect(display).toHaveClass('overtime');
    expect(display).not.toHaveClass('warning');
    
    // Check for negative sign in text content
    expect(display).toHaveTextContent('-');
  });

  it('deducts overtime from the next stage (QA)', async () => {
    await setupTimerView();

    // 1. Start Presentation
    const startButton = screen.getByText('開始');
    await act(async () => {
      fireEvent.click(startButton);
    });

    // 2. Simulate Overtime of 60 seconds (1 minute)
    simulateTimerUpdate(-60);

    // 3. Stop Timer first (since Next Stage button is disabled while running)
    const stopButton = screen.getByText('停止');
    await act(async () => {
        fireEvent.click(stopButton);
    });

    // 4. Go to Next Stage
    const nextButton = screen.getByText('次のステージへ');
    await act(async () => {
      fireEvent.click(nextButton);
    });

    // 5. Verify Next Stage (QA) Status
    expect(screen.getByText('質疑応答')).toBeInTheDocument();
    
    // Check if time is 02:00 (120 seconds)
    expect(screen.getByText('02')).toBeInTheDocument(); // Minutes
    expect(screen.getByText('00')).toBeInTheDocument(); // Seconds
    
    // Verify message
    expect(screen.getByText(/前回の超過 \(60秒\) を差し引きました/)).toBeInTheDocument();
  });
});
