import { NextRequest, NextResponse } from 'next/server';
import { StorageService } from '@/services/storageService';
import { getCurrentUser } from '@/lib/session';
import { collection, query, getDocs, doc } from 'firebase/firestore';
import { db } from '@/services/firebase';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is installer
    if (currentUser.role !== 'INSTALLER') {
      return NextResponse.json({ error: 'Forbidden: Only installers can complete jobs' }, { status: 403 });
    }

    const { quoteId, consumptionData, extraItems, completionNotes } = await request.json();

    if (!quoteId) {
      return NextResponse.json({ error: 'Quote ID is required' }, { status: 400 });
    }

    // Get the quote
    const q = query(collection(db, 'quotes'));
    const snapshot = await getDocs(q);
    const quotes = snapshot.docs.map(doc => doc.data());
    const quote = quotes.find((q: any) => q.id === quoteId);

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Update quote with completion data
    const updatedQuote = {
      ...quote,
      completedAt: new Date().toISOString(),
      completedBy: currentUser.nickname,
      consumptionData,
      extraItems,
      completionNotes,
      materialVariances: consumptionData.map((item: any) => ({
        description: item.description,
        quoted: item.quotedQty,
        consumed: item.consumedQty,
        delta: item.consumedQty - item.quotedQty,
        cost: (item.consumedQty - item.quotedQty) * item.netPrice,
      })),
    };

    // Save updated quote
    await StorageService.saveItem('quotes', updatedQuote);

    return NextResponse.json({
      success: true,
      message: 'Job completed successfully',
      quote: updatedQuote,
    });
  } catch (error) {
    console.error('Error completing job:', error);
    return NextResponse.json({ error: 'Failed to complete job' }, { status: 500 });
  }
}
