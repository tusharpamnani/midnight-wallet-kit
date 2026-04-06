import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Midnight Wallet Kit",
  description:
    "Production-grade wallet integration for the Midnight Network. Resilient signing. ZK-native. First-class React support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} scroll-smooth`}>
      <body className="bg-background text-text-primary antialiased">
        <div className="fixed inset-0 bg-noise opacity-[0.03] pointer-events-none z-[9999]" />
        {children}
      </body>
    </html>
  );
}
