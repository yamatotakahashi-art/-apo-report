import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "営業報告・メールジェネレーター（社内）",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', Meiryo, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
