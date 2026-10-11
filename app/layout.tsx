import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@/components/lime/styles.css";
import "./teams.css";
import { LimePortalProvider } from "@/lib/lime/portal";
import { SiteHeader } from "./_components/site-header";

// Inter carries the words and the numbers. It is a variable font, so no weights are listed.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fairseat",
  description:
    "One seat, sold once per team. The playoffs decide who sits in it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased [scrollbar-gutter:stable]`}
    >
      <body className="lime min-h-dvh bg-page text-fg">
        {/* The header lives here so it stays put while the page under it changes. */}
        <LimePortalProvider>
          <SiteHeader />
          {children}
        </LimePortalProvider>
      </body>
    </html>
  );
}
