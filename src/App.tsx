import { useState, useEffect } from "react";
import { usePresets } from "./hooks/usePresets";
import { useTimer } from "./hooks/useTimer";
import { useMirrorWindow } from "./hooks/useMirrorWindow";
import { SetupView } from "./components/SetupView";
import { TimerView } from "./components/TimerView";
import { SettingsView } from "./components/SettingsView";
import { TimerStage } from "./types";

function App() {
  const isMirrorMode = new URLSearchParams(window.location.search).get("mode") === "mirror";

  const [view, setView] = useState<"setup" | "timer" | "settings">("setup");
  const [deductOvertime, setDeductOvertime] = useState(true);
  
  const { 
      presets, enableSound, selectedSoundType, displaySettings,
      savePresets, saveEnableSound, saveSelectedSoundType, saveDisplaySettings
  } = usePresets();

  const { 
      timerStages, currentStageIndex, isTimerRunning, currentRemainingSeconds, 
      statusMessage, setStatusMessage,
      setupTimer, startTimer, stopTimer, resetTimer, nextStage 
  } = useTimer(enableSound, selectedSoundType, isMirrorMode);

  const { isMirrorOpen, openMirrorWindow, closeMirrorWindow } = useMirrorWindow();

  useEffect(() => {
    if (isMirrorMode) setView("timer");
  }, [isMirrorMode]);

  useEffect(() => {
    if (isMirrorMode) return;
    const handleUnload = () => { if (isMirrorOpen) closeMirrorWindow(); };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [isMirrorOpen, isMirrorMode]);

  const handleStartSetup = (stages: TimerStage[]) => {
      setupTimer(stages);
      setView("timer");
  };

  const handleStartMirror = async (stages: TimerStage[]) => {
      await openMirrorWindow(displaySettings);
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

  useEffect(() => {
    if (isMirrorMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ": if (view === "timer") { e.preventDefault(); isTimerRunning ? stopTimer() : startTimer(); } break;
        case "Enter": if (view === "timer") { e.preventDefault(); handleNextStageWrapper(); } break;
        case "r":
        case "R": if (view === "timer") resetTimer(); break;
        case "Escape":
          if (view === "timer") {
            setView("setup");
            stopTimer();
            if (isMirrorOpen) closeMirrorWindow();
          } else if (view === "settings") {
            setView("setup");
          }
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, isTimerRunning, stopTimer, startTimer, handleNextStageWrapper, isMirrorMode, isMirrorOpen]);

  if (view === "settings") {
      return (
          <SettingsView
              presets={presets}
              onSavePreset={async (p) => {
                  const idx = presets.findIndex(exist => exist.id === p.id);
                  const newPresets = idx >= 0 ? [...presets] : [...presets, p];
                  if(idx >= 0) newPresets[idx] = p;
                  await savePresets(newPresets);
              }}
              onDeletePreset={async (id) => await savePresets(presets.filter(p => p.id !== id))}
              enableSound={enableSound}
              onToggleSound={saveEnableSound}
              selectedSoundType={selectedSoundType}
              onSoundTypeChange={saveSelectedSoundType}
              displaySettings={displaySettings}
              onDisplaySettingsChange={saveDisplaySettings}
              deductOvertime={deductOvertime}
              onDeductOvertimeChange={setDeductOvertime}
              onClose={() => setView("setup")}
          />
      );
  }

  if (isMirrorMode) {
    return (
        <div className="container">
            <TimerView
                timerStages={timerStages} currentStageIndex={currentStageIndex}
                isTimerRunning={isTimerRunning} currentRemainingSeconds={currentRemainingSeconds}
                statusMessage={statusMessage} onStart={() => {}} onStop={() => {}}
                onReset={() => {}} onNext={() => {}} isMirror={true}
            />
        </div>
    );
  }

  return (
    <div className="container">
      {view === "setup" ? (
        <SetupView
            presets={presets}
            onOpenSettings={() => setView("settings")}
            onStartTimer={handleStartSetup}
            onStartWithMirror={handleStartMirror}
            statusMessage={statusMessage}
        />
      ) : (
        <TimerView
            timerStages={timerStages} currentStageIndex={currentStageIndex}
            isTimerRunning={isTimerRunning} currentRemainingSeconds={currentRemainingSeconds}
            statusMessage={statusMessage} onStart={() => startTimer()} onStop={stopTimer}
            onReset={resetTimer} onNext={handleNextStageWrapper} isMirror={false}
        />
      )}
    </div>
  );
}

export default App;
