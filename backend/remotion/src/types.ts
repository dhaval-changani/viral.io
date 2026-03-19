export interface SceneRenderProps {
  sceneNumber: number;
  durationInFrames: number;
  visualDescription: string;
  spokenScript: string;
  audioPath: string | null;
  brollPath: string | null;
  fallbackColor: string;
  onScreenText: string | null;
  transition: string | null;
}

export interface VideoRenderProps {
  fps: number;
  scenes: SceneRenderProps[];
  musicPath: string | null;
  videoTitle: string;
}
