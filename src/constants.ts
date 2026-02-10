import { Preset } from "./types";

export const DEFAULT_PRESETS: Preset[] = [
    { id: "default", name: "標準 (5分/3分)", pMin: 5, pSec: 0, qMin: 3, qSec: 0, pWarn: 60, qWarn: 30 },
    { id: "short", name: "短め (3分/2分)", pMin: 3, pSec: 0, qMin: 2, qSec: 0, pWarn: 30, qWarn: 30 },
    { id: "long", name: "長め (10分/5分)", pMin: 10, pSec: 0, qMin: 5, qSec: 0, pWarn: 120, qWarn: 60 },
    { id: "lt", name: "LT (5分/なし)", pMin: 5, pSec: 0, qMin: 0, qSec: 0, pWarn: 60, qWarn: 0 },
];

export const PRESETS_FILE = "settings.json";
