import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { db } from '@/lib/db';
import { signups } from '@/lib/db/schema';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOTIFY_TO = process.env.NOTIFY_EMAIL || 'arach@hudsonos.com';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

// Simple in-memory rate limiting
const rateMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 60_000; // 1 minute
  const max = 3;

  const timestamps = (rateMap.get(ip) || []).filter((t) => now - t < window);
  if (timestamps.length >= max) return true;
  timestamps.push(now);
  rateMap.set(ip, timestamps);
  return false;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  const { email, message, useCase, context, honeypot } = await request.json();

  // Honeypot
  if (honeypot) {
    return NextResponse.json({ success: true });
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 }
    );
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    // Store in database
    await db.insert(signups).values({
      email: cleanEmail,
      useCase: useCase || null,
      context: context || null,
      ip: ip === 'unknown' ? null : ip,
    });

    if (process.env.RESEND_API_KEY) {
      await getResend().emails.send({
        from: 'Hudson <hello@hudsonos.com>',
        to: NOTIFY_TO,
        subject: `Hudson interest from ${cleanEmail}`,
        html: `
<div style="font-family: monospace; padding: 20px;">
  <h2>New Hudson Interest</h2>
  <p><strong>Email:</strong> ${cleanEmail}</p>
  ${useCase ? `<p><strong>Use case:</strong> ${useCase}</p>` : ''}
  ${context ? `<p><strong>Context:</strong> ${context}</p>` : ''}
  ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
  <p style="color: #666; font-size: 12px;">Sent from hudsonos.com</p>
</div>`.trim(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
