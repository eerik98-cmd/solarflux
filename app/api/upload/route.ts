import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Allow large file uploads (base64 encoded files can be large)
export const maxDuration = 60;

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function POST(request: NextRequest) {
  try {
    const { base64, filePath } = await request.json();

    if (!base64 || !filePath) {
      return NextResponse.json({ error: 'Missing base64 or filePath' }, { status: 400 });
    }

    // Prevent path traversal
    const resolvedPath = path.resolve(UPLOADS_DIR, filePath);
    if (!resolvedPath.startsWith(UPLOADS_DIR)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    // Extract MIME type and binary data from data URL
    const matches = base64.match(/^data:([^;]+);base64,(.+)$/s);
    if (!matches) {
      return NextResponse.json({ error: 'Invalid base64 data URL' }, { status: 400 });
    }
    const [, mimeType, data] = matches;
    const buffer = Buffer.from(data, 'base64');

    // Derive file extension from MIME type if not already in filePath
    const hasExt = path.extname(filePath).length > 0;
    const finalPath = hasExt ? resolvedPath : resolvedPath + mimeTypeToExt(mimeType);
    const finalRelative = hasExt ? filePath : filePath + mimeTypeToExt(mimeType);

    // Create directories recursively
    fs.mkdirSync(path.dirname(finalPath), { recursive: true });

    // Write file
    fs.writeFileSync(finalPath, buffer);

    return NextResponse.json({ url: `/uploads/${finalRelative}` });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

function mimeTypeToExt(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
  };
  return map[mime] ?? '';
}
