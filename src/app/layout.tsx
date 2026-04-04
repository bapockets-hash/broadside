export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import { Inter, Orbitron, Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
});

const shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-share-tech-mono",
});

export const metadata: Metadata = {
  title: "Battleship Perps | Pacifica DEX",
  description: "The ultimate naval perpetuals trading game. Attack the market with cannons, defend with shields. Built on Pacifica DEX.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${orbitron.variable} ${shareTechMono.variable} h-full antialiased`}
    >
      <body
        className="h-full overflow-hidden"
        style={{ background: '#0a1628', color: '#e0e0e0' }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
