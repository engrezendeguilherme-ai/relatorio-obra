import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { annotatedData } from '@/lib/photo-shapes';
import type { PiecePhoto } from '@/lib/report-model';

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const isRemote = (data: string) => !data.startsWith('data:');

/**
 * <img> of a photo with its circles/arrows burned in. Photos without markings render as a plain image.
 * A remote photo (shared link) is not shown raw first: loading it without CORS could poison the cache the marked copy needs.
 */
export function PhotoImg({ photo, alt, ...rest }: { photo: PiecePhoto; alt: string } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>) {
  const marked = !!photo.shapes?.length;
  const [src, setSrc] = useState(marked && isRemote(photo.data) ? BLANK : photo.data);
  useEffect(() => {
    let active = true;
    if (marked) void annotatedData(photo).then(d => { if (active) setSrc(d); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id, photo.data, photo.shapes, marked]);
  return <img {...rest} src={marked ? src : photo.data} alt={alt} />;
}
