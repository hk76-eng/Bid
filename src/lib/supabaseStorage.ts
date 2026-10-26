import { safeStorage } from './safeStorage';

/**
 * Image compressor utility returning data URL (since Supabase media storage has been removed)
 */
export async function compressImageToDataUrl(file: File | Blob, maxWidth = 800, maxHeightOrQuality = 800, quality = 0.8): Promise<string> {
  const finalQuality = typeof maxHeightOrQuality === 'number' && maxHeightOrQuality <= 1 ? maxHeightOrQuality : quality;
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(dataUrl);
            return;
          }
          resolve(event.target?.result as string || '');
        };
        img.onerror = () => resolve(event.target?.result as string || '');
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    } catch {
      resolve('');
    }
  });
}

export const MOTORIDE_MEDIA_BUCKET = 'motoride-media';

export interface StorageStatus {
  success: boolean;
  message: string;
  publicUrlSample?: string;
}

export async function ensureMediaBucketExists(): Promise<StorageStatus> {
  return { success: true, message: 'Local storage bucket ready' };
}

export async function uploadMediaToSupabase(file: File | Blob, fileName?: string, folder = 'general'): Promise<string | null> {
  try {
    const dataUrl = await compressImageToDataUrl(file);
    if (dataUrl) {
      try {
        const cacheKey = `motoride_media_${folder}_${Date.now()}`;
        safeStorage.setItem(cacheKey, dataUrl);
      } catch {}
      return dataUrl;
    }
  } catch {}
  return null;
}
