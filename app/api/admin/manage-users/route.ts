import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { StorageService } from '@/services/storageService';
import { getCurrentUser } from '@/lib/session';
import { User } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can manage users
    if (currentUser.role !== 'SUPER_ADMIN') {
      console.warn(`User ${currentUser.username} (${currentUser.role}) attempted to create user without SUPER_ADMIN role`);
      return NextResponse.json({ error: 'Only Super Admins can manage users' }, { status: 403 });
    }

    const body = await request.json();
    const { action, user, userId } = body;

    if (action === 'add-user') {
      if (!user || !user.username || !user.password || !user.nickname) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const newUser: User = {
        ...user,
        id: user.id || Date.now().toString(),
        password: await hashPassword(user.password),
      };

      await StorageService.saveItem('users', newUser);
      console.log(`User ${newUser.username} created by ${currentUser.username}`);
      return NextResponse.json({ success: true, message: 'User created successfully' });
    }

    if (action === 'fix-password') {
      // This action fixes unhashed passwords for existing users
      if (!userId || !user || !user.password) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const hashedPassword = await hashPassword(user.password);
      const updatedUser: User = {
        ...user,
        id: userId,
        password: hashedPassword,
      };

      await StorageService.saveItem('users', updatedUser);
      console.log(`Password hashed for user ${user.username}`);
      return NextResponse.json({ success: true, message: 'Password hashed successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in user management API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
