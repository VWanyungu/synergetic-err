import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Ban, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/theme-provider";
import { Providers } from "./providers";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Enterprise Risk Register",
  description: "Synergetic Enterprise Risk Register",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          <Providers>
            <AuthProvider>{children}</AuthProvider>
          </Providers>
          {/* Toasts as in Gas Connect: a tinted bar with an icon and a close button, top right of the content area, below the 72px navbar. */}
        <Toaster
          position="top-right"
          offset={{ top: 88, right: 24 }}
          mobileOffset={{ top: 88, right: 16, left: 16 }}
          closeButton
          icons={{
            success: <CircleCheck className="size-[22px]" />,
            error: <Ban className="size-[22px]" />,
            info: <Info className="size-[22px]" />,
            warning: <TriangleAlert className="size-[22px]" />,
          }}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast: "flex w-full items-center gap-3 rounded-lg px-[18px] py-4 text-[14px] leading-normal shadow-[0_10px_28px_rgba(17,17,17,0.08)] sm:w-[460px]",
              success: "bg-success-bg text-success-fg",
              error: "bg-danger-bg text-danger-fg",
              info: "bg-info-bg text-info-fg",
              warning: "bg-warning-bg text-warning-fg",
              icon: "flex shrink-0 items-center justify-center",
              content: "flex-1",
              title: "font-medium text-ink",
              description: "text-ink-muted",
              closeButton: "order-last flex size-[18px] shrink-0 cursor-pointer items-center justify-center text-ink-muted hover:text-ink",
              actionButton: "cursor-pointer font-medium text-brand underline",
            },
          }}
        />
        </ThemeProvider>
      </body>
    </html>
  );
}
