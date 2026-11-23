import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "HerBody | Your Body, Your Companion",
  description: "HerBody is your companion for a healthier life and health journey.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full overflow-x-hidden bg-blush text-ink">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
