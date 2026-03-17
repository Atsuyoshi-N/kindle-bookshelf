import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Kindle Bookshelf",
  description: "Kindleの読書記録",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} font-sans antialiased`}>
        <header className="border-b border-card-border">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-accent">
              My Kindle Bookshelf
            </Link>
            <Link
              href="/stats"
              className="text-sm text-muted hover:text-accent transition-colors"
            >
              統計
            </Link>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        <footer className="border-t border-card-border mt-12">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <p className="text-xs text-muted">
              本サイトはAmazonアソシエイト・プログラムに参加しています。Amazon.co.jpを通じて商品をご購入いただくことで、売上の一部が還元されることがあります。
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
