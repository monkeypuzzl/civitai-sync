import { useState, useEffect, useCallback } from 'preact/hooks';
import { formatDate, relativeTime, tagLabel, tagCssClass, copyToClipboard } from '../lib/format.js';
import { openFolder, getGeneration } from '../api.js';
import { HighlightText } from './HighlightText.jsx';

export function Lightbox ({ item, onClose, onPrev, onNext, search }) {
  const [mediaIdx, setMediaIdx] = useState(0);
  const [copied, setCopied] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => { setMediaIdx(0); setDetail(null); }, [item.id]);

  useEffect(() => {
    let cancelled = false;
    getGeneration(item.id).then(d => { if (!cancelled) setDetail(d.raw); }).catch(() => {});
    return () => { cancelled = true; };
  }, [item.id]);

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') return onClose();

    if (item.media.length > 1) {
      if (e.key === 'ArrowLeft') setMediaIdx(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setMediaIdx(i => Math.min(item.media.length - 1, i + 1));
    } else {
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    }
  }, [item, onClose, onPrev, onNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [handleKey]);

  const cur = item.media[mediaIdx];
  const isVideo = cur?.type === 'video';
  const dateStr = item.createdAt || item.publishedAt;

  const resources = (detail?.steps?.[0]?.resources || [])
    .map(r => ({
      name: r.model?.name || r.name || 'Unknown',
      type: r.modelType || r.model?.type || '',
      strength: r.strength
    }));

  async function doCopy (text, label) {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div class="lightbox-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <button class="lightbox-close" onClick={onClose} aria-label="Close">{'\u2715'}</button>

      <div class="lightbox-container">
        <div class="lightbox-image-area">
          {onPrev && item.media.length <= 1 && (
            <button class="lightbox-nav-arrow prev" onClick={onPrev}>{'\u2039'}</button>
          )}

          {isVideo
            ? <video src={cur.thumbnailPath} controls autoPlay loop />
            : <img src={cur.thumbnailPath} alt="" />
          }

          {onNext && item.media.length <= 1 && (
            <button class="lightbox-nav-arrow next" onClick={onNext}>{'\u203A'}</button>
          )}

          {item.media.length > 1 && (
            <div class="lightbox-image-nav">
              <button disabled={mediaIdx === 0} onClick={() => setMediaIdx(i => i - 1)}>{'\u2039'}</button>
              <span>{mediaIdx + 1} / {item.media.length}</span>
              <button disabled={mediaIdx === item.media.length - 1} onClick={() => setMediaIdx(i => i + 1)}>{'\u203A'}</button>
            </div>
          )}
        </div>

        <div class="lightbox-meta">
          <div class="meta-section">
            <div class="meta-date">{formatDate(dateStr)}</div>
            <div class="meta-relative">{relativeTime(dateStr)}</div>
            <div class="meta-id">{item.id}</div>
          </div>

          {item.prompt && (
            <div class="meta-section">
              <div class="meta-label">Prompt</div>
              <div class="meta-prompt"><HighlightText text={item.prompt} search={search} /></div>
              <div class="meta-actions">
                <button
                  class={`meta-action${copied === 'prompt' ? ' copied' : ''}`}
                  onClick={() => doCopy(item.prompt, 'prompt')}
                >
                  {copied === 'prompt' ? 'Copied' : 'Copy prompt'}
                </button>
              </div>
            </div>
          )}

          {item.negativePrompt && (
            <div class="meta-section">
              <div class="meta-label">Negative Prompt</div>
              <div class="meta-prompt meta-neg-prompt">{item.negativePrompt}</div>
            </div>
          )}

          {item.model && (
            <div class="meta-section">
              <div class="meta-label">Model</div>
              <div class="meta-value">{item.model}</div>
            </div>
          )}

          {item.params && (
            <div class="meta-section">
              <div class="meta-label">Parameters</div>
              <div class="meta-params">
                {cur?.seed && <span class="param-chip">Seed {cur.seed}</span>}
                {item.params.steps > 0 && <span class="param-chip">{item.params.steps} steps</span>}
                {item.params.sampler && <span class="param-chip">{item.params.sampler}</span>}
                {item.params.cfgScale > 0 && <span class="param-chip">CFG {item.params.cfgScale}</span>}
                {item.params.width > 0 && item.params.height > 0 && (
                  <span class="param-chip">{item.params.width}{'\u00D7'}{item.params.height}</span>
                )}
              </div>
            </div>
          )}

          {resources.length > 0 && (
            <div class="meta-section">
              <div class="meta-label">Resources</div>
              <div class="meta-resources">
                {resources.map((r, i) => (
                  <div key={i} class="resource-item">
                    <span class="resource-name">{r.name}</span>
                    {r.type && <span class="resource-type">{r.type}</span>}
                    {r.strength != null && r.strength !== 1 && (
                      <span class="resource-strength">@ {r.strength}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.tags.length > 0 && (
            <div class="meta-section">
              <div class="meta-label">Tags</div>
              <div class="meta-tags">
                {item.tags.map(tag => (
                  <span key={typeof tag === 'string' ? tag : tag.id} class={`meta-tag ${tagCssClass(tag)}`}>
                    {tagLabel(tag)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div class="meta-section">
            <div class="meta-actions">
              {cur && <button class="meta-action" onClick={() => openFolder(cur.thumbnailPath)}>Open folder</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
