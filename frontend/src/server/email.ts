import { Resend } from "resend";

export interface SendPasswordResetEmailParams {
  to: string;
  resetUrl: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Returns a configured Resend client or null if API key is absent.
 */
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

/**
 * Generates technical monochrome HTML email matching NAIRA design language.
 */
function renderPasswordResetHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your NAIRA password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #08090a; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #08090a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #121316; border: 1px solid #27282d; border-radius: 20px; padding: 36px 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          <!-- Header / Brand -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; padding: 6px 14px; background-color: #1a1b1f; border: 1px solid #27282d; border-radius: 9999px; font-size: 11px; font-family: monospace; letter-spacing: 0.1em; color: #a1a1aa; text-transform: uppercase;">
                      NAIRA · Placement OS
                    </div>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 20px 0 0 0; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.02em;">
                Reset Your Password
              </h1>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding-bottom: 28px; font-size: 14px; line-height: 1.6; color: #a1a1aa; text-align: left;">
              <p style="margin: 0 0 16px 0;">
                We received a request to reset the password associated with your account.
              </p>
              <p style="margin: 0;">
                Click the button below to choose a new password. This recovery link is valid for <strong>60 minutes</strong> and can only be used once.
              </p>
            </td>
          </tr>

          <!-- Primary Action Button -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius: 9999px; background-color: #ffffff;">
                    <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 28px; font-size: 13px; font-weight: 600; color: #000000; text-decoration: none; border-radius: 9999px; letter-spacing: -0.01em;">
                      Reset Password &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Plain Link Fallback -->
          <tr>
            <td style="padding-bottom: 24px; border-top: 1px solid #1f2024; padding-top: 20px; font-size: 12px; line-height: 1.5; color: #71717a; text-align: left;">
              <p style="margin: 0 0 8px 0;">
                If the button above does not work, copy and paste the following link into your browser:
              </p>
              <p style="margin: 0; word-break: break-all; font-family: monospace; font-size: 11px; color: #d4d4d8;">
                <a href="${resetUrl}" style="color: #ffffff; text-decoration: underline;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding: 16px; background-color: #17181c; border: 1px solid #27282d; border-radius: 12px; font-size: 11px; line-height: 1.5; color: #71717a;">
              <strong style="color: #a1a1aa;">Security advisory:</strong> If you did not request this password reset, please disregard this email. Your existing credentials remain secure and no changes have been applied.
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" style="max-width: 520px; margin-top: 24px;">
          <tr>
            <td align="center" style="font-size: 11px; font-family: monospace; color: #52525b; letter-spacing: 0.05em;">
              NAIRA PLATFORM · SECURE RECOVERY GATEWAY
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends a real password reset email via Resend.
 */
export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: SendPasswordResetEmailParams): Promise<SendEmailResult> {
  const resend = getResendClient();

  if (!resend) {
    console.error("[email] Resend client unconfigured: RESEND_API_KEY is missing from environment.");
    return {
      success: false,
      error: "Email delivery service is currently not configured.",
    };
  }

  const from = process.env.EMAIL_FROM || "NAIRA <onboarding@resend.dev>";

  try {
    const data = await resend.emails.send({
      from,
      to,
      subject: "Reset your NAIRA password",
      html: renderPasswordResetHtml(resetUrl),
    });

    if (data.error) {
      console.error("[email] Resend returned an error:", data.error.message);
      return {
        success: false,
        error: data.error.message,
      };
    }

    return {
      success: true,
      id: data.data?.id,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown email dispatch error";
    console.error("[email] Failed to dispatch password reset email:", message);
    return {
      success: false,
      error: message,
    };
  }
}
