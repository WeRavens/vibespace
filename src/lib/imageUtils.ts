import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB: number;
  maxWidthOrHeight: number;
  useWebWorker: boolean;
}

const defaultOptions: CompressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

export async function compressImage(
  file: File,
  options: Partial<CompressionOptions> = {}
): Promise<File> {
  const mergedOptions = { ...defaultOptions, ...options };
  
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    mergedOptions.maxSizeMB = 0.8;
    mergedOptions.maxWidthOrHeight = 1280;
  }

  try {
    const compressedFile = await imageCompression(file, mergedOptions);
    console.log(`Compressed ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
    return compressedFile;
  } catch (error) {
    console.error('Compression failed, using original:', error);
    return file;
  }
}

export function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function validateMediaFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 50 * 1024 * 1024;
  const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  
  if (file.size > maxSize) {
    return { valid: false, error: `File too large. Maximum ${maxSize / 1024 / 1024}MB allowed.` };
  }
  
  if (!videoTypes.includes(file.type) && !imageTypes.includes(file.type)) {
    return { valid: false, error: 'Unsupported file type. Use JPG, PNG, WebP, GIF, MP4, WebM, or MOV.' };
  }
  
  return { valid: true };
}