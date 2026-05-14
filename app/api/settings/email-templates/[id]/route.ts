import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { StorageService } from '@/services/storageService';

/**
 * DELETE - Remove an email template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Delete from MongoDB
    await StorageService.deleteItem('emailTemplates', id);

    return NextResponse.json({
      success: true,
      message: 'Email template deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting email template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to delete email template: ${errorMessage}` },
      { status: 500 }
    );
  }
}
