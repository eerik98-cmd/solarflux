import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { decryptSmtpPassword } from '@/lib/encryption';
import nodemailer from 'nodemailer';
import { SmtpSettings } from '@/types';
import { getDb } from '@/services/mongodb';

/**
 * Send email with PDF attachment
 * POST /api/email/send
 * Body: {
 *   to: string;
 *   subject: string;
 *   body: string;
 *   pdfBase64: string;
 *   pdfFileName: string;
 *   quoteId?: string; // Optional: for email history tracking
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body, pdfBase64, pdfFileName, quoteId } = await request.json();

    // Validate required fields
    if (!to || !subject || !pdfBase64 || !pdfFileName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, pdfBase64, pdfFileName' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Fetch SMTP settings from MongoDB
    const db = await getDb();
    const smtpDoc = await db.collection('smtpSettings').findOne({ id: 'default' });
    const { _id: _ignored, ...smtpSettings } = (smtpDoc ?? {}) as any;
    const smtpSettingsValid = smtpDoc != null;

    if (!smtpSettingsValid) {
      return NextResponse.json(
        { error: 'SMTP settings not configured. Please configure email settings in Settings page.' },
        { status: 400 }
      );
    }

    // Decrypt password
    let decryptedPassword: string;
    try {
      decryptedPassword = decryptSmtpPassword(smtpSettings.password);
    } catch (error) {
      console.error('Failed to decrypt SMTP password:', error);
      return NextResponse.json(
        { error: 'Failed to decrypt SMTP credentials. Please reconfigure email settings.' },
        { status: 500 }
      );
    }

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.secure,
      auth: {
        user: smtpSettings.username,
        pass: decryptedPassword,
      },
    });

    // Convert base64 PDF to buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Send email
    const info = await transporter.sendMail({
      from: `"${smtpSettings.fromName}" <${smtpSettings.fromEmail}>`,
      to,
      subject,
      html: body,
      replyTo: smtpSettings.replyTo || smtpSettings.fromEmail,
      attachments: [
        {
          filename: pdfFileName,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    // Update quote with email history if quoteId provided
    if (quoteId) {
      try {
        const { _id: _qIgnored, ...quote } = (await db.collection('quotes').findOne({ id: quoteId }) ?? {}) as any;
        
        if (quote?.id) {
          const emailHistory = quote.emailHistory || [];
          
          const updatedQuote = {
            ...quote,
            emailSentAt: new Date(),
            emailSentTo: to,
            emailSentBy: session.username,
            emailHistory: [
              ...emailHistory,
              {
                sentAt: new Date(),
                sentTo: to,
                sentBy: session.username,
                documentName: pdfFileName,
              },
            ],
          };
          
          await db.collection('quotes').replaceOne({ id: quoteId }, updatedQuote, { upsert: true });
        }
      } catch (error) {
        console.error('Failed to update quote email history:', error);
        // Don't fail the request if history update fails
      }
    }

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      recipient: to,
    });

  } catch (error) {
    console.error('Email sending error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide more helpful error messages
    if (errorMessage.includes('EAUTH') || errorMessage.includes('auth')) {
      return NextResponse.json(
        { error: 'SMTP authentication failed. Please check your email credentials in Settings.' },
        { status: 500 }
      );
    }
    
    if (errorMessage.includes('ECONNECTION') || errorMessage.includes('ETIMEDOUT')) {
      return NextResponse.json(
        { error: 'Failed to connect to email server. Please check your SMTP settings.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: `Failed to send email: ${errorMessage}` },
      { status: 500 }
    );
  }
}
