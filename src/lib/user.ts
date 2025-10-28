
'use server';

import { getSession } from './session';
import prisma from './prisma';
import type { User as AuthUser, Permissions } from '@/lib/types';

export async function getUserFromSession() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        role: true,
        loanProvider: true,
      },
    });

    if (!user) {
      return null;
    }
    
    const { password, ...userWithoutPassword } = user;
    
    const authUser: AuthUser = {
      ...userWithoutPassword,
      role: user.role.name as AuthUser['role'],
      providerName: user.loanProvider?.name,
      permissions: JSON.parse(user.role.permissions as string) as Permissions,
    };

    return authUser;

  } catch (error) {
    console.error('Get User Error:', error);
    return null;
  }
}
