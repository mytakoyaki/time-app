import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { availableMonitors } from "@tauri-apps/api/window";
import { useState } from "react";
import { DisplaySettings } from "../types";

export function useMirrorWindow() {
    const [mirrorWindow, setMirrorWindow] = useState<WebviewWindow | null>(null);

    const openMirrorWindow = async (settings: DisplaySettings) => {
        if (mirrorWindow) return;

        const monitors = await availableMonitors();
        let targetMonitor = monitors[0];

        // 設定されたモニター名を探す
        if (settings.targetMonitorName) {
            const found = monitors.find(m => m.name === settings.targetMonitorName);
            if (found) {
                targetMonitor = found;
            }
        } else if (monitors.length > 1) {
            // 設定がない場合は2枚目（あれば）をデフォルトにする
            targetMonitor = monitors[1];
        }

        const newWindow = new WebviewWindow("mirror", {
            url: "index.html?mode=mirror",
            title: "発表タイマー（表示用）",
            fullscreen: true,
            x: targetMonitor.position.x,
            y: targetMonitor.position.y,
            decorations: false,
            alwaysOnTop: true,
            // Skip taskbar to make it cleaner
            skipTaskbar: true,
        });

        newWindow.once("tauri://created", () => {
            setMirrorWindow(newWindow);
        });

        newWindow.once("tauri://error", (e) => {
            console.error("Failed to create mirror window", e);
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