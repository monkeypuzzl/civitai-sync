import { thumbnailVisual } from '../lib/format.js';

// One thumbnail element. `muted` is set before `src` so a video preview
// cannot start audible. The media-page player is not this component.
export function MediaThumb ({ type, thumbnailPath, coverPath }) {
  if (type === 'model3d') {
    if (thumbnailPath) return <img src={thumbnailPath} alt="" loading="lazy" />;
    return (
      <div class="audio-placeholder">
        <span class="model3d-mark">3D</span>
      </div>
    );
  }
  const visual = thumbnailVisual({ type, thumbnailPath, coverPath });
  if (visual.kind === 'video') {
    return <video muted playsInline preload="metadata" src={visual.src} />;
  }
  if (visual.kind === 'glyph') {
    return (
      <div class="audio-placeholder">
        <span class="audio-glyph">{'\u266B'}</span>
      </div>
    );
  }
  return <img src={visual.src} alt="" loading="lazy" />;
}
