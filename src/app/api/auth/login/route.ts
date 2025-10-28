
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit-log';

export async function POST(req: NextRequest) {
  const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'N/A';
  const userAgent = req.headers.get('user-agent') || 'N/A';

  try {
    const { phoneNumber, password } = await req.json();

    if (!phoneNumber || !password) {
      return NextResponse.json({ error: 'Phone number and password are required.' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { phoneNumber },
      include: { role: true },
    });

    if (!user) {
      const logDetails = {
          reason: 'User not found',
          attemptedPhoneNumber: phoneNumber,
      };
      await createAuditLog({
        actorId: 'anonymous',
        action: 'USER_LOGIN_FAILURE',
        ipAddress,
        userAgent,
        details: logDetails,
      });
      console.log(JSON.stringify({ ...logDetails, timestamp: new Date().toISOString(), action: 'USER_LOGIN_FAILURE', ipAddress, userAgent }));
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
       const logDetails = {
            reason: 'Invalid password',
            userId: user.id,
            attemptedPhoneNumber: phoneNumber,
       };
       await createAuditLog({
           actorId: user.id,
           action: 'USER_LOGIN_FAILURE',
           ipAddress,
           userAgent,
           details: logDetails
       });
       console.log(JSON.stringify({ ...logDetails, timestamp: new Date().toISOString(), action: 'USER_LOGIN_FAILURE', ipAddress, userAgent }));
       return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Create a session for the user
    await createSession(user.id);
    
    const logDetails = {
        role: user.role.name,
    };
    await createAuditLog({
        actorId: user.id,
        action: 'USER_LOGIN_SUCCESS',
        ipAddress,
        userAgent,
        details: logDetails
    });
    console.log(JSON.stringify({ ...logDetails, timestamp: new Date().toISOString(), action: 'USER_LOGIN_SUCCESS', userId: user.id, ipAddress, userAgent }));

    return NextResponse.json({ message: 'Login successful' }, { status: 200 });

  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
