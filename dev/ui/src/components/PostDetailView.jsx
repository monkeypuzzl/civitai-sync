import { useState, useEffect, useCallback } from 'preact/hooks';
import { getPost, openFolder } from '../api.js';
import { formatDate, relativeTime, copyToClipboard } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { PostMediaLightbox } from './PostMediaLightbox.jsx';

const REACTION_ICONS = {
  heartCount: '\u2764\uFE0F',
  likeCount: '\uD83D\uDC4D',
  laughCount: '\uD83D\uDE02',
  cryCount: '\uD83D\uDE22',
  dislikeCount: '\uD83D\uDC4E',
  collectedCount: '\uD83D\uDCDA',
  commentCount: '\uD83D\uDCAC'
};

const META_PARAM_KEYS = [
  ['Model', 'Model'],
  ['sampler', 'Sampler'],
  ['steps', 'Steps'],
  ['cfgScale', 'CFG Scale'],
  ['seed', 'Seed'],
  ['Size', 'Size'],
  ['Clip skip', 'Clip Skip'],
  ['Hires upscale', 'Hires Upscale'],
  ['Hires upscaler', 'Hires Upscaler'],
  ['Denoising strength', 'Denoising'],
];

export function PostDetailView ({ postId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    getPost(postId)
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [postId]);

  async function doCopy (text, label) {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  if (loading) {
    return <div class="main-content"><div class="loading-bar"><div class="spinner" /></div></div>;
  }

  if (!data || !data.index) {
    return (
      <div class="main-content">
        <div class="empty-state">
          <h2>Post not found</h2>
          <p>This post may not have been downloaded yet.</p>
          <button class="meta-action" onClick={() => navigate('posts')}>Back to Posts</button>
        </div>
      </div>
    );
  }

  const post = data.index;
  const raw = data.raw;
  const rawImages = raw?.images || [];
  const stats = post.stats || {};
  const reactions = Object.entries(REACTION_ICONS)
    .filter(([key]) => stats[key] > 0)
    .map(([key, icon]) => ({ key, icon, count: stats[key] }));

  return (
    <div class="main-content">
      <div class="post-detail">
        {/* Back nav */}
        <button class="post-detail-back" onClick={() => navigate('posts')}>
          {'\u2190'} Posts
        </button>

        {/* Header */}
        <div class="post-detail-header">
          <h1 class="post-detail-title">
            {post.title || `Post #${post.id}`}
          </h1>
          <div class="post-detail-date">
            <span>{formatDate(post.publishedAt)}</span>
            <span class="text-muted">{'\u00B7'} {relativeTime(post.publishedAt)}</span>
          </div>
        </div>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div class="post-detail-reactions">
            {reactions.map(r => (
              <span key={r.key} class="post-reaction-chip">{r.icon} {r.count}</span>
            ))}
          </div>
        )}

        {/* Description */}
        {post.detail && (
          <div class="post-detail-description" dangerouslySetInnerHTML={{ __html: post.detail }} />
        )}

        {/* Tags */}
        {post.tags.length > 0 && (
          <div class="post-detail-tags">
            {post.tags.map(tag => (
              <span key={tag.id || tag.name} class="meta-tag">{tag.name}</span>
            ))}
          </div>
        )}

        {/* Media grid — all items visible */}
        <div class="post-detail-media-grid">
          {post.media.map((m, i) => {
            const isVideo = m.type === 'video';
            const rawImg = rawImages.find(img => img.id === m.imageId) || null;
            const meta = m.meta || rawImg?.meta || null;
            return (
              <div key={m.imageId} class="post-media-card">
                <div class="post-media-card-visual" onClick={() => setLightboxIdx(i)}>
                  {isVideo
                    ? <video src={m.thumbnailPath} preload="metadata" muted playsInline />
                    : <img src={m.thumbnailPath} loading="lazy" alt="" />
                  }
                  {isVideo && <div class="video-badge" />}
                  <div class="post-media-card-zoom">{'\u26F6'}</div>
                </div>
                <MediaCardMeta
                  media={m}
                  rawImage={rawImg}
                  meta={meta}
                  doCopy={doCopy}
                  copied={copied}
                />
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div class="post-detail-actions">
          <a class="meta-action" href={post.url} target="_blank" rel="noopener noreferrer">
            Open on Civitai
          </a>
          {post.media[0] && (
            <button class="meta-action" onClick={() => openFolder(post.media[0].thumbnailPath)}>
              Open folder
            </button>
          )}
        </div>
      </div>

      {/* Lightbox for individual media */}
      {lightboxIdx != null && (
        <PostMediaLightbox
          media={post.media}
          startIdx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}

function MediaCardMeta ({ media, rawImage, meta, doCopy, copied }) {
  const dims = media.width > 0 && media.height > 0
    ? `${media.width}\u00D7${media.height}`
    : null;

  if (!meta && !dims) return null;

  const params = meta
    ? META_PARAM_KEYS
        .filter(([key]) => meta[key] != null && meta[key] !== '')
        .map(([key, label]) => ({ label, value: String(meta[key]) }))
    : [];

  const seed = meta?.seed != null ? String(meta.seed) : null;

  return (
    <div class="post-media-card-meta">
      {dims && <div class="post-media-dims">{dims}</div>}
      {rawImage?.nsfwLevel != null && rawImage.nsfwLevel > 1 && (
        <span class="param-chip post-media-nsfw">NSFW {rawImage.nsfwLevel}</span>
      )}

      {meta?.prompt && (
        <div class="post-media-prompt">
          <div class="post-media-prompt-text">{meta.prompt}</div>
          <div class="meta-actions">
            <button
              class={`meta-action compact${copied === `prompt-${media.imageId}` ? ' copied' : ''}`}
              onClick={() => doCopy(meta.prompt, `prompt-${media.imageId}`)}
            >
              {copied === `prompt-${media.imageId}` ? 'Copied' : 'Copy prompt'}
            </button>
          </div>
        </div>
      )}

      {params.length > 0 && (
        <div class="meta-params">
          {params.map(p => (
            <span key={p.label} class="param-chip" title={p.label}>{p.label}: {p.value}</span>
          ))}
        </div>
      )}
    </div>
  );
}
