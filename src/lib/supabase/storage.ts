/**
 * Supabase Storage Utilities
 * Handles file uploads for car spotting photos and videos
 */

import { createAdminClient } from './server';

const BUCKET_NAME = 'car-spottings';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for videos
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

export interface FileValidation {
  valid: boolean;
  error?: string;
  type: 'image' | 'video' | 'unknown';
}

/**
 * Validate file type and size
 */
export function validateFile(file: File): FileValidation {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type}. Allowed: JPG, PNG, WEBP, HEIC, MP4, MOV, WEBM`,
      type: 'unknown',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 50MB`,
      type: isImage ? 'image' : 'video',
    };
  }

  // Videos under 60 seconds check would require reading the file
  // We'll trust the client-side validation for now

  return {
    valid: true,
    type: isImage ? 'image' : 'video',
  };
}

/**
 * Generate unique file path for storage
 */
function generateFilePath(userId: string, fileName: string, type: 'image' | 'video' | 'unknown'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
  const folder = type === 'video' ? 'videos' : 'photos';

  return `${userId}/${folder}/${timestamp}-${random}.${ext}`;
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(
  file: File,
  userId: string
): Promise<UploadResult> {
  try {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const supabase = createAdminClient();

    // Ensure bucket exists (create if not)
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES],
      });

      if (createError) {
        console.error('Failed to create bucket:', createError);
        return { success: false, error: 'Failed to initialize storage' };
      }
    }

    // Generate file path
    const filePath = generateFilePath(userId, file.name, validation.type);

    // Convert File to ArrayBuffer for server-side upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
}

/**
 * Get signed URL for private files (if needed)
 */
export async function getSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Signed URL error:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Signed URL error:', error);
    return null;
  }
}
