'use client'

import { FC, useState } from 'react'
import styles from './OtpModal.module.scss'

interface OtpModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description: string
  onSendCode: () => Promise<void>
  onVerify: (otp: string) => Promise<void>
  extraField?: React.ReactNode 
}

const OtpModal: FC<OtpModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  onSendCode,
  onVerify,
  extraField,
}) => {
  const [step, setStep] = useState<'input' | 'otp'>('input')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSend = async () => {
    setError('')
    setLoading(true)
    try {
      await onSendCode()
      setStep('otp')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error sending code')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError('Enter 6-digit code')
      return
    }
    setError('')
    setLoading(true)
    try {
      await onVerify(otp)
      handleClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep('input')
    setOtp('')
    setError('')
    onClose()
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeBtn} onClick={handleClose} type="button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.description}>{description}</p>

          {step === 'input' && (
            <>
              {extraField}
              <button
                className={styles.primaryBtn}
                onClick={handleSend}
                disabled={loading}
                type="button"
              >
                {loading ? 'Sending...' : 'Send code'}
              </button>
            </>
          )}

          {step === 'otp' && (
            <>
              {/* 
                TODO: Replace this input with your real InputOTP component.
                It should call setOtp(value) on change and accept value={otp}.
              */}
              <div className={styles.otpPlaceholder}>
                <input
                  className={styles.otpInput}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                />
                <p className={styles.otpHint}>Enter the 6-digit code from your email</p>
              </div>

              <button
                className={styles.primaryBtn}
                onClick={handleVerify}
                disabled={loading}
                type="button"
              >
                {loading ? 'Verifying...' : 'Confirm'}
              </button>

              <button
                className={styles.textBtn}
                onClick={() => setStep('input')}
                type="button"
              >
                ← Back
              </button>
            </>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    </div>
  )
}

export default OtpModal