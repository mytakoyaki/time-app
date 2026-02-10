import { useState, useEffect } from "react";
import { usePresets } from "./hooks/usePresets";
import { useTimer } from "./hooks/useTimer";
import { SetupView } from "./components/SetupView";
import { TimerView } from "./components/TimerView";
import { PresetManager } from "./components/PresetManager";
import { TimerStage } from "./types";

function App() {
  const [view, setView] = useState<"setup" | "timer" | "preset-manager">("setup");
  const [deductOvertime, setDeductOvertime] = useState(true);
  
  const { presets, enableSound, selectedSoundType, savePresets, saveEnableSound, saveSelectedSoundType } = usePresets();
  const { 
      timerStages, 
      currentStageIndex, 
      isTimerRunning, 
      currentRemainingSeconds, 
      statusMessage, 
      setStatusMessage,
      setupTimer, 
      startTimer, 
      stopTimer, 
      resetTimer, 
      nextStage 
  } = useTimer(enableSound, selectedSoundType);

  const handleStartSetup = (stages: TimerStage[]) => {
      setupTimer(stages);
      setView("timer");
  };

  const handleNextStageWrapper = async () => {
      const hasNext = await nextStage(deductOvertime);
      if (!hasNext) {
          setView("setup");
          setStatusMessage("すべてのステージが終了しました！");
      }
  };
  
  const handleClosePresetManager = () => {
      setView("setup");
      setStatusMessage("");
  }

  // --- Keyboard Shortcuts (2A) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // フォーム入力中はショートカットを無効化
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "l":
        case "L":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // dispatch custom event to toggle fullscreen in TimerView
            window.dispatchEvent(new CustomEvent("toggle-fullscreen"));
          }
          break;
        case " ": // Space: Start/Stop
          e.preventDefault();
          if (view === "timer") {
            if (isTimerRunning) stopTimer();
            else startTimer();
          } else if (view === "setup") {
            // Setup画面でSpaceを押すと開始（利便性のため）
            const startBtn = document.getElementById("go-to-timer-view");
            startBtn?.click();
          }
          break;
        case "Enter": // Enter: Next Stage
          if (view === "timer") {
            handleNextStageWrapper();
          }
          break;
        case "r":
        case "R": // R: Reset
          if (view === "timer") {
            resetTimer();
          }
          break;
        case "Escape": // Esc: Back to setup
          if (view === "timer") {
            setView("setup");
            stopTimer();
          } else if (view === "preset-manager") {
            handleClosePresetManager();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, isTimerRunning, stopTimer, startTimer, handleNextStageWrapper]);

  if (view === "preset-manager") {
      return (
          <PresetManager
              presets={presets}
              onSave={async (p) => {
                  const existingIndex = presets.findIndex(exist => exist.id === p.id);
                  let newPresets;
                  if (existingIndex >= 0) {
                      newPresets = [...presets];
                      newPresets[existingIndex] = p;
                  } else {
                      newPresets = [...presets, p];
                  }
                  await savePresets(newPresets);
              }}
              onDelete={async (id) => {
                  const newPresets = presets.filter(p => p.id !== id);
                  await savePresets(newPresets);
              }}
              onClose={handleClosePresetManager}
          />
      );
  }

  return (
    <div className="container">
      {view === "setup" ? (
        <SetupView
            presets={presets}
            onOpenPresetManager={() => setView("preset-manager")}
            onStartTimer={handleStartSetup}
            enableSound={enableSound}
            onToggleSound={saveEnableSound}
            selectedSoundType={selectedSoundType}
            onSoundTypeChange={saveSelectedSoundType}
            deductOvertime={deductOvertime}
            setDeductOvertime={setDeductOvertime}
            statusMessage={statusMessage}
        />
      ) : (
        <TimerView
            timerStages={timerStages}
            currentStageIndex={currentStageIndex}
            isTimerRunning={isTimerRunning}
            currentRemainingSeconds={currentRemainingSeconds}
            statusMessage={statusMessage}
            onStart={() => startTimer()}
            onStop={stopTimer}
            onReset={resetTimer}
            onNext={handleNextStageWrapper}
        />
      )}
    </div>
  );
}

export default App;
