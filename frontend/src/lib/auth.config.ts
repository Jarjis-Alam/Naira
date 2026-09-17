import type { NextAuthConfig } from "next-auth";

const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build" ||
  process.env.BUILDING === "true";

if (
  process.env.NODE_ENV === "production" &&
  !process.env.AUTH_SECRET &&
  !isBuildPhase
) {
  console.warn(
    "[auth.config] Warning: AUTH_SECRET is not configured in production runtime environment."
  );
}

export const authConfig = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/login",
    newUser: "/auth/register",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin || false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { isAdmin?: boolean }).isAdmin =
          token.isAdmin as boolean;
      }
      return session;
    },
  },
  providers: [],
  secret: process.env.AUTH_SECRET || "build-time-auth-secret-placeholder",
  trustHost: true,
} satisfies NextAuthConfig;
