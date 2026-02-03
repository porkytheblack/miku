import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Miku - Center your workflows",
  description:
    "Miku is a central hub for a developer's many complex workflows. Write docs, manage tasks, configure environments, and let AI assist without overwriting your voice.",
  openGraph: {
    title: "Miku - Center your workflows",
    description:
      "A central hub for a developer's many complex workflows. Write docs, manage tasks, configure environments, and let AI assist without overwriting your voice.",
    type: "website",
    images: [
      {
        url: "/og-data.png",
        width: 1200,
        height: 730,
        alt: "Miku - Center your workflows",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Miku - Center your workflows",
    description:
      "A central hub for a developer's many complex workflows. Write docs, manage tasks, configure environments, and let AI assist without overwriting your voice.",
    images: [
      {
        url: "/og-data.png",
        width: 1200,
        height: 730,
        alt: "Miku - Center your workflows",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
