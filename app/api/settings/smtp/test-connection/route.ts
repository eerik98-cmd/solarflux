import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import nodemailer from 'nodemailer';

/**
 * POST - Test SMTP connection
 * Body: { host, port, secure, username, password }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    const { host, port, secure, username, password } = await request.json();

    if (!host || !port || !username || !password) {
      return NextResponse.json(
        { error: 'Missing required fields for connection test' },
        { status: 400 }
      );
    }

    // Create transporter with provided settings
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port.toString()),
      secure: Boolean(secure),
      auth: {
        user: username,
        pass: password,
      },
    });

    // Verify connection
    await transporter.verify();

    return NextResponse.json({
      success: true,
      message: `Successfully connected to ${host}:${port}`,
    });

  } catch (error) {
    console.error('SMTP connection test error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide helpful error messages
    let userMessage = errorMessage;
    
    if (errorMessage.includes('EAUTH')) {
      userMessage = 'Authentication failed. Check your username and password.';
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
      userMessage = 'Could not connect to server. Check host and port.';
    } else if (errorMessage.includes('ETIMEDOUT')) {
      userMessage = 'Connection timed out. Check your network or firewall settings.';
    } else if (errorMessage.includes('CERT') || errorMessage.includes('SSL')) {
      userMessage = 'SSL/TLS error. Try changing the "Use TLS/SSL" setting.';
    }

    return NextResponse.json(
      { error: userMessage, details: errorMessage },
      { status: 500 }
    );
  }
}
