import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { StorageService } from '@/services/storageService';
import { Quote } from '@/types';
import { getDb } from '@/services/mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    // Verify user is authenticated and has admin/superadmin role
    if (!session || !(session as any).isLoggedIn) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userRole = (session as any).role || 'user';
    if (!['ADMIN', 'SUPERADMIN'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Only admins can complete projects' },
        { status: 403 }
      );
    }

    const { quoteId, approvalNotes } = await request.json();

    if (!quoteId) {
      return NextResponse.json(
        { error: 'Quote ID is required' },
        { status: 400 }
      );
    }

    // Get the quote from Firestore
    const db = await getDb();
    const quoteDoc = await db.collection('quotes').findOne({ id: quoteId });
    const quote = quoteDoc ? (({ _id, ...rest }) => rest)(quoteDoc) as Quote : undefined;

    if (!quote) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    // Check if project is already completed by installer
    if (!quote.completedAt || !quote.completedBy) {
      return NextResponse.json(
        { error: 'Project must be completed by installer first' },
        { status: 400 }
      );
    }

    // Update quote with admin approval
    const updatedQuote: Quote = {
      ...quote,
      phase: 'completed',
      adminApprovedAt: new Date(),
      adminApprovedBy: (session as any).username,
      adminApprovalNotes: approvalNotes || '',
    };

    // Save to Firestore
    await db.collection('quotes').replaceOne({ id: quoteId }, updatedQuote, { upsert: true });

    return NextResponse.json(
      {
        success: true,
        message: 'Project completion approved',
        quote: updatedQuote,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error completing project:', error);
    return NextResponse.json(
      { error: 'Failed to complete project' },
      { status: 500 }
    );
  }
}
