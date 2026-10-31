import type { Metadata } from "next";
import { Fragment_Mono, Schibsted_Grotesk } from "next/font/google";

import { ThemeProvider } from "@/shared/ui/theme-provider";

import "./globals.css";

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const fragmentMono = Fragment_Mono({
  variable: "--font-fragment-mono",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Codeprint",
  description: "The fingerprint of code.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${schibsted.variable} ${fragmentMono.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
