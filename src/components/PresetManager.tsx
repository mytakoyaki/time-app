import React, { useState } from "react";
import { Preset } from "../types";

interface PresetManagerProps {
  presets: Preset[];
  onSave: (preset: Preset) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export function PresetManager({ presets, onSave, onDelete, onClose }: PresetManagerProps) {
  const [activePresetTab, setActivePresetTab] = useState<"list" | "create">("list");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  // Form State
  const [pmName, setPmName] = useState("");
  const [pmPMin, setPmPMin] = useState(5);
  const [pmPSec, setPmPSec] = useState(0);
  const [pmPWarn, setPmPWarn] = useState(60);
  const [pmQMin, setPmQMin] = useState(3);
  const [pmQSec, setPmQSec] = useState(0);
  const [pmQWarn, setPmQWarn] = useState(30);

  const resetForm = () => {
      setEditingPresetId(null);
      setPmName("");
      setPmPMin(5); setPmPSec(0); setPmPWarn(60);
      setPmQMin(3); setPmQSec(0); setPmQWarn(30);
  };

  const handleEditPreset = (preset: Preset) => {
      setEditingPresetId(preset.id);
      setPmName(preset.name);
      setPmPMin(preset.pMin); setPmPSec(preset.pSec); setPmPWarn(preset.pWarn);
      setPmQMin(preset.qMin); setPmQSec(preset.qSec); setPmQWarn(preset.qWarn);
      setActivePresetTab("create");
  };

  const handleSave = async () => {
      if (!pmName) {
          alert("プリセット名を入力してください。");
          return;
      }

      const newPreset: Preset = {
          id: editingPresetId || Date.now().toString(),
          name: pmName,
          pMin: pmPMin, pSec: pmPSec, pWarn: pmPWarn,
          qMin: pmQMin, qSec: pmQSec, qWarn: pmQWarn
      };

      try {
          await onSave(newPreset);
          setStatusMessage(`プリセット「${pmName}」を保存しました。`);
          resetForm();
          setActivePresetTab("list");
      } catch (e) {
          setStatusMessage("保存に失敗しました。");
      }
  };

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm(`プリセット「${name}」を削除してもよろしいですか？`)) return;
      
      try {
          await onDelete(id);
          setStatusMessage(`プリセット「${name}」を削除しました。`);
          if (editingPresetId === id) {
              resetForm();
              setActivePresetTab("list");
          }
      } catch (e) {
          setStatusMessage("削除に失敗しました。");
      }
  };

  return (
      <div className="container" id="preset-manager-view">
          <h1>プリセット管理</h1>
          
          <div className="tab-navigation">
              <button 
                className={`tab-btn ${activePresetTab === 'list' ? 'active' : ''}`}
                onClick={() => setActivePresetTab('list')}
              >
                保存済みリスト
              </button>
              <button 
                className={`tab-btn ${activePresetTab === 'create' ? 'active' : ''}`}
                onClick={() => { resetForm(); setActivePresetTab('create'); }}
              >
                新規作成
              </button>
          </div>
          
          {activePresetTab === 'create' && (
              <div className="preset-editor">
                  <h3>{editingPresetId ? "プリセットを編集" : "新しいプリセットを作成"}</h3>
                  <div className="editor-row">
                      <label>名前:</label>
                      <input 
                        type="text" 
                        value={pmName} 
                        onChange={(e) => setPmName(e.target.value)} 
                        placeholder="例: 社内LT"
                        className="name-input"
                      />
                  </div>
                  
                  <div className="editor-columns">
                      <div className="editor-column">
                          <h4>発表時間</h4>
                          <div className="editor-time-row">
                              <input type="number" value={pmPMin} onChange={(e) => setPmPMin(Math.max(0, parseInt(e.target.value)||0))} />分
                              <input type="number" value={pmPSec} onChange={(e) => setPmPSec(Math.max(0, parseInt(e.target.value)||0))} />秒
                          </div>
                          <div className="editor-warn-row">
                              <label>警告残り:</label>
                              <input type="number" value={pmPWarn} onChange={(e) => setPmPWarn(Math.max(0, parseInt(e.target.value)||0))} />秒
                          </div>
                      </div>
                      
                      <div className="editor-column">
                          <h4>質疑応答</h4>
                          <div className="editor-time-row">
                              <input type="number" value={pmQMin} onChange={(e) => setPmQMin(Math.max(0, parseInt(e.target.value)||0))} />分
                              <input type="number" value={pmQSec} onChange={(e) => setPmQSec(Math.max(0, parseInt(e.target.value)||0))} />秒
                          </div>
                          <div className="editor-warn-row">
                              <label>警告残り:</label>
                              <input type="number" value={pmQWarn} onChange={(e) => setPmQWarn(Math.max(0, parseInt(e.target.value)||0))} />秒
                          </div>
                      </div>
                  </div>
                  
                  <div className="editor-actions">
                      <button onClick={handleSave} className="save-btn">保存</button>
                      <button onClick={resetForm} className="cancel-btn">クリア</button>
                  </div>
              </div>
          )}

          {activePresetTab === 'list' && (
              <div className="preset-list">
                  <h3>一覧</h3>
                  {presets.length === 0 && <p>プリセットがありません。</p>}
                  <ul>
                      {presets.map(p => (
                          <li key={p.id} onClick={() => handleEditPreset(p)} className={editingPresetId === p.id ? "editing" : ""}>
                              <span className="preset-name">{p.name}</span>
                              <span className="preset-details">
                                  発表: {p.pMin}分{p.pSec}秒 / 質疑: {p.qMin}分{p.qSec}秒
                              </span>
                              <button className="delete-icon" onClick={(e) => handleDelete(p.id, p.name, e)}>×</button>
                          </li>
                      ))}
                  </ul>
              </div>
          )}

          <p className="manager-status-message">{statusMessage}</p>

          <button onClick={onClose} className="back-btn">設定画面に戻る</button>
      </div>
  );
}
