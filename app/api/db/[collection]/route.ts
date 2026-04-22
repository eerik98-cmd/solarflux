import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/services/mongodb';

type Params = { params: { collection: string } };

const ALLOWED_COLLECTIONS = [
  'inventory',
  'clients',
  'quotes',
  'users',
  'teamMessages',
  'installerReports',
  'installerReminders',
  'equipmentTrackingEntries',
  'templates',
  'companyDocuments',
];

function isAllowed(col: string): boolean {
  return ALLOWED_COLLECTIONS.includes(col);
}

// GET /api/db/[collection]          → get all
// GET /api/db/[collection]?id=xxx   → get one
export async function GET(req: NextRequest, { params }: Params) {
  const { collection } = params;
  if (!isAllowed(collection)) {
    return NextResponse.json({ error: 'Collection not allowed' }, { status: 403 });
  }

  try {
    const db = await getDb();
    const id = req.nextUrl.searchParams.get('id');

    if (id) {
      const item = await db.collection(collection).findOne({ id });
      if (!item) return NextResponse.json(null);
      const { _id, ...rest } = item;
      return NextResponse.json(rest);
    }

    const items = await db.collection(collection).find({}).toArray();
    return NextResponse.json(items.map(({ _id, ...rest }) => rest));
  } catch (error: any) {
    console.error(`GET /api/db/${collection} error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/db/[collection]  body: { item: {...} }  → upsert by item.id
export async function POST(req: NextRequest, { params }: Params) {
  const { collection } = params;
  if (!isAllowed(collection)) {
    return NextResponse.json({ error: 'Collection not allowed' }, { status: 403 });
  }

  try {
    const { item } = await req.json();
    if (!item?.id) {
      return NextResponse.json({ error: 'Item must have an id field' }, { status: 400 });
    }

    const db = await getDb();
    await db.collection(collection).replaceOne({ id: item.id }, item, { upsert: true });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`POST /api/db/${collection} error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/db/[collection]?id=xxx
export async function DELETE(req: NextRequest, { params }: Params) {
  const { collection } = params;
  if (!isAllowed(collection)) {
    return NextResponse.json({ error: 'Collection not allowed' }, { status: 403 });
  }

  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query parameter required' }, { status: 400 });
    }

    const db = await getDb();
    await db.collection(collection).deleteOne({ id });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`DELETE /api/db/${collection} error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
