import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import libre from 'libreoffice-convert';
import { promisify } from 'util';

const convertAsync = promisify(libre.convert);

/**
 * Convert DOCX to PDF using LibreOffice
 * POST /api/convert-docx-to-pdf
 * Body: { docxBase64: string }
 * Returns: { pdfBase64: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { docxBase64 } = await request.json();

    if (!docxBase64) {
      return NextResponse.json({ error: 'Missing docxBase64 in request body' }, { status: 400 });
    }

    // Convert base64 to buffer
    const docxBuffer = Buffer.from(docxBase64, 'base64');

    // Convert DOCX to PDF using LibreOffice
    const pdfBuffer = await convertAsync(docxBuffer, '.pdf', undefined) as Buffer;

    // Convert PDF buffer back to base64
    const pdfBase64 = pdfBuffer.toString('base64');

    return NextResponse.json({
      pdfBase64,
      size: pdfBuffer.length
    });

  } catch (error) {
    console.error('PDF conversion error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to convert document: ${errorMessage}` },
      { status: 500 }
    );
  }
}
