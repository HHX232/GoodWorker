import DefaultProvider from '@/app/providers/DefaultProvider'
import { TutorialProvider } from '@/widgets/Tutorial/TutorialContext'
import TutorialOverlay from '@/widgets/Tutorial/TutorialOverlay'
import '@/shared/scss/_variables.scss'
import '@/shared/scss/config/functions.scss'
import '@/shared/scss/config/keyframes.scss'
import '@/shared/scss/config/mixins.scss'
import '@/shared/scss/config/reset.scss'
import '@/shared/scss/config/root.scss'
import '@/shared/scss/main.scss'
import { TextSelectionProvider } from '@/shared/ui/Providers/TextSelectionProvider/TextSelectionProvider'
import Header from '@/widgets/BaseUI/Header/Header'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Roboto } from 'next/font/google'
import { Toaster } from 'sonner'

const robotoSans = Roboto({
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-main'
})

export const metadata: Metadata = {
  title: {
    template: '%s | GoodWorker',
    default: 'GoodWorker'
  },
  description: 'Образовательная платформа для репетиторов и студентов',
  icons: {
    icon: [
      { url: '/logos/favicon.ico', sizes: 'any' },
      { url: '/logos/favicon.svg', type: 'image/svg+xml' },
      { url: '/logos/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/logos/apple-touch-icon.png',
  },
  manifest: '/logos/site.webmanifest',
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()
  return (
    <html lang={locale}>
      <body className={`${robotoSans.variable} `}>
        <NextIntlClientProvider messages={messages}>
          <DefaultProvider>
            <Header />
            <Toaster style={{zIndex:1410000010}} position='top-right' richColors />
            <TutorialProvider>
              <TutorialOverlay />
              <TextSelectionProvider>{children}</TextSelectionProvider>
            </TutorialProvider>
            <div id='modal_portal' />
          </DefaultProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
