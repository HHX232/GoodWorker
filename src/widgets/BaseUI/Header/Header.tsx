import {DropInputUI, SearchInputUI} from '@/shared/ui'
import {ProfilePreview} from '@/widgets/ProfilePreview/ProfilePreview'
import {getTranslations} from 'next-intl/server'
import Image from 'next/image'
import Link from 'next/link'
import {LangSwitcher} from '../LangSwitcher/LangSwitcher'
import styles from './Header.module.scss'

const LogoBigUrl = '/logos/BigLogo.svg'
const LogoMobileUrl = '/logos/MobileLogo.svg'

async function Header() {
  const t = await getTranslations('Header')

  return (
    <header className={styles.wrapper}>
      <div className={`${styles.inner} container`}>
        {/* Logo */}
        <Link href='/' className={styles.logo_big}>
          <Image className={styles.logo_big} width={100} height={100} alt={t('catalog')} src={LogoBigUrl} />
        </Link>
        <Link href='/' className={styles.logo_small}>
          <Image className={styles.logo_small} width={100} height={100} alt={t('catalog')} src={LogoMobileUrl} />
        </Link>

        <div className={styles.search_box}>
          <SearchInputUI placeholder={t('search')} />
          <DropInputUI
            placeholder={t('specialization')}
            initialActiveItem={{id: 2, label: t('designer')}}
            items={[
              {id: 1, label: t('developer')},
              {id: 2, label: t('designer')},
              {
                id: 3,
                label: (
                  <>
                    <b>QA</b> {t('qa')}
                  </>
                )
              }
            ]}
          />
        </div>

        <LangSwitcher />
        <ProfilePreview />
      </div>
    </header>
  )
}

export default Header
