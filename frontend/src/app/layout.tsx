import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/providers/auth-provider";
import { DevButton } from "@/components/layout/dev-modal";
import { mileast } from "@/app/fonts";

export const metadata: Metadata = {
  title: "Nexora — Placement Operating System",
  description:
    "Assess your skills, identify weaknesses, practice with precision, and measure placement readiness with high-precision metrics.",
  icons: {
    icon: [
      { url: "/logo.png", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/logo.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark scroll-smooth ${mileast.variable}`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-void-black text-sage-60 antialiased min-h-screen relative overflow-x-hidden">
        {/* Phosphor terminal canvas with subtle green bloom & precision grid */}
        <div className="fixed inset-0 pointer-events-none -z-10 w-full h-full min-h-screen bg-void-black tech-grid ambient-glow" />

        <div className="relative z-10 min-h-screen flex flex-col justify-between">
          <AuthProvider>
            {children}
            {/* Quick Access Floating DEV Profile Trigger */}
            <DevButton variant="floating" />
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
