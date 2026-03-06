import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Auction Seettu - Lottery Draw",
  description: "A secure, real-time lottery number generation system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${inter.variable} font-inter`}
      >
        <main className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-4 sm:p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
