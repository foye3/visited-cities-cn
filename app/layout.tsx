import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC, Space_Grotesk } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://visited-china.foye3.chatgpt.site"),
  title: "中国地级市足迹",
  description: "点亮你去过的中国城市，按居住、短居、游玩、出差与路过记录足迹并生成专属地图。",
  applicationName: "中国地级市足迹",
  openGraph: {
    title: "中国地级市足迹",
    description: "点亮你去过的中国城市，生成专属足迹地图。",
    url: "https://visited-china.foye3.chatgpt.site",
    siteName: "中国地级市足迹",
    locale: "zh_CN",
    type: "website",
    images: [{
      url: "/social-preview.png",
      width: 1200,
      height: 630,
      alt: "中国地级市足迹互动地图",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "中国地级市足迹",
    description: "点亮你去过的中国城市，生成专属足迹地图。",
    images: ["/social-preview.png"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/icon.png", type: "image/png" }],
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  other: {
    "codex-preview": "development",
    "apple-mobile-web-app-title": "中国城市足迹",
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${notoSans.variable} ${spaceGrotesk.variable}`}>{children}</body>
    </html>
  );
}
