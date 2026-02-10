import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { TimerStage, SoundType } from "../types";
import { playWarningSound, playOvertimeSound, playFinishSound } from "../utils/audio";

export function useTimer(enableSound: boolean, selectedSoundType: SoundType = "standard", isMirror: boolean = false) {
  const [timerStages, setTimerStages] = useState<TimerStage[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [currentRemainingSeconds, setCurrentRemainingSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const timerStagesRef = useRef<TimerStage[]>([]);
  const currentStageIndexRef = useRef(0);
  const enableSoundRef = useRef(enableSound);
  const selectedSoundTypeRef = useRef(selectedSoundType);

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
    selectedSoundTypeRef.current = selectedSoundType;
  }, [selectedSoundType]);

  // --- Sync Logic ---
  useEffect(() => {
    let unlistenUpdate: (() => void) | undefined;
    let unlistenSync: (() => void) | undefined;
    
    const setupListeners = async () => {
      unlistenUpdate = await listen<number>("timer-update", (event) => {
        const remaining = event.payload;
        setCurrentRemainingSeconds(remaining);
        
        if (!isMirror) {
            const stages = timerStagesRef.current;
            const index = currentStageIndexRef.current;
            const soundOn = enableSoundRef.current;
            const soundType = selectedSoundTypeRef.current;
            
            if (soundOn && stages.length > 0 && index < stages.length) {
                const currentStage = stages[index];
                const isQA = currentStage.name.includes("質疑"); 
                if (!isQA && remaining === currentStage.warningThreshold && remaining > 0) {
                    playWarningSound(soundType);
                }
                if (remaining === 0) {
                    if (isQA) playFinishSound(soundType);
                    else playOvertimeSound(soundType);
                }
            }
        }
      });

      unlistenSync = await listen<any>("timer-state-sync", (event) => {
        const { stages, index, running, remaining, message } = event.payload;
        if (stages !== undefined) setTimerStages(stages);
        if (index !== undefined) setCurrentStageIndex(index);
        if (running !== undefined) setIsTimerRunning(running);
        if (remaining !== undefined) setCurrentRemainingSeconds(remaining);
        if (message !== undefined) setStatusMessage(message);
      });

      if (isMirror) {
          emit("request-timer-sync");
      }
    };

    setupListeners();

    return () => {
      if (unlistenUpdate) unlistenUpdate();
      if (unlistenSync) unlistenSync();
    };
  }, [isMirror]);

  const syncState = (overrides?: any) => {
    if (isMirror) return;
    emit("timer-state-sync", {
        stages: timerStages,
        index: currentStageIndex,
        running: isTimerRunning,
        remaining: currentRemainingSeconds,
        message: statusMessage,
        ...overrides
    });
  };

  useEffect(() => {
    if (isMirror) return;
    let unlistenRequest: (() => void) | undefined;
    const setup = async () => {
        unlistenRequest = await listen("request-timer-sync", () => syncState());
    };
    setup();
    return () => { if (unlistenRequest) unlistenRequest(); };
  }, [isMirror, timerStages, currentStageIndex, isTimerRunning, currentRemainingSeconds, statusMessage]);

  const setupTimer = async (stages: TimerStage[]) => {
      const initialRemaining = stages.length > 0 ? stages[0].duration : 0;
      
      setTimerStages(stages);
      setCurrentStageIndex(0);
      setIsTimerRunning(false);
      setCurrentRemainingSeconds(initialRemaining);
      const msg = "タイマーを開始してください。";
      setStatusMessage(msg);
      
      // 同期イベントを投げる
      syncState({ 
          stages, 
          index: 0, 
          running: false, 
          remaining: initialRemaining,
          message: msg
      });

      try {
        await invoke("reset_timer");
      } catch (error) {
        console.error("Failed to reset timer backend:", error);
      }
  };

  const startTimer = async (durationSecondsOverride?: number, indexOverride?: number) => {
    if (isTimerRunning && durationSecondsOverride === undefined) return;
    
    const index = indexOverride !== undefined ? indexOverride : currentStageIndex;
    if (index >= timerStages.length) return;

    const duration = durationSecondsOverride !== undefined ? durationSecondsOverride : currentRemainingSeconds;
    const currentStage = timerStages[index];
    
    setIsTimerRunning(true);
    const msg = `${currentStage.name}を開始しました。`;
    setStatusMessage(msg);

    syncState({ 
        running: true, 
        message: msg, 
        remaining: duration,
        index: index // 明示的にインデックスを送る
    });

    try {
      await invoke("start_timer", { durationSeconds: duration });
    } catch (error) {
      console.error("Failed to start timer:", error);
      setIsTimerRunning(false);
      syncState({ running: false });
    }
  };

  const stopTimer = async () => {
    if (!isTimerRunning) return;
    setIsTimerRunning(false);
    setStatusMessage("タイマーが停止されました。");
    syncState({ running: false, message: "タイマーが停止されました。" });
    try {
      await invoke("stop_timer");
    } catch (error) {
      console.error("Failed to stop timer:", error);
    }
  };

  const resetTimer = async () => {
    try {
      await invoke("reset_timer");
      let initialDuration = 0;
      if (timerStages.length > 0 && currentStageIndex < timerStages.length) {
        initialDuration = timerStages[currentStageIndex].duration;
      }
      setCurrentRemainingSeconds(initialDuration);
      setIsTimerRunning(false);
      setStatusMessage("現在のステージをリセットしました。");
      syncState({ running: false, remaining: initialDuration, message: "現在のステージをリセットしました。" });
    } catch (error) {
      console.error("Failed to reset timer:", error);
    }
  };

  const nextStage = async (deductOvertime: boolean): Promise<boolean> => {
      await stopTimer();

      const nextIndex = currentStageIndex + 1;
      if (nextIndex < timerStages.length) {
          let nextDuration = timerStages[nextIndex].duration;
          let msg = `次のステージ: ${timerStages[nextIndex].name}`;
          
          if (deductOvertime && currentRemainingSeconds < 0) {
              const overtime = Math.abs(currentRemainingSeconds);
              nextDuration = Math.max(0, nextDuration - overtime);
              msg = `前回の超過 (${overtime}秒) を差し引きました。`;
          }
          
          setCurrentStageIndex(nextIndex);
          setCurrentRemainingSeconds(nextDuration);
          setStatusMessage(msg);
          
          await startTimer(nextDuration, nextIndex);
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
