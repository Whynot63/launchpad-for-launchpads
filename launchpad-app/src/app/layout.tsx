import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import type { CSSProperties } from "react";
import { Header } from "@/components/Header";
import { findCurrentLaunchpad, logoSrc } from "@/lib/launchpad";
import { Providers } from "./providers";
import "./globals.css";

const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600"] });

export async function generateMetadata(): Promise<Metadata> {
  const launchpad = await findCurrentLaunchpad();
  if (!launchpad) return { title: "Launchpad Not Found" };
  return {
    title: launchpad.name,
    description: launchpad.description || `Launch and trade tokens on ${launchpad.name}.`,
    icons: { icon: logoSrc(launchpad) || "/mark.svg" },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const launchpad = await findCurrentLaunchpad();
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body
        className="flex min-h-full flex-col font-sans"
        style={launchpad && ({ "--color-brand": launchpad.accentColor } as CSSProperties)}
      >
        <Providers>
          {launchpad && <Header launchpad={launchpad} />}
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
