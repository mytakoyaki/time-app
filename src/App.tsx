import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { load } from "@tauri-apps/plugin-store";
import { playWarningSound, playOvertimeSound, playFinishSound } from "./utils/audio";

interface TimerStage {
  name: string;
  duration: number; // in seconds
  warningThreshold: number; // in seconds
}

interface Preset {
    id: string; 
    name: string;
    pMin: number;
    pSec: number;
    qMin: number;
    qSec: number;
    pWarn: number;
    qWarn: number;
}

const DEFAULT_PRESETS: Preset[] = [
    { id: "default", name: "標準 (5分/3分)", pMin: 5, pSec: 0, qMin: 3, qSec: 0, pWarn: 60, qWarn: 30 },
    { id: "short", name: "短め (3分/2分)", pMin: 3, pSec: 0, qMin: 2, qSec: 0, pWarn: 30, qWarn: 30 },
    { id: "long", name: "長め (10分/5分)", pMin: 10, pSec: 0, qMin: 5, qSec: 0, pWarn: 120, qWarn: 60 },
    { id: "lt", name: "LT (5分/なし)", pMin: 5, pSec: 0, qMin: 0, qSec: 0, pWarn: 60, qWarn: 0 },
];

const PRESETS_FILE = "settings.json";

function App() {
  // --- State ---
  // View
  const [view, setView] = useState<"setup" | "timer" | "preset-manager">("setup");
  const [activePresetTab, setActivePresetTab] = useState<"list" | "create">("list");

  // Inputs
  const [presentationMinutes, setPresentationMinutes] = useState(5);
  const [presentationSeconds, setPresentationSeconds] = useState(0);
  const [presentationWarningSeconds, setPresentationWarningSeconds] = useState(60);

  const [qaMinutes, setQaMinutes] = useState(3);
  const [qaSeconds, setQaSeconds] = useState(0);
  const [qaWarningSeconds, setQaWarningSeconds] = useState(30);
  
  // Settings
  const [deductOvertime, setDeductOvertime] = useState(true);
  const [enableSound, setEnableSound] = useState(true);
  
  // Presets
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  
  // Preset Manager Inputs
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [pmName, setPmName] = useState("");
  const [pmPMin, setPmPMin] = useState(5);
  const [pmPSec, setPmPSec] = useState(0);
  const [pmPWarn, setPmPWarn] = useState(60);
  const [pmQMin, setPmQMin] = useState(3);
  const [pmQSec, setPmQSec] = useState(0);
  const [pmQWarn, setPmQWarn] = useState(30);

  // Timer Logic
  const [timerStages, setTimerStages] = useState<TimerStage[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [currentRemainingSeconds, setCurrentRemainingSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  // Refs
  const timerStagesRef = useRef<TimerStage[]>([]);
  const currentStageIndexRef = useRef(0);
  const currentRemainingSecondsRef = useRef(0);
  const isTimerRunningRef = useRef(false);
  const enableSoundRef = useRef(true);

  // --- Effects ---

  // Load presets and settings from Store on mount
  useEffect(() => {
    const initStore = async () => {
        try {
            const store = await load(PRESETS_FILE);
            const savedPresets = await store.get<Preset[]>("presets");
            if (savedPresets) {
                setPresets(savedPresets);
            } else {
                await store.set("presets", DEFAULT_PRESETS);
                await store.save();
            }
            
            const savedEnableSound = await store.get<boolean>("enableSound");
            if (savedEnableSound !== null && savedEnableSound !== undefined) {
                setEnableSound(savedEnableSound);
            }
        } catch (e) {
            console.error("Failed to load presets/settings from store", e);
        }
    };
    initStore();
  }, []);

  // Sync refs with state
  useEffect(() => {
    timerStagesRef.current = timerStages;
  }, [timerStages]);

  useEffect(() => {
    currentStageIndexRef.current = currentStageIndex;
  }, [currentStageIndex]);
  
  useEffect(() => {
    isTimerRunningRef.current = isTimerRunning;
  }, [isTimerRunning]);

  useEffect(() => {
    currentRemainingSecondsRef.current = currentRemainingSeconds;
  }, [currentRemainingSeconds]);
  
  useEffect(() => {
    enableSoundRef.current = enableSound;
  }, [enableSound]);


  // Event Listeners
  useEffect(() => {
    let unlistenUpdate: (() => void) | undefined;
    let unlistenFinished: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenUpdate = await listen<number>("timer-update", (event) => {
        const remaining = event.payload;
        setCurrentRemainingSeconds(remaining);
        
        // Sound Logic
        const stages = timerStagesRef.current;
        const index = currentStageIndexRef.current;
        const soundOn = enableSoundRef.current;
        
        if (soundOn && stages.length > 0 && index < stages.length) {
            const currentStage = stages[index];
            const isQA = currentStage.name.includes("質疑"); // Simple check
            
            // Warning sound
            if (!isQA && remaining === currentStage.warningThreshold && remaining > 0) {
                playWarningSound();
            }
            
            // Overtime/Finish sound (at exactly 0)
            if (remaining === 0) {
                if (isQA) {
                    playFinishSound(); // QA finish (3 beeps)
                } else {
                    playOvertimeSound(); // Presentation finish (2 beeps)
                }
            }
        }
      });
      
      unlistenFinished = await listen("timer-finished", async () => {
         // (Handled in timer-update for precise timing with 0)
      });
    };

    setupListeners();

    return () => {
      if (unlistenUpdate) unlistenUpdate();
      if (unlistenFinished) unlistenFinished();
    };
  }, []); 

  // --- Handlers ---
  
  const handleToggleSound = async (checked: boolean) => {
      setEnableSound(checked);
      try {
          const store = await load(PRESETS_FILE);
          await store.set("enableSound", checked);
          await store.save();
      } catch (e) {
          console.error("Failed to save sound setting", e);
      }
  };

  const handleApplyPreset = (preset: Preset) => {
      setPresentationMinutes(preset.pMin);
      setPresentationSeconds(preset.pSec);
      setPresentationWarningSeconds(preset.pWarn);
      setQaMinutes(preset.qMin);
      setQaSeconds(preset.qSec);
      setQaWarningSeconds(preset.qWarn);
      setStatusMessage(`プリセット「${preset.name}」を適用しました。`);
  };
  
  // Preset Manager Handlers
  const handleOpenPresetManager = () => {
      resetPresetManagerForm();
      setActivePresetTab("list");
      setView("preset-manager");
  };

  const resetPresetManagerForm = () => {
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
      setActivePresetTab("create"); // Switch to edit form
  };

  const handleSavePresetManager = async () => {
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

      let newPresets: Preset[];
      if (editingPresetId) {
          newPresets = presets.map(p => p.id === editingPresetId ? newPreset : p);
      } else {
          newPresets = [...presets, newPreset];
      }

      setPresets(newPresets);
      
      try {
          const store = await load(PRESETS_FILE);
          await store.set("presets", newPresets);
          await store.save();
          setStatusMessage(`プリセット「${pmName}」を保存しました。`); // Success message
          resetPresetManagerForm();
          setActivePresetTab("list"); // Return to list after save
      } catch (e) {
          console.error("Failed to save to store", e);
          setStatusMessage("保存に失敗しました。");
      }
  };

  const handleDeletePreset = async (id: string, e?: React.MouseEvent) => {
      if(e) e.stopPropagation();
      const presetToDelete = presets.find(p => p.id === id);
      const name = presetToDelete ? presetToDelete.name : "";

      if (!window.confirm(`プリセット「${name}」を削除してもよろしいですか？`)) return;
      
      const newPresets = presets.filter(p => p.id !== id);
      setPresets(newPresets);
      
      try {
          const store = await load(PRESETS_FILE);
          await store.set("presets", newPresets);
          await store.save();
          setStatusMessage(`プリセット「${name}」を削除しました。`); // Success message
          if (editingPresetId === id) {
              resetPresetManagerForm();
              setActivePresetTab("list");
          }
      } catch (e) {
          console.error("Failed to save to store", e);
          setStatusMessage("削除に失敗しました。");
      }
  };

  const handleBackToSetup = () => {
      setView("setup");
      setStatusMessage("");
  };


  const formatTime = (totalSeconds: number) => {
    const absSeconds = Math.abs(totalSeconds);
    const minutes = Math.floor(absSeconds / 60);
    const seconds = absSeconds % 60;
    return {
      minutes: String(minutes).padStart(2, "0"),
      seconds: String(seconds).padStart(2, "0"),
    };
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
      setStatusMessage("タイマーを設定してください。");
      return;
    }

    setTimerStages(stages);
    setCurrentStageIndex(0);
    setIsTimerRunning(false);
    setCurrentRemainingSeconds(stages[0].duration);
    setStatusMessage("タイマーを開始してください。");
    
    invoke("reset_timer").catch(console.error);
    
    setView("timer");
  };

  const handleGoToSetupView = async () => {
    await handleStopTimer();
    setCurrentStageIndex(0);
    setIsTimerRunning(false);
    setCurrentRemainingSeconds(0);
    setStatusMessage("");
    setView("setup");
  };

  const handleStartTimer = async (durationSecondsOverride?: number) => {
    if (isTimerRunning) return;
    
    if (currentStageIndex >= timerStages.length) {
       setStatusMessage("すべてのタイマーが完了しました。");
       return;
    }

    const duration = durationSecondsOverride !== undefined ? durationSecondsOverride : currentRemainingSeconds;
    const currentStage = timerStages[currentStageIndex];
    setIsTimerRunning(true);
    setStatusMessage(`${currentStage.name}を開始しました。`);

    try {
      await invoke("start_timer", { durationSeconds: duration });
    } catch (error) {
      console.error("Failed to start timer:", error);
      setStatusMessage(`エラー: ${error}`);
      setIsTimerRunning(false);
    }
  };

  const handleStopTimer = async () => {
    if (!isTimerRunning) return;
    setIsTimerRunning(false);
    try {
      await invoke("stop_timer");
      setStatusMessage("タイマーが停止されました。");
    } catch (error) {
      console.error("Failed to stop timer:", error);
      setStatusMessage(`エラー: ${error}`);
    }
  };

  const handleResetTimer = async () => {
    try {
      await invoke("reset_timer");
      if (timerStages.length > 0 && currentStageIndex < timerStages.length) {
        const initialDuration = timerStages[currentStageIndex].duration;
        setCurrentRemainingSeconds(initialDuration);
      } else {
        setCurrentRemainingSeconds(0);
      }
      setIsTimerRunning(false);
      setStatusMessage("現在のステージをリセットしました。");
    } catch (error) {
      console.error("Failed to reset timer:", error);
      setStatusMessage(`エラー: ${error}`);
    }
  };
  
  const handleNextStage = async () => {
    await handleStopTimer();
    
    const nextIndex = currentStageIndex + 1;
    if (nextIndex < timerStages.length) {
        let nextDuration = timerStages[nextIndex].duration;
        
        if (deductOvertime && currentRemainingSeconds < 0) {
            const overtime = Math.abs(currentRemainingSeconds);
            nextDuration = Math.max(0, nextDuration - overtime);
            setStatusMessage(`前回の超過 (${overtime}秒) を差し引きました。`);
        } else {
            setStatusMessage(`次のステージ: ${timerStages[nextIndex].name}`);
        }
        
        setCurrentStageIndex(nextIndex);
        setCurrentRemainingSeconds(nextDuration);
        
        await handleStartTimer(nextDuration);
    } else {
        // All stages finished, return to setup view
        await handleGoToSetupView();
        setStatusMessage("すべてのステージが終了しました！");
    }
  };

  // --- Render ---
  const { minutes: displayMinutes, seconds: displaySeconds } = formatTime(currentRemainingSeconds);
  
  const currentStage = timerStages[currentStageIndex];
  const isOvertime = currentRemainingSeconds < 0;
  const threshold = currentStage?.warningThreshold || 60;
  const isWarning = !isOvertime && currentRemainingSeconds <= threshold && currentRemainingSeconds > 0;
  
  let timerClass = "timer-display";
  if (isOvertime) timerClass += " overtime";
  else if (isWarning) timerClass += " warning";

  const currentStageName = currentStage?.name || (currentStageIndex >= timerStages.length ? "完了" : "準備中");

  if (view === "preset-manager") {
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
                    onClick={() => { resetPresetManagerForm(); setActivePresetTab('create'); }}
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
                          <button onClick={handleSavePresetManager} className="save-btn">保存</button>
                          <button onClick={resetPresetManagerForm} className="cancel-btn">クリア</button>
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
                                  <button className="delete-icon" onClick={(e) => handleDeletePreset(p.id, e)}>×</button>
                              </li>
                          ))}
                      </ul>
                  </div>
              )}

              <p className="manager-status-message">{statusMessage}</p>

              <button onClick={handleBackToSetup} className="back-btn">設定画面に戻る</button>
          </div>
      );
  }

  return (
    <div className="container">
      {view === "setup" ? (
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
              <button onClick={handleOpenPresetManager} className="manage-presets-link">
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
                    onChange={(e) => handleToggleSound(e.target.checked)}
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

          <p id="setup-status-message">{statusMessage}</p>
        </div>
      ) : (
        <div id="timer-view">
          <div id="timer-stage-label" className="stage-label">
            {currentStageName}
          </div>
          <div className={timerClass}>
            <span id="timer-minutes">{displayMinutes}</span>:
            <span id="timer-seconds">{displaySeconds}</span>
          </div>

          <div className="controls">
            {currentStageIndex < timerStages.length && (
                <>
                <button id="start-timer" onClick={() => handleStartTimer()} disabled={isTimerRunning}>
                  {isTimerRunning ? "計測中" : "開始"}
                </button>
                <button id="stop-timer" onClick={handleStopTimer} disabled={!isTimerRunning}>
                  停止
                </button>
                <button id="reset-timer" onClick={handleResetTimer}>
                  リセット
                </button>
                </>
            )}
            
             <button id="next-stage" onClick={handleNextStage}>
                {currentStageIndex < timerStages.length - 1 ? "次のステージへ" : "終了する"}
            </button>
          </div>

          <p id="status-message">{statusMessage}</p>
        </div>
      )}
    </div>
  );
}

export default App;