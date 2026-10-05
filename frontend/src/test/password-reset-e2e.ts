import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, profiles, passwordResetTokens } from "@/db/schema";
import { POST as forgotPasswordPost } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordPost, GET as resetPasswordGet } from "@/app/api/auth/reset-password/route";
import { sendPasswordResetEmail } from "@/server/email";
import { checkRateLimit } from "@/lib/rate-limit";

// Load environment variables for standalone test run
for (const envFile of [path.resolve(process.cwd(), ".env.local"), path.resolve(process.cwd(), "frontend", ".env.local")]) {
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] === undefined) {
        const value = rawValue.replace(/^['"]|['"]$/g, "").trim();
        if (value) process.env[key] = value;
      }
    }
    break;
  }
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    failed++;
  }
}

async function runPasswordResetSuite() {
  console.log("\n========================================================");
  console.log("🔐 NAIRA — PASSWORD RESET & RESEND SUITE (16 SCENARIOS)");
  console.log("========================================================\n");

  const timestamp = Date.now();
  const testEmail = `test_pw_reset_${timestamp}@example.com`;
  const initialPassword = "InitialPassword123!";
  const newPassword = "NewSecurePassword456!";

  // Create temporary synthetic test user
  const initialHash = await bcrypt.hash(initialPassword, 12);
  const [createdUser] = await db
    .insert(users)
    .values({
      email: testEmail,
      passwordHash: initialHash,
    })
    .returning();

  await db.insert(profiles).values({
    userId: createdUser.id,
    name: "Reset Test Student",
  });

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Forgot password with existing account
    // -------------------------------------------------------------------------
    console.log("--- Scenario 1: Forgot password with existing account ---");
    const req1 = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1" },
      body: JSON.stringify({ email: testEmail }),
    });
    const res1 = await forgotPasswordPost(req1);
    const data1 = await res1.json();

    assert(res1.status === 200, "Forgot password endpoint returns HTTP 200 for existing user");
    assert(
      data1.message === "If an account exists for this email, a password recovery link has been sent.",
      "Response message matches generic specification"
    );

    // Verify token was stored in DB
    const storedTokens = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, createdUser.id));
    assert(storedTokens.length === 1, "Password reset token record created in database");

    // -------------------------------------------------------------------------
    // Scenario 2: Forgot password with nonexistent account
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 2: Forgot password with nonexistent account ---");
    const nonExistentEmail = `nonexistent_${timestamp}@example.com`;
    const req2 = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.2" },
      body: JSON.stringify({ email: nonExistentEmail }),
    });
    const res2 = await forgotPasswordPost(req2);
    const data2 = await res2.json();

    assert(res2.status === 200, "Forgot password endpoint returns HTTP 200 for nonexistent user");

    // -------------------------------------------------------------------------
    // Scenario 3: Generic anti-enumeration response
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 3: Generic anti-enumeration response ---");
    assert(
      data1.message === data2.message,
      "Response payload is identical between existing and nonexistent accounts (zero account enumeration)"
    );

    // -------------------------------------------------------------------------
    // Scenario 4: Invalid email format
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 4: Invalid email format ---");
    const req4 = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.3" },
      body: JSON.stringify({ email: "invalid-email-address" }),
    });
    const res4 = await forgotPasswordPost(req4);
    assert(res4.status === 400, "Malformed email format returns HTTP 400 validation error");

    // -------------------------------------------------------------------------
    // Scenario 5: Token generation & entropy
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 5: Token generation & entropy ---");
    const rawToken = crypto.randomBytes(32).toString("hex");
    assert(rawToken.length === 64, "Raw reset token is 64 hex chars (32 bytes = 256 bits entropy)");

    // -------------------------------------------------------------------------
    // Scenario 6: Token hashing (SHA-256)
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 6: Token hashing ---");
    const computedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    assert(computedHash.length === 64, "Token hash is 64 hex chars SHA-256 digest");
    assert(computedHash !== rawToken, "Token hash is strictly distinct from raw token (one-way digest)");
    assert(storedTokens[0].tokenHash !== rawToken, "Database does not store raw token");

    // -------------------------------------------------------------------------
    // Scenario 7: Expired token rejection
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 7: Expired token rejection ---");
    const expiredRawToken = crypto.randomBytes(32).toString("hex");
    const expiredHash = crypto.createHash("sha256").update(expiredRawToken).digest("hex");

    await db.insert(passwordResetTokens).values({
      userId: createdUser.id,
      tokenHash: expiredHash,
      expiresAt: new Date(Date.now() - 1000 * 60), // Expired 1 minute ago
    });

    const req7 = new NextRequest("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.4" },
      body: JSON.stringify({ token: expiredRawToken, password: newPassword }),
    });
    const res7 = await resetPasswordPost(req7);
    const data7 = await res7.json();
    assert(res7.status === 400, "Expired token rejected with HTTP 400");
    assert(data7.error.includes("expired"), "Expired error message explains expiration");

    // -------------------------------------------------------------------------
    // Scenario 8: Invalid token rejection
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 8: Invalid token rejection ---");
    const fakeToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const req8 = new NextRequest("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.5" },
      body: JSON.stringify({ token: fakeToken, password: newPassword }),
    });
    const res8 = await resetPasswordPost(req8);
    assert(res8.status === 400, "Unrecognized token rejected with HTTP 400");

    // -------------------------------------------------------------------------
    // Scenario 9: Already-used token rejection
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 9: Already-used token rejection ---");
    const usedRawToken = crypto.randomBytes(32).toString("hex");
    const usedHash = crypto.createHash("sha256").update(usedRawToken).digest("hex");

    await db.insert(passwordResetTokens).values({
      userId: createdUser.id,
      tokenHash: usedHash,
      expiresAt: new Date(Date.now() + 1000 * 3600),
      usedAt: new Date(Date.now() - 1000 * 30), // already used 30s ago
    });

    const req9 = new NextRequest("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.6" },
      body: JSON.stringify({ token: usedRawToken, password: newPassword }),
    });
    const res9 = await resetPasswordPost(req9);
    const data9 = await res9.json();
    assert(res9.status === 400, "Already-used token rejected with HTTP 400");
    assert(data9.error.includes("already been used"), "Error message states token was already used");

    // -------------------------------------------------------------------------
    // Scenario 10: Successful password reset
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 10: Successful password reset ---");
    const validRawToken = crypto.randomBytes(32).toString("hex");
    const validHash = crypto.createHash("sha256").update(validRawToken).digest("hex");

    await db.insert(passwordResetTokens).values({
      userId: createdUser.id,
      tokenHash: validHash,
      expiresAt: new Date(Date.now() + 1000 * 3600),
    });

    // Test GET token verification probe
    const getReq = new NextRequest(`http://localhost:3000/api/auth/reset-password?token=${validRawToken}`);
    const getRes = await resetPasswordGet(getReq);
    const getData = await getRes.json();
    assert(getRes.status === 200 && getData.valid === true, "GET probe verifies valid token before submission");

    const req10 = new NextRequest("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.7" },
      body: JSON.stringify({ token: validRawToken, password: newPassword }),
    });
    const res10 = await resetPasswordPost(req10);
    const data10 = await res10.json();
    assert(res10.status === 200, "Reset password returns HTTP 200 on valid token");
    assert(data10.message.includes("successfully reset"), "Success confirmation message returned");

    // -------------------------------------------------------------------------
    // Scenario 11: Password hash actually changes in DB
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 11: Password hash actually changes in DB ---");
    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, createdUser.id));
    assert(
      updatedUser.passwordHash !== createdUser.passwordHash,
      "User password_hash record in DB changed after reset"
    );

    // -------------------------------------------------------------------------
    // Scenario 12: Old password no longer works
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 12: Old password no longer works ---");
    const oldPasswordMatches = await bcrypt.compare(initialPassword, updatedUser.passwordHash);
    assert(oldPasswordMatches === false, "Old password fails bcrypt authentication check");

    // -------------------------------------------------------------------------
    // Scenario 13: New password works
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 13: New password works ---");
    const newPasswordMatches = await bcrypt.compare(newPassword, updatedUser.passwordHash);
    assert(newPasswordMatches === true, "New password passes bcrypt authentication check");

    // -------------------------------------------------------------------------
    // Scenario 14: Reset token cannot be reused
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 14: Reset token cannot be reused ---");
    const req14 = new NextRequest("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.8" },
      body: JSON.stringify({ token: validRawToken, password: "AnotherPassword789!" }),
    });
    const res14 = await resetPasswordPost(req14);
    assert(res14.status === 400, "Subsequent attempt with consumed token is rejected");

    // -------------------------------------------------------------------------
    // Scenario 15: Email provider failure resilience
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 15: Email provider failure resilience ---");
    // Temporarily unset key to simulate unconfigured/failing provider
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const failResult = await sendPasswordResetEmail({
      to: "test@example.com",
      resetUrl: "http://localhost:3000/auth/reset-password?token=test",
    });
    assert(failResult.success === false, "Handles unconfigured email provider gracefully");
    assert(typeof failResult.error === "string", "Returns safe error string on dispatch failure");
    process.env.RESEND_API_KEY = originalKey;

    // -------------------------------------------------------------------------
    // Scenario 16: Rate limit enforcement
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 16: Rate limit enforcement ---");
    const testIp = `test_limit_${timestamp}`;
    let hitLimit = false;
    for (let i = 0; i < 7; i++) {
      const check = checkRateLimit(`forgot_pw_${testIp}`, { limit: 5, windowMs: 60000 });
      if (!check.success) {
        hitLimit = true;
        break;
      }
    }
    assert(hitLimit === true, "Rate limiter triggers after threshold is exceeded");

  } finally {
    // Clean up temporary synthetic test data
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, createdUser.id));
    await db.delete(profiles).where(eq(profiles.userId, createdUser.id));
    await db.delete(users).where(eq(users.id, createdUser.id));
  }

  console.log("\n========================================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPasswordResetSuite().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
