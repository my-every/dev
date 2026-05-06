import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AppRuntimeProvider } from '@/components/providers/app-runtime-provider'
import { ProjectProvider } from '@/contexts/project-context'
import { LayoutProvider } from '@/contexts/layout-context'
import { DeviceDetailsProvider } from '@/lib/device-details/context'
import { SessionProvider } from '@/hooks/use-session'
import { TourProvider } from '@/components/tour/tour/index'
import { UploadProvider } from '@/contexts/upload-context'
import { FeedbackLoaderProvider } from '@/contexts/feedback-loader-context'
import { IdleAutoLogoutGuard } from '@/components/providers/idle-auto-logout-guard'
import { ShareDirectorySelector } from '@/components/providers/share-directory-selector'
import { AppModeRouteGuard } from '@/components/providers/app-mode-route-guard'
import { AppShellDecorations } from '@/components/providers/app-shell-decorations'
import { ThemeProvider } from '@/lib/theme/theme-context'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: '380',
  description: 'Controls Management for D380 Projects',
  icons: {
    icon: [
      {
        url: '/macos/32x32.png',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
    windows: '/windows/256x256.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const showSensitivityFooter = process.env.NEXT_PUBLIC_SHOW_SENSITIVITY_FOOTER !== 'false'

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('d380-theme-preference');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                  // Light theme is now default - no class needed
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased h-screen  bg-background" suppressHydrationWarning>
        <ThemeProvider>
          <AppRuntimeProvider>
            <SessionProvider>
              <FeedbackLoaderProvider>
                <ProjectProvider>
                  <LayoutProvider>
                    <DeviceDetailsProvider>
                      <TourProvider>
                        <UploadProvider>
                          {children}
                       
                        </UploadProvider>
                      </TourProvider>
                    </DeviceDetailsProvider>
                  </LayoutProvider>
                </ProjectProvider>
                <IdleAutoLogoutGuard />
                <ShareDirectorySelector />
                <AppModeRouteGuard />
              </FeedbackLoaderProvider>
            </SessionProvider>
          </AppRuntimeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
