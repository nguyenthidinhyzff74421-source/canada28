import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PC28 自动报数控制台",
  description: "加拿大28预测自动报数工具 - 学术研究",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
