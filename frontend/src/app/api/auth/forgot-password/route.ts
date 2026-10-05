import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/server/email";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
});

const GENERIC_RESPONSE_MESSAGE =
  "If an account exists for this email, a password recovery link has been sent.";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`forgot_pw_${ip}`, {
      limit: 5,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many password reset requests. Please wait a moment before trying again." },
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

    const validation = forgotPasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid email address." },
        { status: 400 }
      );
    }

    const cleanEmail = validation.data.email.toLowerCase().trim();

    // Look up the account
    const existingUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (existingUsers.length > 0) {
      const user = existingUsers[0];

      // Invalidate any existing active reset tokens for this user
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            isNull(passwordResetTokens.usedAt)
          )
        );

      // Generate cryptographically secure random token (256-bit entropy)
      const rawToken = crypto.randomBytes(32).toString("hex");

      // Compute SHA-256 hash for database persistence
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      // Token expires in 1 hour (3600 seconds)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      // Construct reset URL using canonical application URL
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.AUTH_URL ||
        "http://localhost:3000";
      const resetUrl = `${appUrl.replace(/\/$/, "")}/auth/reset-password?token=${rawToken}`;

      // Dispatch transactional email via Resend
      const emailResult = await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
      });

      if (!emailResult.success) {
        console.warn(
          "[forgot-password] Email dispatch failed for user:",
          user.id,
          emailResult.error
        );
      }
    }

    // Always return generic response to prevent account enumeration
    return NextResponse.json(
      { message: GENERIC_RESPONSE_MESSAGE },
      { status: 200 }
    );
  } catch (error) {
    console.error("[forgot-password] Unexpected error:", error);
    return NextResponse.json(
      { error: "Password recovery service is temporarily unavailable." },
      { status: 500 }
    );
  }
}
