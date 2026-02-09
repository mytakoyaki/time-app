import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders setup view initially', () => {
    render(<App />);
    expect(screen.getByText('発表時間管理 - 設定')).toBeInTheDocument();
    expect(screen.getByLabelText('発表時間:')).toBeInTheDocument();
    expect(screen.getByLabelText('質疑応答:')).toBeInTheDocument();
  });

  it('updates input values', () => {
    render(<App />);
    const minutesInput = screen.getByLabelText('発表時間:') as HTMLInputElement;
    fireEvent.change(minutesInput, { target: { value: '10' } });
    expect(minutesInput.value).toBe('10');
  });

  it('switches to timer view on button click', async () => {
    render(<App />);
    const button = screen.getByText('タイマー表示へ');
    fireEvent.click(button);
    
    // Check if view changed
    expect(screen.queryByText('発表時間管理 - 設定')).not.toBeInTheDocument();
    expect(screen.getByText('発表')).toBeInTheDocument(); // Initial stage name
    expect(screen.getByText('開始')).toBeInTheDocument();
  });
});
