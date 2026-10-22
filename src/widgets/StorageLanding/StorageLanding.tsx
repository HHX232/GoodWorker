import Footer from '@/widgets/Footer/Footer'
import { AvatarSprite } from './AvatarSprite'
import { HowSection } from './HowSection'
import { Manifest } from './Manifest'
import { RevealRoot } from './RevealRoot'
import { Audience, Faq, FinalCta, Hero, Steps } from './StaticSections'
import s from './StorageLanding.module.scss'

/**
 * Лендинг «Файловое хранилище» (/info-storage). Шапка — глобальная (app/layout.tsx), футер —
 * глобальный `Footer` сайта в скоуп-обёртке (подстройка под страницу, остальные страницы не затронуты).
 */
export default function StorageLanding() {
   return (
      <>
         <RevealRoot>
            <AvatarSprite />
            <main>
               <Hero />
               <HowSection />
               <Steps />
               <Audience />
               <Manifest />
               <Faq />
               <FinalCta />
            </main>
         </RevealRoot>
         <div className={s.footerScope}>
            <Footer />
         </div>
      </>
   )
}
