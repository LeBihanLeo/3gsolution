import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import SwRegister from "@/components/SwRegister";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "3G Solution — Commandes en ligne",
  description: "Commandez en ligne facilement",
  manifest: "/manifest.json",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // CVE-06 — Lire le nonce injecté par le middleware pour le passer à Next.js.
  // Next.js utilise ce nonce sur ses scripts de hydratation inline,
  // ce qui permet de supprimer 'unsafe-inline' de la CSP.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Permet aux scripts inline de Next.js (hydratation) d'utiliser le nonce */}
        {nonce && <meta name="csp-nonce" content={nonce} />}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} antialiased`}
      >
        <SessionProviderWrapper>
          {children}
        </SessionProviderWrapper>
        <SwRegister />
      </body>
    </html>
  );
}
