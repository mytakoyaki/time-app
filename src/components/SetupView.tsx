import { useState, useEffect } from "react";
import { availableMonitors, Monitor } from "@tauri-apps/api/window";
import { Preset, TimerStage } from "../types";

interface SetupViewProps {
  presets: Preset[];
  onOpenSettings: () => void;
  onStartTimer: (stages: TimerStage[]) => void;
  onStartWithMirror: (stages: TimerStage[]) => void;
  statusMessage?: string;
}

export function SetupView({
  presets,
  onOpenSettings,
  onStartTimer,
  onStartWithMirror,
  statusMessage
}: SetupViewProps) {
  const [presentationMinutes, setPresentationMinutes] = useState(5);
  const [presentationSeconds, setPresentationSeconds] = useState(0);
  const [presentationWarning, setPresentationWarning] = useState(60);

  const [qaMinutes, setQaMinutes] = useState(3);
  const [qaSeconds, setQaSeconds] = useState(0);
  const [qaWarning, setQaWarning] = useState(30);

  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [monitors, setMonitors] = useState<Monitor[]>([]);

  useEffect(() => {
    availableMonitors().then(setMonitors).catch(console.error);
  }, []);

  const getStages = (): TimerStage[] | null => {
    const pSec = presentationMinutes * 60 + presentationSeconds;
    const qSec = qaMinutes * 60 + qaSeconds;
    const stages: TimerStage[] = [];
    
    if (pSec > 0) stages.push({ name: "発表", duration: pSec, warningThreshold: presentationWarning });
    if (qSec > 0) stages.push({ name: "質疑応答", duration: qSec, warningThreshold: qaWarning });

    return stages.length > 0 ? stages : null;
  };

  const handleApplyPreset = () => {
      const preset = presets.find(p => p.id === selectedPresetId);
      if (preset) {
          setPresentationMinutes(preset.pMin);
          setPresentationSeconds(preset.pSec);
          setPresentationWarning(preset.pWarn);
          setQaMinutes(preset.qMin);
          setQaSeconds(preset.qSec);
          setQaWarning(preset.qWarn);
      }
  };

  return (
    <div id="setup-view">
      <div className="setup-header">
          <h1>発表時間管理</h1>
          <button onClick={onOpenSettings} className="settings-icon-btn" title="設定">⚙ 設定</button>
      </div>
      
      <div className="preset-selection-row">
          <label>プリセット:</label>
          <select 
            value={selectedPresetId} 
            onChange={(e) => setSelectedPresetId(e.target.value)}
            className="preset-select"
          >
              <option value="" disabled>選択してください</option>
              {presets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
          <button 
            onClick={handleApplyPreset} 
            className="apply-preset-btn"
            disabled={!selectedPresetId}
          >
              設定を反映
          </button>
      </div>

      <div className="main-input-container">
        <div className="input-card">
            <label>発表時間</label>
            <div className="time-inputs">
                <input type="number" value={presentationMinutes} onChange={(e) => setPresentationMinutes(Math.max(0, parseInt(e.target.value)||0))} />
                <span>分</span>
                <input type="number" value={presentationSeconds} onChange={(e) => setPresentationSeconds(Math.max(0, Math.min(59, parseInt(e.target.value)||0)))} />
                <span>秒</span>
            </div>
            <div className="warning-input">
                <label>警告 (残り):</label>
                <input type="number" value={presentationWarning} onChange={(e) => setPresentationWarning(Math.max(0, parseInt(e.target.value)||0))} />
                <span>秒</span>
            </div>
        </div>

        <div className="input-card">
            <label>質疑応答</label>
            <div className="time-inputs">
                <input type="number" value={qaMinutes} onChange={(e) => setQaMinutes(Math.max(0, parseInt(e.target.value)||0))} />
                <span>分</span>
                <input type="number" value={qaSeconds} onChange={(e) => setQaSeconds(Math.max(0, Math.min(59, parseInt(e.target.value)||0)))} />
                <span>秒</span>
            </div>
            <div className="warning-input">
                <label>警告 (残り):</label>
                <input type="number" value={qaWarning} onChange={(e) => setQaWarning(Math.max(0, parseInt(e.target.value)||0))} />
                <span>秒</span>
            </div>
        </div>
      </div>
      
      <div className="action-area">
          <button onClick={() => { const s = getStages(); if(s) onStartTimer(s); }} className="primary-start-btn">
             タイマー開始
          </button>
          <button 
            onClick={() => { const s = getStages(); if(s) onStartWithMirror(s); }} 
            className="secondary-start-btn"
            disabled={monitors.length <= 1}
            title={monitors.length <= 1 ? "外部ディスプレイが接続されていません" : ""}
          >
             プレゼン開始 (2画面)
          </button>
      </div>

      {statusMessage && <p className="setup-status">{statusMessage}</p>}
    </div>
  );
}