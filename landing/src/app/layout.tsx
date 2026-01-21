import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Miku — The Editor That Listens",
  description: "A markdown editor with an AI assistant that behaves like a patient, skilled human editor—not a co-writer.",
  openGraph: {
    title: "Miku — The Editor That Listens",
    description: "A markdown editor with an AI assistant that behaves like a patient, skilled human editor—not a co-writer.",
    type: "website",
    "images": [
      {
        url: "https://github.com/porkytheblack/miku/blob/main/public/og-image.png?raw=true",
        width: 1200,
        height: 730,
        alt: "Miku — The Editor That Listens",
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Miku — The Editor That Listens",
    description: "A markdown editor with an AI assistant that behaves like a patient, skilled human editor—not a co-writer.",
    images: [
      {
        url: "https://github.com/porkytheblack/miku/blob/main/public/og-image.png?raw=true",
        width: 1200,
        height: 730,
        alt: "Miku — The Editor That Listens",
      }
    ]
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
