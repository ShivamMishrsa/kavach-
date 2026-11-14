/**
 * Makes a big photo smaller before it is sent, so a notice goes through on a weak connection and
 * costs less data. A phone photo is 3 to 8 MB; at 2400 pixels on the long edge a printed page is
 * still about 200 dots per inch, which is what the text reading needs (see docs/benchmarks.md).
 *
 * Two things change for the person, and the screens say so: the file that is sent (and
 * fingerprinted by the server) is the smaller copy, not the original, and the copy has no camera
 * metadata (no location, no phone model).
 */
export interface Plan {
  /** Longest side in pixels; a picture already within it keeps its size. */
  maxEdge: number;
  /** JPEG quality, 0 to 1. */
  quality: number;
  /** A file smaller than this is sent as it is. */
  leaveBelowBytes: number;
}

export const NORMAL: Plan = { maxEdge: 2400, quality: 0.85, leaveBelowBytes: 1_500_000 };
export const SAVING_DATA: Plan = { maxEdge: 1600, quality: 0.7, leaveBelowBytes: 400_000 };

export const planFor = (lowData: boolean): Plan => (lowData ? SAVING_DATA : NORMAL);

/** The new size, or null when the picture already fits. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } | null {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return null;
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Photos and screenshots are made smaller; PDFs and small files are never touched. */
export function worthShrinking(file: Pick<File, 'type' | 'size'>, plan: Plan): boolean {
  return /^image\/(jpeg|png|webp)$/.test(file.type) && file.size >= plan.leaveBelowBytes;
}

/**
 * The file to send: a smaller JPEG if that is really smaller, otherwise the original. Any failure
 * (an old browser, a picture it cannot decode) sends the original, never an error.
 */
export async function shrinkImage(file: File, plan: Plan): Promise<File> {
  if (!worthShrinking(file, plan)) return file;
  try {
    // "from-image" applies the camera's rotation, so a sideways photo is not sent sideways.
    const picture = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const size = fitWithin(picture.width, picture.height, plan.maxEdge) ?? {
      width: picture.width,
      height: picture.height,
    };
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.fillStyle = '#fff'; // a transparent PNG becomes white, not black, in a JPEG
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(picture, 0, 0, size.width, size.height);
    picture.close();
    const blob = await new Promise<Blob | null>((done) =>
      canvas.toBlob(done, 'image/jpeg', plan.quality),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
