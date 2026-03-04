import { useState, useEffect, useCallback } from 'preact/hooks';
import { copyToClipboard } from '../lib/format.js';
import { openFolder } from '../api.js';

const META_PARAM_KEYS = [
  ['Model', 'Model'],
  ['sampler', 'Sampler'],
  ['steps', 'Steps'],
  ['cfgScale', 'CFG Scale'],
  ['seed', 'Seed'],
  ['Size', 'Size'],
  ['Clip skip', 'Clip Skip'],
  ['Denoising strength', 'Denoising'],
];

export function PostMediaLightbox ({ media, startIdx, onClose }) {
  const [idx, setIdx] = useState(startIdx);
  const [copied, setCopied] = useState(null);

  useEffect(() => { setIdx(startIdx); }, [startIdx]);

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') return onClose();
    if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1));
    if (e.key === 'ArrowRight') setIdx(i => Math.min(media.length - 1, i + 1));
  }, [media.length, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [handleKey]);

  async function doCopy (text, label) {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  const cur = media[idx];
  if (!cur) return null;
  const isVideo = cur.type === 'video';
  const meta = cur.meta || null;
  const seed = meta?.seed != null ? String(meta.seed) : null;

  const params = meta
    ? META_PARAM_KEYS
        .filter(([key]) => meta[key] != null && meta[key] !== '')
        .map(([key, label]) => ({ label, value: String(meta[key]) }))
    : [];

  return (
    <div class="lightbox-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <button class="lightbox-close" onClick={onClose} aria-label="Close">{'\u2715'}</button>

      <div class="lightbox-container">
        <div class="lightbox-image-area">
          {media.length > 1 && idx > 0 && (
            <button class="lightbox-nav-arrow prev" onClick={() => setIdx(i => i - 1)}>{'\u2039'}</button>
          )}

          {isVideo
            ? <video key={cur.imageId} src={cur.thumbnailPath} controls autoPlay loop />
            : <img key={cur.imageId} src={cur.thumbnailPath} alt="" />
          }

          {media.length > 1 && idx < media.length - 1 && (
            <button class="lightbox-nav-arrow next" onClick={() => setIdx(i => i + 1)}>{'\u203A'}</button>
          )}

          {media.length > 1 && (
            <div class="lightbox-image-nav">
              <span>{idx + 1} / {media.length}</span>
            </div>
          )}
        </div>

        <div class="lightbox-meta">
          {/* Dimensions */}
          {cur.width > 0 && cur.height > 0 && (
            <div class="meta-section">
              <div class="meta-params">
                <span class="param-chip">{cur.width}{'\u00D7'}{cur.height}</span>
                {cur.duration > 0 && <span class="param-chip">{cur.duration.toFixed(1)}s</span>}
              </div>
            </div>
          )}

          {/* Prompt */}
          {meta?.prompt && (
            <div class="meta-section">
              <div class="meta-label">Prompt</div>
              <div class="meta-prompt">{meta.prompt}</div>
              <div class="meta-actions">
                <button
                  class={`meta-action${copied === 'prompt' ? ' copied' : ''}`}
                  onClick={() => doCopy(meta.prompt, 'prompt')}
                >
                  {copied === 'prompt' ? 'Copied' : 'Copy prompt'}
                </button>
              </div>
            </div>
          )}

          {/* Negative Prompt */}
          {meta?.negativePrompt && (
            <div class="meta-section">
              <div class="meta-label">Negative Prompt</div>
              <div class="meta-prompt meta-neg-prompt">{meta.negativePrompt}</div>
            </div>
          )}

          {/* Parameters */}
          {params.length > 0 && (
            <div class="meta-section">
              <div class="meta-label">Parameters</div>
              <div class="meta-params">
                {params.map(p => (
                  <span key={p.label} class="param-chip" title={p.label}>{p.label}: {p.value}</span>
                ))}
              </div>
            </div>
          )}

          {/* Open folder */}
          <div class="meta-section">
            <div class="meta-actions">
              <button class="meta-action" onClick={() => openFolder(cur.thumbnailPath)}>Open folder</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
