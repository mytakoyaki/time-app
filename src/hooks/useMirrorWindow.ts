import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { availableMonitors } from "@tauri-apps/api/window";
import { useState } from "react";
import { DisplaySettings } from "../types";

export function useMirrorWindow() {
    const [mirrorWindow, setMirrorWindow] = useState<WebviewWindow | null>(null);

    const openMirrorWindow = async (settings: DisplaySettings) => {
        if (mirrorWindow) {
            try {
                await mirrorWindow.setFocus();
                return;
            } catch (e) {
                // すでに閉じられている可能性があるため続行
                setMirrorWindow(null);
            }
        }

        const monitors = await availableMonitors();
        let targetMonitor = monitors[0];

        if (settings.targetMonitorName) {
            const found = monitors.find(m => m.name === settings.targetMonitorName);
            if (found) targetMonitor = found;
        } else if (monitors.length > 1) {
            targetMonitor = monitors[1];
        }

        const label = "mirror";
        const newWindow = new WebviewWindow(label, {
            url: "index.html?mode=mirror",
            title: "発表タイマー（表示用）",
            fullscreen: true,
            x: targetMonitor.position.x,
            y: targetMonitor.position.y,
            decorations: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            visible: false, // 準備ができるまで隠しておく
        });

        newWindow.once("tauri://created", async () => {
            setMirrorWindow(newWindow);
            try {
                // 明示的に全画面化と位置設定を再試行
                await newWindow.setPosition(targetMonitor.position);
                await newWindow.setFullscreen(true);
                await newWindow.show();
                await newWindow.setFocus();
            } catch (e) {
                console.error("Error finalizing mirror window", e);
            }
        });

        newWindow.once("tauri://error", (e) => {
            console.error("Failed to create mirror window", e);
            alert("外部ウィンドウの作成に失敗しました。権限設定を確認してください。");
        });

        newWindow.onCloseRequested(() => {
            setMirrorWindow(null);
        });
    };

    const closeMirrorWindow = async () => {
        if (mirrorWindow) {
            await mirrorWindow.close();
            setMirrorWindow(null);
        }
    };

    return {
        isMirrorOpen: !!mirrorWindow,
        openMirrorWindow,
        closeMirrorWindow
    };
}
