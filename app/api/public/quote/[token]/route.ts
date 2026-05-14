import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/services/mongodb';

// Public endpoint — no auth required.
// GET /api/public/quote/[token]  → returns the quote with matching shareToken
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
    const doc = await db.collection('quotes').findOne({ shareToken: token });
    if (!doc) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    await db.collection('quotes').updateOne(
      { id: doc.id },
      {
        $set: {
          publicLinkLastOpenedAt: nowIso,
          publicLinkFirstOpenedAt: doc.publicLinkFirstOpenedAt || nowIso,
        },
        $inc: { publicLinkOpenCount: 1 },
      }
    );

    const { _id, ...rest } = doc;
    return NextResponse.json({
      ...rest,
      publicLinkLastOpenedAt: nowIso,
      publicLinkFirstOpenedAt: doc.publicLinkFirstOpenedAt || nowIso,
      publicLinkOpenCount: (doc.publicLinkOpenCount || 0) + 1,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/public/quote/[token]  body: { clientSignature: { name, dataUrl, signedAt } }
// Used by the public page when the client signs.
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
    const { clientSignature } = body;
    if (!clientSignature?.name || !clientSignature?.dataUrl) {
      return NextResponse.json({ error: 'Invalid signature data' }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection('quotes').updateOne(
      { shareToken: token, isLocked: { $ne: true } }, // cannot re-sign a locked quote
      {
        $set: {
          clientSignature: {
            name: clientSignature.name,
            dataUrl: clientSignature.dataUrl,
            signedAt: new Date().toISOString(),
          },
          isLocked: true,
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Quote not found or already locked' }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
