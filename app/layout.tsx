import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { cn } from "@/lib/utils"
import "@/assets/stylesheets/globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider"
import { ModalProvider } from "@/components/providers/modal-provider"
import { RealtimeProvider } from "@/components/providers/realtime-provider"
import { QueryProvider } from "@/components/providers/query-provider"

export const metadata: Metadata = {
  title: "Guildhall Community",
  description: "Connect and collaborate with your TTRPG gaming community",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-svh">
      <body className="antialiased font-sans h-svh">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          storageKey="discord-theme"
        >
          <RealtimeProvider>
            <ModalProvider />
            <QueryProvider>
              {children}
            </QueryProvider>
          </RealtimeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
