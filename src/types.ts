export interface TimerStage {
  name: string;
  duration: number; // in seconds
  warningThreshold: number; // in seconds
}

export interface Preset {
    id: string; 
    name: string;
    pMin: number;
    pSec: number;
    qMin: number;
    qSec: number;
    pWarn: number;
    qWarn: number;
}
