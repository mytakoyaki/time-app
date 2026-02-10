import { useState, useEffect, useRef, useCallback } from "react";
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

  // 最新の値を常に保持するための Ref (同期送信で使用)
  const timerStagesRef = useRef<TimerStage[]>([]);
  const currentStageIndexRef = useRef(0);
  const isTimerRunningRef = useRef(false);
  const currentRemainingSecondsRef = useRef(0);
  const statusMessageRef = useRef("");
  const enableSoundRef = useRef(enableSound);
  const selectedSoundTypeRef = useRef(selectedSoundType);

  // ステートが変わるたびに Ref を更新
  useEffect(() => { timerStagesRef.current = timerStages; }, [timerStages]);
  useEffect(() => { currentStageIndexRef.current = currentStageIndex; }, [currentStageIndex]);
  useEffect(() => { isTimerRunningRef.current = isTimerRunning; }, [isTimerRunning]);
  useEffect(() => { currentRemainingSecondsRef.current = currentRemainingSeconds; }, [currentRemainingSeconds]);
  useEffect(() => { statusMessageRef.current = statusMessage; }, [statusMessage]);
  useEffect(() => { enableSoundRef.current = enableSound; }, [enableSound]);
  useEffect(() => { selectedSoundTypeRef.current = selectedSoundType; }, [selectedSoundType]);

  // 同期イベントを送信する関数 (メインウィンドウのみが使用)
  const syncState = useCallback((overrides?: any) => {
    if (isMirror) return;
    emit("timer-state-sync", {
        stages: timerStagesRef.current,
        index: currentStageIndexRef.current,
        running: isTimerRunningRef.current,
        remaining: currentRemainingSecondsRef.current,
        message: statusMessageRef.current,
        ...overrides
    });
  }, [isMirror]);

  // --- イベントリスナーの設定 ---
  useEffect(() => {
    let unlistenUpdate: (() => void) | undefined;
    let unlistenSync: (() => void) | undefined;
    let unlistenRequest: (() => void) | undefined;
    
    const setupListeners = async () => {
      // 1. Rust側からの秒数更新 (全ウィンドウ共通)
      unlistenUpdate = await listen<number>("timer-update", (event) => {
        const remaining = event.payload;
        setCurrentRemainingSeconds(remaining);
        
        // 音声再生 (操作側メインウィンドウのみ)
        if (!isMirror) {
            const stages = timerStagesRef.current;
            const index = currentStageIndexRef.current;
            if (enableSoundRef.current && stages.length > 0 && index < stages.length) {
                const currentStage = stages[index];
                const isQA = currentStage.name.includes("質疑"); 
                if (!isQA && remaining === currentStage.warningThreshold && remaining > 0) {
                    playWarningSound(selectedSoundTypeRef.current);
                }
                if (remaining === 0) {
                    if (isQA) playFinishSound(selectedSoundTypeRef.current);
                    else playOvertimeSound(selectedSoundTypeRef.current);
                }
            }
        }
      });

      // 2. ウィンドウ間同期 (ミラーウィンドウのみが受信する)
      if (isMirror) {
          unlistenSync = await listen<any>("timer-state-sync", (event) => {
            const { stages, index, running, remaining, message } = event.payload;
            if (stages !== undefined) setTimerStages(stages);
            if (index !== undefined) setCurrentStageIndex(index);
            if (running !== undefined) setIsTimerRunning(running);
            if (remaining !== undefined) setCurrentRemainingSeconds(remaining);
            if (message !== undefined) setStatusMessage(message);
          });

          // 起動時にメインウィンドウへ同期をリクエスト
          emit("request-timer-sync");
      } else {
          // 3. ミラーウィンドウからのリクエストに応答 (メインウィンドウのみ)
          unlistenRequest = await listen("request-timer-sync", () => {
              syncState();
          });
      }
    };

    setupListeners();

    return () => {
      if (unlistenUpdate) unlistenUpdate();
      if (unlistenSync) unlistenSync();
      if (unlistenRequest) unlistenRequest();
    };
  }, [isMirror, syncState]);

  const setupTimer = async (stages: TimerStage[]) => {
      const initialRemaining = stages.length > 0 ? stages[0].duration : 0;
      
      setTimerStages(stages);
      setCurrentStageIndex(0);
      setIsTimerRunning(false);
      setCurrentRemainingSeconds(initialRemaining);
      const msg = "タイマーを開始してください。";
      setStatusMessage(msg);
      
      // 同期送信
      syncState({ stages, index: 0, running: false, remaining: initialRemaining, message: msg });

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

    syncState({ running: true, message: msg, remaining: duration, index });

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
    const msg = "タイマーが停止されました。";
    setStatusMessage(msg);
    syncState({ running: false, message: msg });
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
      const msg = "現在のステージをリセットしました。";
      setStatusMessage(msg);
      syncState({ running: false, remaining: initialDuration, message: msg });
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
    timerStages, currentStageIndex, isTimerRunning, currentRemainingSeconds,
    statusMessage, setStatusMessage, setupTimer, startTimer, stopTimer, resetTimer, nextStage
  };
}