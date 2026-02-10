import { useState, useEffect } from "react";
import { usePresets } from "./hooks/usePresets";
import { useTimer } from "./hooks/useTimer";
import { useMirrorWindow } from "./hooks/useMirrorWindow";
import { SetupView } from "./components/SetupView";
import { TimerView } from "./components/TimerView";
import { PresetManager } from "./components/PresetManager";
import { TimerStage } from "./types";

function App() {
  const isMirrorMode = new URLSearchParams(window.location.search).get("mode") === "mirror";

  const [view, setView] = useState<"setup" | "timer" | "preset-manager">("setup");
  const [deductOvertime, setDeductOvertime] = useState(true);
  
  const { 
      presets, 
      enableSound, 
      selectedSoundType, 
      displaySettings,
      savePresets, 
      saveEnableSound, 
      saveSelectedSoundType,
      saveDisplaySettings
  } = usePresets();

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
  } = useTimer(enableSound, selectedSoundType, isMirrorMode);

  const { isMirrorOpen, openMirrorWindow, closeMirrorWindow } = useMirrorWindow();

  useEffect(() => {
    if (isMirrorMode) {
      setView("timer");
    }
  }, [isMirrorMode]);

  // クリーンアップ：メインウィンドウが閉じられたらミラーも閉じる
  useEffect(() => {
    if (isMirrorMode) return;
    const handleUnload = () => {
        if (isMirrorOpen) closeMirrorWindow();
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [isMirrorOpen, isMirrorMode]);

  const handleStartSetup = (stages: TimerStage[]) => {
      setupTimer(stages);
      setView("timer");
  };

  const handleStartMirror = async (stages: TimerStage[]) => {
      // ウィンドウを先に開く
      await openMirrorWindow(displaySettings);
      // その後タイマーをセットアップ
      await setupTimer(stages);
      setView("timer");
  };

  const handleNextStageWrapper = async () => {
      const hasNext = await nextStage(deductOvertime);
      if (!hasNext) {
          if (isMirrorMode) {
              setStatusMessage("終了しました");
          } else {
              setView("setup");
              setStatusMessage("すべてのステージが終了しました！");
              if (isMirrorOpen) closeMirrorWindow();
          }
      }
  };
  
  const handleClosePresetManager = () => {
      setView("setup");
      setStatusMessage("");
  }

  useEffect(() => {
    if (isMirrorMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "l":
        case "L":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("toggle-presentation-mode"));
          }
          break;
        case " ":
          if (view === "timer") {
            e.preventDefault();
            if (isTimerRunning) stopTimer();
            else startTimer();
          }
          break;
        case "Enter":
          if (view === "timer") {
            e.preventDefault();
            handleNextStageWrapper();
          } else if (view === "setup") {
            const startBtn = document.getElementById("go-to-timer-view");
            startBtn?.click();
          }
          break;
        case "r":
        case "R":
          if (view === "timer") {
            resetTimer();
          }
          break;
        case "Escape":
          if (view === "timer") {
            const timerView = document.getElementById("timer-view");
            if (timerView?.classList.contains("present-container")) {
                window.dispatchEvent(new CustomEvent("toggle-presentation-mode"));
            } else {
                setView("setup");
                stopTimer();
                if (isMirrorOpen) closeMirrorWindow();
            }
          } else if (view === "preset-manager") {
            handleClosePresetManager();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, isTimerRunning, stopTimer, startTimer, handleNextStageWrapper, isMirrorMode, isMirrorOpen]);

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

  if (isMirrorMode) {
    return (
        <div className="container">
            <TimerView
                timerStages={timerStages}
                currentStageIndex={currentStageIndex}
                isTimerRunning={isTimerRunning}
                currentRemainingSeconds={currentRemainingSeconds}
                statusMessage={statusMessage}
                onStart={() => {}}
                onStop={() => {}}
                onReset={() => {}}
                onNext={() => {}}
                isMirror={true}
            />
        </div>
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
            displaySettings={displaySettings}
            onDisplaySettingsChange={saveDisplaySettings}
            deductOvertime={deductOvertime}
            setDeductOvertime={setDeductOvertime}
            statusMessage={statusMessage}
            isMirrorOpen={isMirrorOpen}
            onStartWithMirror={handleStartMirror}
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
            isMirror={false}
        />
      )}
    </div>
  );
}

export default App;
