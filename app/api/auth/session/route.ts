import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

/**
 * GET /api/auth/session
 * Get current user session
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { isAuthenticated: false, user: null },
        { status: 401 }
      );
    }
    
    return NextResponse.json({
      isAuthenticated: true,
      user: {
        id: user.userId,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { isAuthenticated: false, user: null },
      { status: 500 }
    );
  }
}
