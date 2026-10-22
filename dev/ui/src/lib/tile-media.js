// Picture a gallery card paints. Container-grain tiles set `preview` when
// the first matching member is not `media[0]`. Every other tile uses the
// stored first row.

export function tileLeadMedia (item) {
  if (!item) return null;
  if (item.preview) return item.preview;
  const media = item.media;
  return (Array.isArray(media) && media[0]) || null;
}
