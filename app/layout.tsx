import DefaultProvider from '@/app/providers/DefaultProvider'
import { LazyClientWidgets } from '@/app/providers/LazyClientWidgets'
import { TutorialProvider } from '@/widgets/Tutorial/TutorialContext'
import 'flag-icons/css/flag-icons.min.css'
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
import Script from 'next/script'

const GTM_ID = 'GTM-TRVK6CGM'
const YANDEX_METRIKA_ID = 112274831

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
  other: {
    google: 'notranslate',
  },
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()
  return (
    <html lang={locale} translate="no">
      <body className={`${robotoSans.variable} `}>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}

        {/* Yandex.Metrika counter (noscript fallback) */}
        <noscript>
          <div>
            <img
              src={`https://mc.yandex.ru/watch/${YANDEX_METRIKA_ID}`}
              style={{ position: 'absolute', left: '-9999px' }}
              alt=""
            />
          </div>
        </noscript>
        {/* /Yandex.Metrika counter */}

        {/* Google Tag Manager — beforeInteractive makes Next.js inject this
            into the initial HTML <head>, matching Google's "as high as
            possible" placement requirement regardless of where the
            component sits in the tree. */}
        <Script
          id="gtm-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`
          }}
        />

        {/* Yandex.Metrika counter */}
        <Script
          id="yandex-metrika"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_ID}', 'ym');

ym(${YANDEX_METRIKA_ID}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});`
          }}
        />

        <NextIntlClientProvider messages={messages}>
          <DefaultProvider>
            <Header />
            <TutorialProvider>
              <LazyClientWidgets />
              <TextSelectionProvider>{children}</TextSelectionProvider>
            </TutorialProvider>
            <div id='modal_portal' />
          </DefaultProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
