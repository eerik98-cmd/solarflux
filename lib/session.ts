/**
 * Session Management with Iron Session
 * Handles secure session creation, retrieval, and destruction
 */

import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { SessionData } from '@/types';

const sessionOptions = {
  password: process.env.SESSION_SECRET || '7yVNEdYpXy0b6GcanlsQpJLAxTTGuXfrwjKPiN5e/dM=',
  cookieName: 'solarflux_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  },
};

/**
 * Get the current session
 * @returns Session object
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/**
 * Create a new session for a user
 * @param userId User ID
 * @param username Username
 * @param role User role
 * @param nickname User nickname
 */
export async function createSession(
  userId: string,
  username: string,
  role: string,
  nickname: string
): Promise<void> {
  const session = await getSession();
  session.userId = userId;
  session.username = username;
  session.role = role;
  session.nickname = nickname;
  session.isLoggedIn = true;
  await session.save();
}

/**
 * Destroy the current session (logout)
 */
export async function destroySession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

/**
 * Check if user is authenticated
 * @returns True if user has valid session
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.isLoggedIn === true && !!session.userId;
}

/**
 * Get current user from session
 * @returns User data or null if not authenticated
 */
export async function getCurrentUser(): Promise<{
  userId: string;
  username: string;
  role: string;
  nickname: string;
} | null> {
  const session = await getSession();
  
  if (!session.isLoggedIn || !session.userId) {
    return null;
  }
  
  return {
    userId: session.userId,
    username: session.username,
    role: session.role,
    nickname: session.nickname,
  };
}
