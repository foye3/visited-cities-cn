import type { Metadata, Viewport } from "next";
import "./globals.css";

const pagesBasePath = process.env.PAGES_BASE_PATH || "/visited-cities-cn";
const siteUrl = `https://foye3.github.io${pagesBasePath}`;

export const metadata: Metadata = {
  metadataBase: new URL(`${siteUrl}/`),
  title: "中国地级市足迹 | Visited China",
  description: "点亮你去过的中国城市并生成专属足迹地图。Switch between Chinese and English to mark and export your China city footprint.",
  applicationName: "中国城市足迹 | Visited China",
  openGraph: {
    title: "中国地级市足迹 | Visited China",
    description: "点亮你去过的中国城市并生成专属足迹地图。Mark the cities and regions you have visited across China.",
    url: siteUrl,
    siteName: "中国地级市足迹 | Visited China",
    locale: "zh_CN",
    alternateLocale: ["en_US"],
    type: "website",
    images: [{
      url: `${siteUrl}/social-preview.png`,
      width: 1200,
      height: 630,
      alt: "中国地级市足迹 / Visited China interactive city map",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "中国地级市足迹 | Visited China",
    description: "Mark the cities and regions you have visited across China and export your footprint map.",
    images: [`${siteUrl}/social-preview.png`],
  },
  icons: {
    icon: [{ url: `${siteUrl}/favicon.svg`, type: "image/svg+xml" }, { url: `${siteUrl}/icon.png`, type: "image/png" }],
    shortcut: `${siteUrl}/favicon.svg`,
    apple: `${siteUrl}/apple-touch-icon.png`,
  },
  other: {
    "apple-mobile-web-app-title": "Visited China",
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
      <body>{children}</body>
    </html>
  );
}
