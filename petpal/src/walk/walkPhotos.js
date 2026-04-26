/** Resize and encode images for localStorage; keeps payload smaller. */

const MAX_FILES = 8;
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.82;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

/**
 * @param {File[]} files
 * @returns {Promise<string[]>} data URLs (image/jpeg)
 */
export async function filesToResizedDataUrls(files) {
  const out = [];
  const slice = files.slice(0, MAX_FILES);
  for (const file of slice) {
    if (!file.type || !file.type.startsWith('image/')) continue;
    try {
      const img = await loadImage(file);
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w <= 0 || h <= 0) continue;
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        if (w >= h) {
          h = Math.round((h * MAX_DIMENSION) / w);
          w = MAX_DIMENSION;
        } else {
          w = Math.round((w * MAX_DIMENSION) / h);
          h = MAX_DIMENSION;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      out.push(dataUrl);
    } catch {
      // skip bad file
    }
  }
  return out;
}

/** Max images per add; also cap total per walk session in GameContext. */
export { MAX_FILES as WALK_PHOTO_MAX_PER_BATCH };
export const MAX_PHOTOS_PER_WALK_SESSION = 12;
