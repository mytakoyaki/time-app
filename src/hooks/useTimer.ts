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
      // 残り秒数の更新（Rust側から）
      unlistenUpdate = await listen<number>("timer-update", (event) => {
        const remaining = event.payload;
        setCurrentRemainingSeconds(remaining);
        
        // 音声再生（ミラーウィンドウでは鳴らさない）
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

      // 状態の同期（他方のウィンドウから）
      unlistenSync = await listen<any>("timer-state-sync", (event) => {
        const { stages, index, running, remaining, message } = event.payload;
        setTimerStages(stages);
        setCurrentStageIndex(index);
        setIsTimerRunning(running);
        setCurrentRemainingSeconds(remaining);
        if (message) setStatusMessage(message);
      });

      // ミラーウィンドウが起動したときに最新の状態をリクエストする
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

  // メインウィンドウでのみ動作する：状態を他方のウィンドウに送る
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

  // メインウィンドウでのみ動作する：リクエストに応じて現在の状態を送る
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
      setTimerStages(stages);
      setCurrentStageIndex(0);
      setIsTimerRunning(false);
      const initialRemaining = stages.length > 0 ? stages[0].duration : 0;
      setCurrentRemainingSeconds(initialRemaining);
      
      syncState({ stages, index: 0, running: false, remaining: initialRemaining });

      try {
        await invoke("reset_timer");
      } catch (error) {
        console.error("Failed to reset timer backend:", error);
      }
  };

  const startTimer = async (durationSecondsOverride?: number) => {
    if (isTimerRunning) return;
    if (currentStageIndex >= timerStages.length) return;

    const duration = durationSecondsOverride !== undefined ? durationSecondsOverride : currentRemainingSeconds;
    setIsTimerRunning(true);
    const msg = `${timerStages[currentStageIndex].name}を開始しました。`;
    setStatusMessage(msg);

    syncState({ running: true, message: msg, remaining: duration });

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
          
          // この時点では isTimerRunning は false になっているので、
          // startTimer 内で syncState が呼ばれる
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