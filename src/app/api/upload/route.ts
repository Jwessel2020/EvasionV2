import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

// Use local storage for development
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'spottings');

/**
 * POST /api/upload
 * Handles file uploads for car spotting photos and videos
 * Uses local file storage for development
 *
 * Request: multipart/form-data with 'file' field
 * Response: { success: true, url: string, type: 'image' | 'video' }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const uploaderId = userId || 'anonymous';

    // Validate file type
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${file.type}. Allowed: JPG, PNG, WEBP, HEIC, MP4, MOV, WEBM`
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 50MB`
        },
        { status: 400 }
      );
    }

    // Generate file path
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop()?.toLowerCase() || (isImage ? 'jpg' : 'mp4');
    const folder = isVideo ? 'videos' : 'photos';
    const fileName = `${timestamp}-${random}.${ext}`;
    const subDir = path.join(UPLOAD_DIR, uploaderId, folder);
    const filePath = path.join(subDir, fileName);

    // Ensure directory exists
    await mkdir(subDir, { recursive: true });

    // Convert File to Buffer and save
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);

    // Return public URL
    const publicUrl = `/uploads/spottings/${uploaderId}/${folder}/${fileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: filePath,
      type: isVideo ? 'video' : 'image',
      size: file.size,
      mimeType: file.type,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload
 * Delete a previously uploaded file
 */
export async function DELETE(request: NextRequest) {
  try {
    const { path: filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: 'No file path provided' },
        { status: 400 }
      );
    }

    // For local files, we'd use fs.unlink
    // For now, just return success (files will be cleaned up manually)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Delete failed' },
      { status: 500 }
    );
  }
}
