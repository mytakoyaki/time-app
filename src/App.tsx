import { useState } from "react";
import { usePresets } from "./hooks/usePresets";
import { useTimer } from "./hooks/useTimer";
import { SetupView } from "./components/SetupView";
import { TimerView } from "./components/TimerView";
import { PresetManager } from "./components/PresetManager";
import { TimerStage } from "./types";

function App() {
  const [view, setView] = useState<"setup" | "timer" | "preset-manager">("setup");
  const [deductOvertime, setDeductOvertime] = useState(true);
  
  const { presets, enableSound, savePresets, saveEnableSound } = usePresets();
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
  } = useTimer(enableSound);

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
