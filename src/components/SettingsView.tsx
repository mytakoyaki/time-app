import { useState, useEffect } from "react";
import { availableMonitors, Monitor } from "@tauri-apps/api/window";
import { Preset, SoundType, DisplaySettings } from "../types";

interface SettingsViewProps {
  presets: Preset[];
  onSavePreset: (preset: Preset) => Promise<void>;
  onDeletePreset: (id: string) => Promise<void>;
  enableSound: boolean;
  onToggleSound: (val: boolean) => void;
  selectedSoundType: SoundType;
  onSoundTypeChange: (val: SoundType) => void;
  displaySettings: DisplaySettings;
  onDisplaySettingsChange: (val: DisplaySettings) => void;
  deductOvertime: boolean;
  onDeductOvertimeChange: (val: boolean) => void;
  onClose: () => void;
}

export function SettingsView({
  presets, onSavePreset, onDeletePreset,
  enableSound, onToggleSound,
  selectedSoundType, onSoundTypeChange,
  displaySettings, onDisplaySettingsChange,
  deductOvertime, onDeductOvertimeChange,
  onClose
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<"general" | "list" | "editor">("general");
  const [monitors, setMonitors] = useState<Monitor[]>([]);

  // Form State
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [pmName, setPmName] = useState("");
  const [pmPMin, setPmPMin] = useState(5);
  const [pmPSec, setPmPSec] = useState(0);
  const [pmPWarn, setPmPWarn] = useState(60);
  const [pmQMin, setPmQMin] = useState(3);
  const [pmQSec, setPmQSec] = useState(0);
  const [pmQWarn, setPmQWarn] = useState(30);

  useEffect(() => {
    availableMonitors().then(setMonitors).catch(console.error);
  }, []);

  const resetPresetForm = () => {
      setEditingPresetId(null);
      setPmName("");
      setPmPMin(5); setPmPSec(0); setPmPWarn(60);
      setPmQMin(3); setPmQSec(0); setPmQWarn(30);
  };

  const handleEditPreset = (p: Preset) => {
      setEditingPresetId(p.id);
      setPmName(p.name);
      setPmPMin(p.pMin); setPmPSec(p.pSec); setPmPWarn(p.pWarn);
      setPmQMin(p.qMin); setPmQSec(p.qSec); setPmQWarn(p.qWarn);
      setActiveTab("editor"); // 編集モードに切り替え
  };

  const handleSave = async () => {
      if(!pmName) { alert("名前を入力してください"); return; }
      await onSavePreset({ 
          id: editingPresetId || Date.now().toString(), 
          name: pmName, 
          pMin: pmPMin, pSec: pmPSec, pWarn: pmPWarn, 
          qMin: pmQMin, qSec: pmQSec, qWarn: pmQWarn 
      });
      resetPresetForm();
      setActiveTab("list"); // 保存後はリストに戻る
  };

  return (
      <div className="container" id="settings-view">
          <h1>設定</h1>
          
          <div className="tab-navigation">
              <button className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>一般・表示</button>
              <button className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>保存済みリスト</button>
              <button className={`tab-btn ${activeTab === 'editor' ? 'active' : ''}`} onClick={() => { if(!editingPresetId) resetPresetForm(); setActiveTab('editor'); }}>
                  {editingPresetId ? "プリセットを編集" : "新規作成"}
              </button>
          </div>
          
          <div className="settings-content">
              {activeTab === 'general' && (
                  <div className="settings-section">
                      <div className="setting-group">
                          <h3>通知音</h3>
                          <label className="checkbox-label">
                              <input type="checkbox" checked={enableSound} onChange={(e) => onToggleSound(e.target.checked)} />
                              通知音を有効にする
                          </label>
                          <div className="setting-row">
                              <span>音色:</span>
                              <select value={selectedSoundType} onChange={(e) => onSoundTypeChange(e.target.value as SoundType)} disabled={!enableSound} className="select-input">
                                  <option value="standard">標準</option>
                                  <option value="electronic">電子音</option>
                                  <option value="bell">ベル風</option>
                                  <option value="chime">チャイム風</option>
                              </select>
                          </div>
                      </div>

                      <div className="setting-group">
                          <h3>外部ディスプレイ</h3>
                          <div className="setting-row">
                              <span>出力先:</span>
                              <select value={displaySettings.targetMonitorName || ""} onChange={(e) => onDisplaySettingsChange({ targetMonitorName: e.target.value || null })} className="select-input">
                                  <option value="">自動 (2枚目を優先)</option>
                                  {monitors.map((m, i) => (
                                      <option key={i} value={m.name || ""}>{m.name || `Display ${i+1}`} ({m.size.width}x{m.size.height})</option>
                                  ))}
                              </select>
                          </div>
                      </div>

                      <div className="setting-group">
                          <h3>タイマー挙動</h3>
                          <label className="checkbox-label">
                              <input type="checkbox" checked={deductOvertime} onChange={(e) => onDeductOvertimeChange(e.target.checked)} />
                              発表の超過分を質疑応答から引く
                          </label>
                      </div>
                  </div>
              )}

              {activeTab === 'list' && (
                  <div className="preset-list-full">
                      {presets.length === 0 ? (
                          <p className="empty-msg">保存されたプリセットはありません。</p>
                      ) : (
                          <div className="preset-grid">
                              {presets.map(p => (
                                  <div key={p.id} className="preset-card-wide" onClick={() => handleEditPreset(p)}>
                                      <div className="p-main">
                                          <div className="p-title">{p.name}</div>
                                          <div className="p-meta">
                                              <span>発表: {p.pMin}分{p.pSec}秒</span>
                                              <span className="separator">|</span>
                                              <span>質疑: {p.qMin}分{p.qSec}秒</span>
                                          </div>
                                      </div>
                                      <div className="p-actions">
                                          <button className="edit-link">編集</button>
                                          <button className="delete-btn-large" onClick={(e) => { e.stopPropagation(); onDeletePreset(p.id); }}>削除</button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              )}

              {activeTab === 'editor' && (
                  <div className="preset-editor-standalone">
                      <div className="form-group">
                          <label>プリセット名</label>
                          <input type="text" value={pmName} onChange={(e) => setPmName(e.target.value)} placeholder="例: 社内LT (5分)" className="name-input-large" />
                      </div>
                      
                      <div className="editor-columns-wide">
                          <div className="editor-col">
                              <h4>発表設定</h4>
                              <div className="input-group-large">
                                  <input type="number" value={pmPMin} onChange={(e) => setPmPMin(parseInt(e.target.value)||0)} />
                                  <span>分</span>
                                  <input type="number" value={pmPSec} onChange={(e) => setPmPSec(parseInt(e.target.value)||0)} />
                                  <span>秒</span>
                              </div>
                              <div className="warning-setting">
                                  <label>警告タイミング:</label>
                                  <input type="number" value={pmPWarn} onChange={(e) => setPmPWarn(parseInt(e.target.value)||0)} />
                                  <span>秒前</span>
                              </div>
                          </div>
                          
                          <div className="editor-col">
                              <h4>質疑応答設定</h4>
                              <div className="input-group-large">
                                  <input type="number" value={pmQMin} onChange={(e) => setPmQMin(parseInt(e.target.value)||0)} />
                                  <span>分</span>
                                  <input type="number" value={pmQSec} onChange={(e) => setPmQSec(parseInt(e.target.value)||0)} />
                                  <span>秒</span>
                              </div>
                              <div className="warning-setting">
                                  <label>警告タイミング:</label>
                                  <input type="number" value={pmQWarn} onChange={(e) => setPmQWarn(parseInt(e.target.value)||0)} />
                                  <span>秒前</span>
                              </div>
                          </div>
                      </div>

                      <div className="editor-footer">
                          <button onClick={handleSave} className="main-save-btn">
                              {editingPresetId ? "変更を保存する" : "新規プリセットとして保存"}
                          </button>
                          <button onClick={() => { resetPresetForm(); setActiveTab("list"); }} className="cancel-btn-text">
                              キャンセル
                          </button>
                      </div>
                  </div>
              )}
          </div>

          <button onClick={onClose} className="back-home-btn">ホームに戻る</button>
      </div>
  );
}
