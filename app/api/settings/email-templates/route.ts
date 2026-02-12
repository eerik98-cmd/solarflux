import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { EmailTemplate } from '@/types';
import { StorageService } from '@/services/storageService';

/**
 * GET - Load all email templates
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await StorageService.getAllItems('emailTemplates');

    return NextResponse.json({
      templates: templates || [],
    });

  } catch (error) {
    console.error('Error loading email templates:', error);
    return NextResponse.json(
      { error: 'Failed to load email templates' },
      { status: 500 }
    );
  }
}

/**
 * POST - Save email template (create or update)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, category, subject, body: templateBody, variables, createdAt, updatedBy } = body;

    // Validate required fields
    if (!name || !category || !subject || !templateBody) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, subject, body' },
        { status: 400 }
      );
    }

    const emailTemplate: EmailTemplate = {
      id: id || Date.now().toString(),
      name,
      category,
      subject,
      body: templateBody,
      variables: variables || [],
      createdAt: createdAt ? new Date(createdAt) : new Date(),
      updatedAt: new Date(),
      createdBy: createdAt ? body.createdBy : session.username,
      updatedBy: updatedBy || session.username,
    };

    // Save to Firebase using StorageService
    await StorageService.saveItem('emailTemplates', emailTemplate);

    return NextResponse.json({
      success: true,
      message: 'Email template saved successfully',
      template: emailTemplate,
    });

  } catch (error) {
    console.error('Error saving email template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to save email template: ${errorMessage}` },
      { status: 500 }
    );
  }
}
