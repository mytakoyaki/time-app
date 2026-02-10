import { useState } from "react";
import { Preset, TimerStage } from "../types";

interface SetupViewProps {
  presets: Preset[];
  onOpenPresetManager: () => void;
  onStartTimer: (stages: TimerStage[]) => void;
  enableSound: boolean;
  onToggleSound: (enabled: boolean) => void;
  deductOvertime: boolean;
  setDeductOvertime: (val: boolean) => void;
  statusMessage?: string;
}

export function SetupView({
  presets,
  onOpenPresetManager,
  onStartTimer,
  enableSound,
  onToggleSound,
  deductOvertime,
  setDeductOvertime,
  statusMessage
}: SetupViewProps) {
  // Local Inputs
  const [presentationMinutes, setPresentationMinutes] = useState(5);
  const [presentationSeconds, setPresentationSeconds] = useState(0);
  const [presentationWarningSeconds, setPresentationWarningSeconds] = useState(60);

  const [qaMinutes, setQaMinutes] = useState(3);
  const [qaSeconds, setQaSeconds] = useState(0);
  const [qaWarningSeconds, setQaWarningSeconds] = useState(30);

  const [localStatusMessage, setLocalStatusMessage] = useState("");

  const handleApplyPreset = (preset: Preset) => {
      setPresentationMinutes(preset.pMin);
      setPresentationSeconds(preset.pSec);
      setPresentationWarningSeconds(preset.pWarn);
      setQaMinutes(preset.qMin);
      setQaSeconds(preset.qSec);
      setQaWarningSeconds(preset.qWarn);
      setLocalStatusMessage(`プリセット「${preset.name}」を適用しました。`);
  };

  const handleGoToTimerView = () => {
    const pSec = presentationMinutes * 60 + presentationSeconds;
    const qSec = qaMinutes * 60 + qaSeconds;
    
    // ステージを構築
    const stages: TimerStage[] = [];
    
    if (pSec > 0) {
        stages.push({ name: "発表", duration: pSec, warningThreshold: presentationWarningSeconds });
    }
    if (qSec > 0) {
        stages.push({ name: "質疑応答", duration: qSec, warningThreshold: qaWarningSeconds });
    }

    if (stages.length === 0) {
      setLocalStatusMessage("タイマーを設定してください。");
      return;
    }

    onStartTimer(stages);
  };

  return (
    <div id="setup-view">
      <h1>発表時間管理</h1>
      
      <div className="preset-selection-area">
          <h3>プリセットを選択</h3>
          <div className="preset-buttons">
              {presets.map((preset) => (
                  <button key={preset.id} onClick={() => handleApplyPreset(preset)} className="preset-btn">
                      {preset.name}
                  </button>
              ))}
          </div>
          <button onClick={onOpenPresetManager} className="manage-presets-link">
              プリセットを管理・編集する
          </button>
      </div>

      <div className="timer-setup-grid">
        <div className="timer-setup-group">
            <div className="timer-setup">
              <label htmlFor="minutes-presentation">発表時間</label>
              <div className="time-input-row">
                <input
                    type="number"
                    id="minutes-presentation"
                    value={presentationMinutes}
                    onChange={(e) => setPresentationMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                    min="0"
                    max="99"
                />
                <span>分</span>
                <input
                    type="number"
                    id="seconds-presentation"
                    value={presentationSeconds}
                    onChange={(e) => setPresentationSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    min="0"
                    max="59"
                />
                <span>秒</span>
              </div>
            </div>
            <div className="warning-setup">
                <label>警告開始 (残り):</label>
                <input
                    type="number"
                    value={presentationWarningSeconds}
                    onChange={(e) => setPresentationWarningSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                />
                <span>秒</span>
            </div>
        </div>

        <div className="timer-setup-group">
            <div className="timer-setup">
              <label htmlFor="minutes-qa">質疑応答</label>
              <div className="time-input-row">
                <input
                    type="number"
                    id="minutes-qa"
                    value={qaMinutes}
                    onChange={(e) => setQaMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                    min="0"
                    max="99"
                />
                <span>分</span>
                <input
                    type="number"
                    id="seconds-qa"
                    value={qaSeconds}
                    onChange={(e) => setQaSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    min="0"
                    max="59"
                />
                <span>秒</span>
              </div>
            </div>
            <div className="warning-setup">
                <label>警告開始 (残り):</label>
                <input
                    type="number"
                    value={qaWarningSeconds}
                    onChange={(e) => setQaWarningSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                />
                <span>秒</span>
            </div>
        </div>
      </div>
      
      <div className="timer-options">
        <div className="timer-option-row">
            <input 
                type="checkbox" 
                id="enable-sound"
                checked={enableSound}
                onChange={(e) => onToggleSound(e.target.checked)}
                style={{width: "20px", height: "20px"}} 
            />
            <label htmlFor="enable-sound" style={{cursor: "pointer"}}>通知音を鳴らす</label>
        </div>
        <div className="timer-option-row">
            <input 
                type="checkbox" 
                id="deduct-overtime"
                checked={deductOvertime}
                onChange={(e) => setDeductOvertime(e.target.checked)}
                style={{width: "20px", height: "20px"}} 
            />
            <label htmlFor="deduct-overtime" style={{cursor: "pointer"}}>発表の超過分を質疑応答から引く</label>
        </div>
      </div>
      
      <button id="go-to-timer-view" onClick={handleGoToTimerView} className="start-btn">
         タイマー開始
      </button>

      <p id="setup-status-message">{statusMessage || localStatusMessage}</p>
    </div>
  );
}
