import type { Metadata } from "next";
import ChunkLoadRecovery from "@/app/components/ChunkLoadRecovery";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Media Equipment Tracker",
  description: "Track digital media equipment checkouts and returns for Ignite Professional Studies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ChunkLoadRecovery />
        {children}
      </body>
    </html>
  );
}
