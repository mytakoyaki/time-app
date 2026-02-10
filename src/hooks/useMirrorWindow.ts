import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { availableMonitors } from "@tauri-apps/api/window";
import { useState } from "react";

export function useMirrorWindow() {
    const [mirrorWindow, setMirrorWindow] = useState<WebviewWindow | null>(null);

    const openMirrorWindow = async () => {
        // すでに開いている場合は何もしない
        if (mirrorWindow) return;

        const monitors = await availableMonitors();
        let targetMonitor = monitors[0];

        // 2枚目以降のモニターを探す
        if (monitors.length > 1) {
            targetMonitor = monitors[1];
        }

        const newWindow = new WebviewWindow("mirror", {
            url: "index.html?mode=mirror",
            title: "発表タイマー（表示用）",
            fullscreen: true,
            // 2枚目のモニターの位置に配置
            x: targetMonitor.position.x,
            y: targetMonitor.position.y,
            decorations: false,
            alwaysOnTop: true,
        });

        newWindow.once("tauri://created", () => {
            setMirrorWindow(newWindow);
        });

        newWindow.once("tauri://error", (e) => {
            console.error("Failed to create mirror window", e);
        });

        // 閉じられたらステートをリセット
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
