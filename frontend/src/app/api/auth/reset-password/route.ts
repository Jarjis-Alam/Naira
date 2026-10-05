import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * GET /api/auth/reset-password?token=...
 * Validates whether a token is active and unexpired without consuming it.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawToken = searchParams.get("token");

    if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
      return NextResponse.json(
        { valid: false, error: "Missing or invalid token parameter." },
        { status: 400 }
      );
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken.trim())
      .digest("hex");

    const tokens = await db
      .select({
        id: passwordResetTokens.id,
        expiresAt: passwordResetTokens.expiresAt,
        usedAt: passwordResetTokens.usedAt,
      })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    if (tokens.length === 0) {
      return NextResponse.json(
        { valid: false, error: "Invalid password reset link." },
        { status: 404 }
      );
    }

    const record = tokens[0];

    if (record.usedAt !== null) {
      return NextResponse.json(
        { valid: false, error: "This password reset link has already been used." },
        { status: 410 }
      );
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json(
        { valid: false, error: "This password reset link has expired. Please request a new one." },
        { status: 410 }
      );
    }

    return NextResponse.json({ valid: true }, { status: 200 });
  } catch (error) {
    console.error("[reset-password-verify] Unexpected error:", error);
    return NextResponse.json(
      { valid: false, error: "Unable to verify reset token at this time." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/reset-password
 * Consumes token and sets new password hash with bcryptjs.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`reset_pw_${ip}`, {
      limit: 10,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many reset attempts. Please wait a minute before trying again." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const validation = resetPasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input data." },
        { status: 400 }
      );
    }

    const { token, password } = validation.data;
    const tokenHash = crypto
      .createHash("sha256")
      .update(token.trim())
      .digest("hex");

    const tokens = await db
      .select({
        id: passwordResetTokens.id,
        userId: passwordResetTokens.userId,
        expiresAt: passwordResetTokens.expiresAt,
        usedAt: passwordResetTokens.usedAt,
      })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: "Invalid or unrecognized password reset link." },
        { status: 400 }
      );
    }

    const record = tokens[0];

    if (record.usedAt !== null) {
      return NextResponse.json(
        { error: "This password reset link has already been used." },
        { status: 400 }
      );
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json(
        { error: "This password reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Hash new password using bcryptjs with cost factor 12
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user credentials
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, record.userId));

    // Mark reset token as consumed
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, record.id));

    return NextResponse.json(
      { message: "Your password has been successfully reset. You may now sign in." },
      { status: 200 }
    );
  } catch (error) {
    console.error("[reset-password] Unexpected error:", error);
    return NextResponse.json(
      { error: "Password reset service is temporarily unavailable." },
      { status: 500 }
    );
  }
}
