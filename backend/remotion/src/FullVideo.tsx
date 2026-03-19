import React from 'react';
import { AbsoluteFill, Audio, Sequence } from 'remotion';
import { VideoScene } from './VideoScene';
import type { VideoRenderProps } from './types';

export function FullVideo({
  scenes,
  musicPath,
}: VideoRenderProps): React.ReactElement {
  let frameOffset = 0;

  return (
    <AbsoluteFill style={{ background: '#000000' }}>
      {/* Background music at reduced volume */}
      {musicPath && <Audio src={musicPath} volume={0.15} />}

      {scenes.map((scene) => {
        const startFrame = frameOffset;
        frameOffset += scene.durationInFrames;
        return (
          <Sequence
            key={scene.sceneNumber}
            from={startFrame}
            durationInFrames={scene.durationInFrames}
          >
            <VideoScene {...scene} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
