import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { encryptSmtpPassword } from '@/lib/encryption';
import { SmtpSettings } from '@/types';
import { getDb } from '@/services/mongodb';

/**
 * GET - Load SMTP settings
 * Returns SMTP settings (without decrypted password)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    const db = await getDb();
    const settings = await db.collection('smtpSettings').findOne({ id: 'default' });

    if (!settings) {
      return NextResponse.json({ settings: null });
    }

    const { _id: _ignored, ...settingsData } = settings as any;
    
    // Don't send encrypted password to frontend
    return NextResponse.json({
      settings: {
        ...settingsData,
        password: '', // Omit password for security
      },
    });

  } catch (error) {
    console.error('Error loading SMTP settings:', error);
    return NextResponse.json(
      { error: 'Failed to load SMTP settings' },
      { status: 500 }
    );
  }
}

/**
 * POST - Save SMTP settings
 * Body: SmtpSettings (with plain text password)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    const body = await request.json();
    const { host, port, secure, username, password, fromEmail, fromName, replyTo, signature, updatedBy } = body;

    // Validate required fields
    if (!host || !port || !username || !fromEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: host, port, username, fromEmail' },
        { status: 400 }
      );
    }

    // Only encrypt password if it's provided (not empty)
    let encryptedPassword = '';
    if (password) {
      encryptedPassword = encryptSmtpPassword(password);
    } else {
      // If password is empty, keep existing password
      const db = await getDb();
      const existingSettings = await db.collection('smtpSettings').findOne({ id: 'default' });
      if (existingSettings) {
        encryptedPassword = existingSettings.password;
      } else {
        return NextResponse.json(
          { error: 'Password is required for initial setup' },
          { status: 400 }
        );
      }
    }

    const smtpSettings: SmtpSettings = {
      id: 'default',
      host,
      port: parseInt(port.toString()),
      secure: Boolean(secure),
      username,
      password: encryptedPassword,
      fromEmail,
      fromName: fromName || 'SolarFlux',
      replyTo: replyTo || undefined,
      signature: signature || undefined,
      updatedAt: new Date(),
      updatedBy: updatedBy || session.username,
    };

    // Save to MongoDB directly (StorageService uses relative fetch URLs, unusable server-side)
    const db = await getDb();
    await db.collection('smtpSettings').replaceOne({ id: 'default' }, smtpSettings, { upsert: true });

    return NextResponse.json({
      success: true,
      message: 'SMTP settings saved successfully',
    });

  } catch (error) {
    console.error('Error saving SMTP settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to save SMTP settings: ${errorMessage}` },
      { status: 500 }
    );
  }
}
