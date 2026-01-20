import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// --- DOM Elements ---
// Setup View
let setupView: HTMLElement | null;
let minutesPresentationInput: HTMLInputElement | null;
let secondsPresentationInput: HTMLInputElement | null;
let minutesQAInput: HTMLInputElement | null;
let secondsQAInput: HTMLInputElement | null;
let goToTimerViewButton: HTMLButtonElement | null;
let setupStatusMessage: HTMLElement | null;

// Timer View
let timerView: HTMLElement | null;
let startTimerButton: HTMLButtonElement | null;
let stopTimerButton: HTMLButtonElement | null;
let resetTimerButton: HTMLButtonElement | null;
let timerStageLabel: HTMLElement | null;
let timerMinutesDisplay: HTMLElement | null;
let timerSecondsDisplay: HTMLElement | null;
let timerStatusMessage: HTMLElement | null;
let goToSetupViewButton: HTMLButtonElement | null;

// --- State Management ---
interface TimerStage {
  name: string;
  duration: number; // in seconds
}

let timerStages: TimerStage[] = [];
let currentStageIndex = 0;
let isTimerRunning = false;
let currentRemainingSeconds = 0; // バックエンドから受け取った現在の残り時間

// --- Utility Functions ---
function formatTime(totalSeconds: number): { minutes: string; seconds: string } {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

function updateTimerDisplay(totalSeconds: number) {
  const { minutes, seconds } = formatTime(totalSeconds);
  if (timerMinutesDisplay) timerMinutesDisplay.textContent = minutes;
  if (timerSecondsDisplay) timerSecondsDisplay.textContent = seconds;
}

function updateStageLabel() {
  if (timerStageLabel && timerStages.length > 0) {
    timerStageLabel.textContent = timerStages[currentStageIndex]?.name || "準備中";
  } else if (timerStageLabel) {
    timerStageLabel.textContent = "タイマー未設定";
  }
}

// --- View Switching ---
function showSetupView() {
  if (setupView) setupView.style.display = "block";
  if (timerView) timerView.style.display = "none";
  // タイマー停止・リセット
  handleStopTimer();
  resetStateAndUI();
}

function showTimerView() {
  if (setupView) setupView.style.display = "none";
  if (timerView) timerView.style.display = "block";
  
  // タイマー表示画面に入った時の初期化
  currentStageIndex = 0;
  isTimerRunning = false;
  initializeTimerStages();
  updateStageLabel();
  if (timerStages.length > 0) {
    currentRemainingSeconds = timerStages[currentStageIndex].duration;
    updateTimerDisplay(currentRemainingSeconds);
  } else {
    updateTimerDisplay(0);
  }
  if (timerStatusMessage) timerStatusMessage.textContent = "タイマーを開始してください。";
}


// --- Timer Stage Management ---
function initializeTimerStages() {
  const presentationMinutes = parseInt(minutesPresentationInput?.value || "0");
  const presentationSeconds = parseInt(secondsPresentationInput?.value || "0");
  const qaMinutes = parseInt(minutesQAInput?.value || "0");
  const qaSeconds = parseInt(secondsQAInput?.value || "0");

  timerStages = [
    { name: '発表', duration: presentationMinutes * 60 + presentationSeconds },
    { name: '質疑応答', duration: qaMinutes * 60 + qaSeconds },
  ];
  // 0秒のステージは除外
  timerStages = timerStages.filter(stage => stage.duration > 0);
}

function resetStateAndUI() {
  currentStageIndex = 0;
  isTimerRunning = false;
  currentRemainingSeconds = 0;
  updateStageLabel();
  updateTimerDisplay(0);
  if (timerStatusMessage) timerStatusMessage.textContent = "";
}

// --- Event Handlers ---

// Setup View Buttons
async function handleGoToTimerView() {
  initializeTimerStages();
  if (timerStages.length === 0) {
    if (setupStatusMessage) setupStatusMessage.textContent = "タイマーを設定してください。";
    return;
  }
  showTimerView();
}

// Timer View Buttons
async function handleStartTimer() {
  if (isTimerRunning) return;
  if (currentStageIndex >= timerStages.length) {
    if(timerStatusMessage) timerStatusMessage.textContent = "すべてのタイマーが完了しました。リセットしてください。";
    return;
  }
  
  isTimerRunning = true;
  updateStageLabel();
  const currentStage = timerStages[currentStageIndex];

  try {
    if (timerStatusMessage) timerStatusMessage.textContent = `${currentStage.name}を開始しました。`;
    await invoke("start_timer", { durationSeconds: currentRemainingSeconds }); // 現在の残り時間を渡す
  } catch (error) {
    console.error("Failed to start timer:", error);
    if (timerStatusMessage) timerStatusMessage.textContent = `エラー: ${error}`;
    isTimerRunning = false; // エラー時はフラグをリセット
  }
}

async function handleStopTimer() {
  if (!isTimerRunning) return;
  isTimerRunning = false;
  try {
    await invoke("stop_timer");
    if (timerStatusMessage) timerStatusMessage.textContent = "タイマーが停止されました。";
  } catch (error) {
    console.error("Failed to stop timer:", error);
    if (timerStatusMessage) timerStatusMessage.textContent = `エラー: ${error}`;
  }
}

async function handleResetTimer() {
  try {
    await invoke("reset_timer"); // バックエンドのリセットコマンドを呼び出す
    currentStageIndex = 0;
    isTimerRunning = false;
    initializeTimerStages(); // 初期設定を再ロード
    if (timerStages.length > 0) {
        currentRemainingSeconds = timerStages[currentStageIndex].duration;
        updateTimerDisplay(currentRemainingSeconds);
    } else {
        updateTimerDisplay(0);
    }
    updateStageLabel();
    if (timerStatusMessage) timerStatusMessage.textContent = "タイマーがリセットされました。";
  } catch (error) {
    console.error("Failed to reset timer:", error);
    if (timerStatusMessage) timerStatusMessage.textContent = `エラー: ${error}`;
  }
}

// --- Initial Setup and Event Listeners ---
window.addEventListener("DOMContentLoaded", () => {
  // Get DOM elements
  setupView = document.querySelector("#setup-view");
  minutesPresentationInput = document.querySelector("#minutes-presentation");
  secondsPresentationInput = document.querySelector("#seconds-presentation");
  minutesQAInput = document.querySelector("#minutes-qa");
  secondsQAInput = document.querySelector("#seconds-qa");
  goToTimerViewButton = document.querySelector("#go-to-timer-view");
  setupStatusMessage = document.querySelector("#setup-status-message");

  timerView = document.querySelector("#timer-view");
  startTimerButton = document.querySelector("#start-timer");
  stopTimerButton = document.querySelector("#stop-timer");
  resetTimerButton = document.querySelector("#reset-timer");
  timerStageLabel = document.querySelector("#timer-stage-label");
  timerMinutesDisplay = document.querySelector("#timer-minutes");
  timerSecondsDisplay = document.querySelector("#timer-seconds");
  timerStatusMessage = document.querySelector("#status-message");
  goToSetupViewButton = document.querySelector("#go-to-setup-view");

  // Initial view
  showSetupView();

  // Add event listeners
  goToTimerViewButton?.addEventListener("click", handleGoToTimerView);
  goToSetupViewButton?.addEventListener("click", showSetupView);
  startTimerButton?.addEventListener("click", handleStartTimer);
  stopTimerButton?.addEventListener("click", handleStopTimer);
  resetTimerButton?.addEventListener("click", handleResetTimer);

  // Listen to events from Rust backend
  listen("timer-update", (event) => {
    const remainingSeconds = event.payload as number;
    currentRemainingSeconds = remainingSeconds; // 現在の残り時間を更新
    updateTimerDisplay(remainingSeconds);
  });

  listen("timer-finished", async () => {
    isTimerRunning = false;
    currentStageIndex++;
    if (currentStageIndex < timerStages.length) {
      // 次のステージへ
      if (timerStatusMessage) timerStatusMessage.textContent = `次のステージ: ${timerStages[currentStageIndex].name}を開始します。`;
      currentRemainingSeconds = timerStages[currentStageIndex].duration; // 次のステージの時間をセット
      updateStageLabel();
      updateTimerDisplay(currentRemainingSeconds);
      // 自動で次のステージを開始
      // await handleStartTimer(); // handleStartTimer内でisTimerRunningをチェックしているので再帰呼び出し注意
      // 現在の残り時間を使ってstart_timerを直接呼び出す
      try {
        isTimerRunning = true; // start_timerはisTimerRunningがfalseでないとエラーになるため設定
        await invoke("start_timer", { durationSeconds: currentRemainingSeconds });
        if (timerStatusMessage) timerStatusMessage.textContent = `${timerStages[currentStageIndex].name}を開始しました。`;
      } catch (error) {
        console.error("Failed to auto-start next stage:", error);
        if (timerStatusMessage) timerStatusMessage.textContent = `エラー: ${error}`;
        isTimerRunning = false;
      }
    } else {
      // 全ステージ終了
      if (timerStatusMessage) timerStatusMessage.textContent = "すべてのタイマーが完了しました！";
      updateStageLabel();
      updateTimerDisplay(0); // 念のため0に
    }
  });
});
