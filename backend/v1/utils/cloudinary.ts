import {
  uploadFile,
  uploadToCloudinary as uploadDirectCloudinary,
  uploadToR2,
  isStorageConfigured,
  type FileUploadResult,
  type CloudinaryUpload,
} from './storage.js';

export { uploadFile, uploadToR2, isStorageConfigured, type FileUploadResult, type CloudinaryUpload };

/**
 * Upload one file using the environment-appropriate storage backend
 * (Cloudinary in dev/staging, Cloudflare R2 in production).
 */
export async function uploadToCloudinary(
  file: Buffer,
  name: string,
  mime: string,
  folder = 'risk-attachments',
): Promise<FileUploadResult> {
  return uploadFile(file, name, mime, folder);
}

export { uploadDirectCloudinary };
