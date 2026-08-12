'use client'
import { useLocale } from 'next-intl'
import { useThemeCtx } from '@/app/providers/ThemeContext'

const translations = {
  ru: {
    title: 'Произошла ошибка!',
    description: 'К сожалению, что-то пошло не так. Мы уже работаем над решением этой проблемы.',
    button: 'Попробовать снова',
    back: 'Вернуться назад',
    technical: 'Техническая информация',
    contact: 'Если проблема повторяется, свяжитесь с нами:',
    phone: 'Телефон:',
    email: 'Email:'
  },
  en: {
    title: 'Something went wrong!',
    description: 'Unfortunately, an error occurred. We are already working on fixing this issue.',
    button: 'Try again',
    back: 'Go back',
    technical: 'Technical information',
    contact: 'If the problem persists, contact us:',
    phone: 'Phone:',
    email: 'Email:'
  }
}

export default function ErrorPage({error, reset}: {error: Error; reset: () => void}) {
  const locale = useLocale() as keyof typeof translations
  const t = translations[locale] || translations.en
  const { isDark } = useThemeCtx()

  const telephone = process.env.NEXT_PUBLIC_TELEPHONE
  const email = process.env.NEXT_PUBLIC_EMAIL

  // Theme tokens
  const bg      = isDark ? '#0f1117' : '#ffffff'
  const border  = isDark ? '#2a2d3a' : '#080b13'
  const text    = isDark ? '#e8eaf0' : '#080b13'
  const muted   = isDark ? 'rgba(255,255,255,0.4)' : '#707070'
  const iconBg  = isDark ? 'rgba(255,255,255,0.07)' : '#f5f5f5'
  const detailBg= isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5'
  const detailBd= isDark ? 'rgba(255,255,255,0.08)' : '#e0e0e0'
  const codeBg  = isDark ? '#1a1c24' : '#ffffff'

  const handleReset = () => {
    try {
      reset()
      if (typeof window !== 'undefined') window?.location.reload()
    } catch (err) {
      console.error('Reset failed:', err)
    }
  }

  const handleGoBack = () => {
    if (typeof window !== 'undefined') window.history.back()
  }

  console.log(error)

  return (
    <>
      <style jsx>{`
        .error-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${bg};
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          transition: background 0.2s;
        }

        .error-card {
          background: ${bg};
          border: 2px solid ${border};
          border-radius: 0;
          padding: 60px 40px;
          text-align: center;
          max-width: 600px;
          width: 100%;
          position: relative;
        }

        .error-icon {
          width: 100px;
          height: 100px;
          margin: 0 auto 40px;
          border-radius: 50%;
          background: ${iconBg};
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .error-icon svg {
          width: 50px;
          height: 50px;
          color: ${text};
        }

        .error-title {
          color: ${text};
          font-size: 48px;
          font-weight: 600;
          margin: 0 0 24px;
          line-height: 1.2;
        }

        .error-description {
          color: ${muted};
          font-size: 24px;
          line-height: 1.5;
          margin-bottom: 48px;
        }

        .button-group {
          display: flex;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 40px;
        }

        .retry-button,
        .back-button {
          background: transparent;
          color: ${text};
          border: 2px solid ${border};
          border-radius: 0;
          padding: 16px 32px;
          font-size: 20px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }

        .retry-button:hover,
        .back-button:hover {
          background: ${isDark ? 'rgba(255,255,255,0.1)' : '#080b13'};
          color: ${isDark ? '#e8eaf0' : '#ffffff'};
        }

        .technical-details {
          margin-top: 40px;
          padding: 24px;
          background: ${detailBg};
          border: 1px solid ${detailBd};
        }

        .technical-title {
          color: ${text};
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .error-message {
          font-family: 'Courier New', monospace;
          font-size: 14px;
          color: ${text};
          word-break: break-all;
          padding: 16px;
          background: ${codeBg};
          border: 1px solid ${detailBd};
          text-align: left;
        }

        .contact-info {
          margin-top: 40px;
          color: ${muted};
          font-size: 18px;
        }

        .contact-text {
          margin-bottom: 20px;
        }

        .contact-item {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin: 12px 0;
        }

        .contact-label {
          font-weight: 600;
          color: ${text};
        }

        .contact-link {
          color: ${text};
          text-decoration: none;
          font-weight: 500;
          border-bottom: 2px solid transparent;
          transition: border-color 0.2s;
        }

        .contact-link:hover {
          border-bottom-color: ${text};
        }

        @media (max-width: 768px) {
          .error-card { padding: 50px 30px; }
          .error-title { font-size: 36px; }
          .error-description { font-size: 20px; margin-bottom: 40px; }
          .retry-button, .back-button { font-size: 18px; padding: 14px 28px; }
          .contact-info { font-size: 16px; }
        }

        @media (max-width: 640px) {
          .error-card { padding: 40px 20px; }
          .error-title { font-size: 28px; }
          .error-description { font-size: 18px; margin-bottom: 32px; }
          .error-icon { width: 80px; height: 80px; margin-bottom: 32px; }
          .error-icon svg { width: 40px; height: 40px; }
          .button-group { flex-direction: column; gap: 16px; }
          .retry-button, .back-button { width: 100%; font-size: 16px; padding: 12px 24px; }
          .contact-info { font-size: 15px; }
        }

        @media (max-width: 480px) {
          .error-title { font-size: 24px; }
          .error-description { font-size: 16px; margin-bottom: 24px; }
          .retry-button, .back-button { font-size: 14px; padding: 10px 20px; }
        }
      `}</style>

      <div className='error-container'>
        <div className='error-card'>
          <div className='error-icon'>
            <svg fill='currentColor' viewBox='0 0 20 20'>
              <path
                fillRule='evenodd'
                d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z'
                clipRule='evenodd'
              />
            </svg>
          </div>

          <h1 className='error-title'>{t.title}</h1>
          <p className='error-description'>{t.description}</p>

          <div className='button-group'>
            <button className='retry-button' onClick={handleReset}>
              {t.button}
            </button>
            <button className='back-button' onClick={handleGoBack}>
              {t.back}
            </button>
          </div>

          <div className='contact-info'>
            <div className='contact-text'>{t.contact}</div>
            {telephone && (
              <div className='contact-item'>
                <span className='contact-label'>{t.phone}</span>
                <a href={`tel:${telephone}`} className='contact-link'>{telephone}</a>
              </div>
            )}
            {email && (
              <div className='contact-item'>
                <span className='contact-label'>{t.email}</span>
                <a href={`mailto:${email}`} className='contact-link'>{email}</a>
              </div>
            )}
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className='technical-details'>
              <div className='technical-title'>{t.technical}</div>
              <div className='error-message'>{error.message || 'Unknown error'}</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
