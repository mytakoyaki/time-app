import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface TimerStage {
  name: string;
  duration: number; // in seconds
}

function App() {
  // --- State ---
  // View
  const [view, setView] = useState<"setup" | "timer">("setup");

  // Inputs
  const [presentationMinutes, setPresentationMinutes] = useState(5);
  const [presentationSeconds, setPresentationSeconds] = useState(0);
  const [qaMinutes, setQaMinutes] = useState(3);
  const [qaSeconds, setQaSeconds] = useState(0);
  
  // New Settings
  const [warningSeconds, setWarningSeconds] = useState(60); // Default 1 minute
  const [deductOvertime, setDeductOvertime] = useState(true);

  // Timer Logic
  const [timerStages, setTimerStages] = useState<TimerStage[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [currentRemainingSeconds, setCurrentRemainingSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  // Refs for accessing latest state in event listeners/callbacks
  const timerStagesRef = useRef<TimerStage[]>([]);
  const currentStageIndexRef = useRef(0);
  const currentRemainingSecondsRef = useRef(0);
  const isTimerRunningRef = useRef(false);

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


  // --- Event Listeners ---
  useEffect(() => {
    let unlistenUpdate: (() => void) | undefined;
    let unlistenFinished: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenUpdate = await listen<number>("timer-update", (event) => {
        setCurrentRemainingSeconds(event.payload);
      });
      
      // 今回の要件変更により、0になっても停止しないため、timer-finishedでの自動停止は行わない。
      // ただし、0になった瞬間の通知として利用可能。
      unlistenFinished = await listen("timer-finished", async () => {
         // 必要ならここで通知音などを鳴らす
         setStatusMessage("時間経過！超過時間を計測中...");
      });
    };

    setupListeners();

    return () => {
      if (unlistenUpdate) unlistenUpdate();
      if (unlistenFinished) unlistenFinished();
    };
  }, []); 

  // --- Handlers ---

  const formatTime = (totalSeconds: number) => {
    // Overtime sign removed per user request
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
    const stages: TimerStage[] = [
      { name: "発表", duration: pSec },
      { name: "質疑応答", duration: qSec },
    ].filter(s => s.duration > 0);

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
      // 現在のステージの初期値に戻す
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
    // まず現在のタイマーを止める
    await handleStopTimer();
    
    const nextIndex = currentStageIndex + 1;
    if (nextIndex < timerStages.length) {
        let nextDuration = timerStages[nextIndex].duration;
        
        // 超過分の精算ロジック
        if (deductOvertime && currentRemainingSeconds < 0) {
            const overtime = Math.abs(currentRemainingSeconds);
            nextDuration = Math.max(0, nextDuration - overtime);
            setStatusMessage(`前回の超過 (${overtime}秒) を差し引きました。`);
        } else {
            setStatusMessage(`次のステージ: ${timerStages[nextIndex].name}`);
        }
        
        setCurrentStageIndex(nextIndex);
        setCurrentRemainingSeconds(nextDuration);
        
        // 即座に次のステージを開始
        await handleStartTimer(nextDuration);
    } else {
        setStatusMessage("すべてのステージが終了しました！");
        setCurrentStageIndex(nextIndex); // 範囲外インデックスにして完了扱いにする
    }
  };

  // --- Render ---
  const { minutes: displayMinutes, seconds: displaySeconds } = formatTime(currentRemainingSeconds);
  
  // Determine CSS classes
  const isOvertime = currentRemainingSeconds < 0;
  const isWarning = !isOvertime && currentRemainingSeconds <= warningSeconds && currentRemainingSeconds > 0;
  
  let timerClass = "timer-display";
  if (isOvertime) timerClass += " overtime";
  else if (isWarning) timerClass += " warning";

  const currentStageName = timerStages[currentStageIndex]?.name || (currentStageIndex >= timerStages.length ? "完了" : "準備中");

  return (
    <div className="container">
      {view === "setup" ? (
        <div id="setup-view">
          <h1>発表時間管理 - 設定</h1>
          <div className="timer-setup-grid">
            <div className="timer-setup">
              <label htmlFor="minutes-presentation">発表時間:</label>
              <div>
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
            <div className="timer-setup">
              <label htmlFor="minutes-qa">質疑応答:</label>
              <div>
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
          </div>
          
          <div className="timer-options">
            <div className="timer-option-row">
                <label htmlFor="warning-seconds">警告開始 (残り時間):</label>
                <input 
                    type="number" 
                    id="warning-seconds"
                    value={warningSeconds}
                    onChange={(e) => setWarningSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{width: "50px", textAlign: "center"}}
                />
                <span>秒</span>
            </div>
            <div className="timer-option-row">
                <input 
                    type="checkbox" 
                    id="deduct-overtime"
                    checked={deductOvertime}
                    onChange={(e) => setDeductOvertime(e.target.checked)}
                />
                <label htmlFor="deduct-overtime">発表の超過分を質疑応答から引く</label>
            </div>
          </div>

          <button id="go-to-timer-view" onClick={handleGoToTimerView}>
            タイマー表示へ
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
          <button id="go-to-setup-view" onClick={handleGoToSetupView} style={{marginTop: "2rem"}}>
            設定に戻る
          </button>
        </div>
      )}
    </div>
  );
}

export default App;