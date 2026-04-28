/**
 * Encode a single small community video for localStorage (data URL).
 * Keep files tiny — browser storage is limited and JSON.stringify bloats base64.
 */

export const MAX_COMMUNITY_VIDEO_BYTES = 2.5 * 1024 * 1024; // 2.5 MB

const MB = MAX_COMMUNITY_VIDEO_BYTES / (1024 * 1024);

/**
 * @param {File} file
 * @returns {Promise<string>} data URL
 */
export function fileToSmallVideoDataUrl(file) {
  if (!(file instanceof File)) {
    return Promise.reject(new Error('Invalid file'));
  }
  if (file.size > MAX_COMMUNITY_VIDEO_BYTES) {
    return Promise.reject(new Error(`Video must be about ${MB.toFixed(1)} MB or smaller`));
  }
  if (file.type && !file.type.startsWith('video/')) {
    return Promise.reject(new Error('Please choose a video file'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = reader.result;
      if (typeof s === 'string' && s.startsWith('data:')) {
        resolve(s);
      } else {
        reject(new Error('Could not read video'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read video'));
    reader.readAsDataURL(file);
  });
}
