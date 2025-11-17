import type { Metadata } from "next";
import { headers } from "next/headers";
import "@/assets/stylesheets/globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider"
import { ModalProvider } from "@/components/providers/modal-provider"
import { RealtimeProvider } from "@/components/providers/realtime-provider"
import { QueryProvider } from "@/components/providers/query-provider"

export const metadata: Metadata = {
  title: "Guildhall Community",
  description: "Connect and collaborate with your TTRPG gaming community",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get nonce from headers (set by middleware)
  // Next.js Script component will automatically use this nonce
  // In Next.js 15, headers() must be awaited
  const headersList = await headers()
  const nonce = headersList.get('x-nonce') || undefined

  return (
    <html lang="en" suppressHydrationWarning className="h-svh">
      <head>
        {/* Next.js Script components automatically include nonce when available */}
        {/* If you need to add inline scripts, use the nonce like this: */}
        {/* <script nonce={nonce} dangerouslySetInnerHTML={{ __html: '...' }} /> */}
      </head>
      <body className="antialiased font-sans h-svh" suppressHydrationWarning>
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
