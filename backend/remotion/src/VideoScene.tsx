import React from 'react';
import { AbsoluteFill, Audio, Video } from 'remotion';
import type { SceneRenderProps } from './types';

export function VideoScene({
  audioPath,
  brollPath,
  fallbackColor,
  onScreenText,
}: SceneRenderProps): React.ReactElement {
  return (
    <AbsoluteFill>
      {/* Background: b-roll video or fallback CSS color */}
      {brollPath ? (
        <Video
          src={brollPath}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <AbsoluteFill style={{ background: fallbackColor }} />
      )}

      {/* Audio narration — frame-accurate within this Sequence */}
      {audioPath && <Audio src={audioPath} />}

      {/* On-screen text overlay */}
      {onScreenText && (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            padding: '60px 40px',
          }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.72)',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '32px',
              fontFamily: 'sans-serif',
              maxWidth: '80%',
              lineHeight: 1.35,
            }}
          >
            {onScreenText}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
