import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/QueryProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zumeet — 租客房東雙向媒合",
  description: "根據條件雙向媒合，媒合成功才顯示聯絡方式。自填資料，由雙方自行確認。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-gray-100 text-gray-950 antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
