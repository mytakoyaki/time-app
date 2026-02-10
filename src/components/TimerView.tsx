import { useState, useEffect } from "react";
import { TimerStage } from "../types";

interface TimerViewProps {
  timerStages: TimerStage[];
  currentStageIndex: number;
  isTimerRunning: boolean;
  currentRemainingSeconds: number;
  statusMessage: string;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onNext: () => void;
  isMirror?: boolean;
}

export function TimerView({
  timerStages,
  currentStageIndex,
  isTimerRunning,
  currentRemainingSeconds,
  statusMessage,
  onStart,
  onStop,
  onReset,
  onNext,
  isMirror = false
}: TimerViewProps) {
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  // ミラーモード（外部ディスプレイ用）の場合は、常にプレゼンモード（全画面レイアウト）にする
  const effectivePresentMode = isPresentationMode || isMirror;

  useEffect(() => {
    const handleToggle = () => setIsPresentationMode(prev => !prev);
    window.addEventListener("toggle-presentation-mode", handleToggle);
    return () => window.removeEventListener("toggle-presentation-mode", handleToggle);
  }, []);

  const togglePresentMode = () => {
      setIsPresentationMode(prev => !prev);
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

  const { minutes: displayMinutes, seconds: displaySeconds } = formatTime(currentRemainingSeconds);
  
  const currentStage = timerStages[currentStageIndex];
  const isOvertime = currentRemainingSeconds < 0;
  const threshold = currentStage?.warningThreshold || 60;
  const isWarning = !isOvertime && currentRemainingSeconds <= threshold && currentRemainingSeconds > 0;
  
  let timerClass = "timer-display";
  if (isOvertime) timerClass += " overtime";
  else if (isWarning) timerClass += " warning";
  if (effectivePresentMode) timerClass += " present-mode";

  const currentStageName = currentStage?.name || (currentStageIndex >= timerStages.length ? "完了" : "準備中");

  return (
    <div id="timer-view" className={effectivePresentMode ? "present-container" : ""}>
      <div id="timer-stage-label" className={`stage-label ${effectivePresentMode ? "present-stage" : ""}`}>
        {currentStageName}
      </div>
      <div className={timerClass}>
        <span id="timer-minutes">{displayMinutes}</span>:
        <span id="timer-seconds">{displaySeconds}</span>
      </div>

      {!effectivePresentMode && (
          <div className="controls">
            {currentStageIndex < timerStages.length ? (
                <>
                <button id="start-timer" onClick={onStart} disabled={isTimerRunning}>
                  {isTimerRunning ? "計測中" : "開始"}
                </button>
                <button id="stop-timer" onClick={onStop} disabled={!isTimerRunning}>
                  停止
                </button>
                <button id="reset-timer" onClick={onReset}>
                  リセット
                </button>
                </>
            ) : null}
            
             <button id="next-stage" onClick={onNext}>
                {currentStageIndex < timerStages.length - 1 ? "次のステージへ" : "終了する"}
            </button>
            <button id="toggle-present" onClick={togglePresentMode} style={{borderColor: "#646cff"}}>
                プレゼンモード
            </button>
          </div>
      )}

      {effectivePresentMode && !isMirror && (
          <div className="present-hint">
              Ctrl + L または Esc で戻ります
          </div>
      )}

      {!effectivePresentMode && (
          <p id="status-message">{statusMessage}</p>
      )}
    </div>
  );
}
