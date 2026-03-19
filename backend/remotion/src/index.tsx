import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { FullVideo } from './FullVideo';
import type { VideoRenderProps } from './types';

const DEFAULT_FPS = 30;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

// Default props used in Remotion Studio preview only.
// Actual render props are injected via --props at render time.
const defaultProps: VideoRenderProps = {
  fps: DEFAULT_FPS,
  videoTitle: 'Preview',
  musicPath: null,
  scenes: [
    {
      sceneNumber: 1,
      durationInFrames: 150,
      visualDescription: 'Preview scene',
      spokenScript: 'Preview narration',
      audioPath: null,
      brollPath: null,
      fallbackColor: '#1a1a2e',
      onScreenText: null,
      transition: null,
    },
  ],
};

function RemotionRoot(): React.ReactElement {
  const totalFrames = defaultProps.scenes.reduce(
    (sum, s) => sum + s.durationInFrames,
    0,
  );

  return (
    <Composition
      id="FullVideo"
      component={FullVideo}
      durationInFrames={totalFrames}
      fps={DEFAULT_FPS}
      width={DEFAULT_WIDTH}
      height={DEFAULT_HEIGHT}
      defaultProps={defaultProps}
    />
  );
}

registerRoot(RemotionRoot);
