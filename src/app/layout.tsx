import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import { SettingsProvider } from "@/context/SettingsContext";
import { MikuProvider } from "@/context/MikuContext";
import { DocumentProvider } from "@/context/DocumentContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { ToastProvider } from "@/context/ToastContext";
import { UpdateProvider } from "@/context/UpdateContext";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Miku — The Editor That Listens",
  description: "A markdown editor with an AI assistant that behaves like a patient, skilled human editor—not a co-writer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jetbrainsMono.variable} ${inter.variable} antialiased`}>
        <SettingsProvider>
          <WorkspaceProvider>
            <DocumentProvider>
              <MikuProvider>
                <ToastProvider position="bottom-right">
                  <UpdateProvider>
                    {children}
                  </UpdateProvider>
                </ToastProvider>
              </MikuProvider>
            </DocumentProvider>
          </WorkspaceProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
