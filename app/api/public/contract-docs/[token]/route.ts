import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/services/mongodb';
import fs from 'fs';
import path from 'path';

// Public endpoint — no auth required.
// GET  /api/public/contract-docs/[token]  → returns the contractDocRequests record
// PATCH /api/public/contract-docs/[token] → client uploads a file for a specific request

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;
  if (!token || token.length < 8) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const doc = await db.collection('contractDocRequests').findOne({ shareToken: token });
    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const { _id, ...rest } = doc;
    return NextResponse.json(rest);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;
  if (!token || token.length < 8) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { requestId, fileName, base64 } = body as {
      requestId: string;
      fileName: string;
      base64: string;
    };

    if (!requestId || !fileName || !base64) {
      return NextResponse.json({ error: 'Missing requestId, fileName, or base64' }, { status: 400 });
    }

    const db = await getDb();
    const doc = await db.collection('contractDocRequests').findOne({ shareToken: token });
    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Write file to disk
    const matches = base64.match(/^data:([^;]+);base64,(.+)$/s);
    if (!matches) {
      return NextResponse.json({ error: 'Invalid base64 data URL' }, { status: 400 });
    }
    const [, , data] = matches;
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const relativePath = `contractDocs/${doc.id}/${requestId}_${Date.now()}_${safeFileName}`;
    const absPath = path.join(UPLOADS_DIR, relativePath);

    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, Buffer.from(data, 'base64'));

    const fileUrl = `/uploads/${relativePath}`;
    const uploadedAt = new Date().toISOString();

    // Update the specific request in the array
    const updatedRequests = (doc.requests || []).map((r: any) =>
      r.id === requestId
        ? { ...r, status: 'received', uploadedFileUrl: fileUrl, uploadedFileName: fileName, uploadedAt }
        : r
    );

    await db.collection('contractDocRequests').updateOne(
      { shareToken: token },
      {
        $set: {
          requests: updatedRequests,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json({ success: true, fileUrl, uploadedAt });
  } catch (err: any) {
    console.error('contract-docs PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
