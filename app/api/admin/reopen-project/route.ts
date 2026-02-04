import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { Quote } from '@/types';
import { collection, query, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';

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
        { error: 'Only admins can reopen projects' },
        { status: 403 }
      );
    }

    const { quoteId, reopenReason } = await request.json();

    if (!quoteId) {
      return NextResponse.json(
        { error: 'Quote ID is required' },
        { status: 400 }
      );
    }

    // Get the quote from Firestore
    if (!db) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const q = query(collection(db, 'quotes'));
    const snapshot = await getDocs(q);
    const quote = snapshot.docs.find(d => d.data().id === quoteId)?.data() as Quote | undefined;

    if (!quote) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    // Check if project is actually completed
    if (!quote.completedAt || !quote.adminApprovedAt) {
      return NextResponse.json(
        { error: 'Only completed projects can be reopened' },
        { status: 400 }
      );
    }

    const adminUser = (session as any).username;
    const reopenEntry = {
      reopenedAt: new Date(),
      reopenedBy: adminUser,
      reopenReason: reopenReason || 'No reason provided',
    };

    // Update quote: reopen it and track the reopening
    const updatedQuote: Quote = {
      ...quote,
      phase: 'in-progress',
      reopenedAt: new Date(),
      reopenedBy: adminUser,
      reopenReason: reopenReason || 'No reason provided',
      reopenHistory: [...(quote.reopenHistory || []), reopenEntry],
      // Clear admin approval when reopening
      adminApprovedAt: undefined,
      adminApprovedBy: undefined,
    };

    // Save to Firestore
    await setDoc(doc(db, 'quotes', quoteId), updatedQuote);

    return NextResponse.json(
      {
        success: true,
        message: 'Project reopened for edits',
        quote: updatedQuote,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error reopening project:', error);
    return NextResponse.json(
      { error: 'Failed to reopen project' },
      { status: 500 }
    );
  }
}
