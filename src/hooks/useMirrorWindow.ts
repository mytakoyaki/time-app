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

        try {
            // Tauri v2 ではまず最小限の構成でウィンドウを作成し、
            // その後でフルスクリーンなどの設定を適用するのが確実です
            const newWindow = new WebviewWindow("mirror", {
                url: "index.html?mode=mirror",
                title: "発表タイマー（表示用）",
                x: targetMonitor.position.x,
                y: targetMonitor.position.y,
                width: 800,
                height: 600,
                decorations: false,
                alwaysOnTop: true,
                skipTaskbar: true,
                visible: false,
            });

            newWindow.once("tauri://created", async () => {
                setMirrorWindow(newWindow);
                try {
                    // ウィンドウ生成後に全画面化と表示を行う
                    await newWindow.setFullscreen(true);
                    await newWindow.show();
                    await newWindow.setFocus();
                } catch (e) {
                    console.error("Error finalizing mirror window", e);
                }
            });

            newWindow.once("tauri://error", (e) => {
                console.error("Window creation error event:", e);
                alert("ウィンドウ作成エラーが発生しました。");
            });

        } catch (error) {
            console.error("Caught window creation error:", error);
            alert("ウィンドウを作成する権限がないか、エラーが発生しました。アプリを再起動して試してください。");
        }
    };

    const closeMirrorWindow = async () => {
        if (mirrorWindow) {
            try {
                await mirrorWindow.close();
            } catch (e) {
                console.error("Error closing window", e);
            }
            setMirrorWindow(null);
        }
    };

    return {
        isMirrorOpen: !!mirrorWindow,
        openMirrorWindow,
        closeMirrorWindow
    };
}