import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TimerStage } from "../types";
import { playWarningSound, playOvertimeSound, playFinishSound } from "../utils/audio";

export function useTimer(enableSound: boolean) {
  const [timerStages, setTimerStages] = useState<TimerStage[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [currentRemainingSeconds, setCurrentRemainingSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  // Refs for event listeners to access latest state
  const timerStagesRef = useRef<TimerStage[]>([]);
  const currentStageIndexRef = useRef(0);
  const enableSoundRef = useRef(enableSound);

  useEffect(() => {
    timerStagesRef.current = timerStages;
  }, [timerStages]);

  useEffect(() => {
    currentStageIndexRef.current = currentStageIndex;
  }, [currentStageIndex]);

  useEffect(() => {
    enableSoundRef.current = enableSound;
  }, [enableSound]);

  useEffect(() => {
    let unlistenUpdate: (() => void) | undefined;
    
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
            const isQA = currentStage.name.includes("質疑"); 
            
            // Warning sound
            if (!isQA && remaining === currentStage.warningThreshold && remaining > 0) {
                playWarningSound();
            }
            
            // Overtime/Finish sound (at exactly 0)
            if (remaining === 0) {
                if (isQA) {
                    playFinishSound(); // QA finish
                } else {
                    playOvertimeSound(); // Presentation finish
                }
            }
        }
      });
    };

    setupListeners();

    return () => {
      if (unlistenUpdate) unlistenUpdate();
    };
  }, []);

  const setupTimer = async (stages: TimerStage[]) => {
      setTimerStages(stages);
      setCurrentStageIndex(0);
      setIsTimerRunning(false);
      if (stages.length > 0) {
          setCurrentRemainingSeconds(stages[0].duration);
      }
      try {
        await invoke("reset_timer");
      } catch (error) {
        console.error("Failed to reset timer backend:", error);
      }
  };

  const startTimer = async (durationSecondsOverride?: number) => {
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

  const stopTimer = async () => {
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

  const resetTimer = async () => {
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

  // Returns true if there is a next stage, false if finished
  const nextStage = async (deductOvertime: boolean): Promise<boolean> => {
      await stopTimer();

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
          
          // Automatically start next stage? App.tsx logic did this.
          // Let's invoke start here to match behavior.
          await startTimer(nextDuration);
          return true;
      } else {
          return false;
      }
  };

  return {
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
  };
}
