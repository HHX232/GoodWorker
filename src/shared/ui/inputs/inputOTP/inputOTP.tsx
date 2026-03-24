import React, {useState, useRef, useEffect, KeyboardEvent, ClipboardEvent, ChangeEvent} from 'react'
import styles from './inputOTP.module.scss'

interface InputOtpProps {
  length: number
  onComplete: (value: string) => void
  disabled?: boolean
  className?: string
  autoFocus?: boolean
}

export const InputOtp: React.FC<InputOtpProps> = ({
  length = 4,
  onComplete,
  disabled = false,
  className = '',
  autoFocus = true
}) => {
  const [otpValues, setOtpValues] = useState<string[]>(Array(length).fill(''))
  const [isCompleted, setIsCompleted] = useState(false)
  const inputRefs = useRef<HTMLInputElement[]>([])

  // Создаем массив ref колбэков
  const getRefCallback = (index: number) => (el: HTMLInputElement | null) => {
    if (el) {
      inputRefs.current[index] = el
    }
  }

  useEffect(() => {
    if (autoFocus && !disabled && inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [autoFocus, disabled])

  useEffect(() => {
    const otpValue = otpValues.join('')
    if (otpValue.length === length && !isCompleted) {
      setIsCompleted(true)
      onComplete(otpValue)
    } else if (otpValue.length < length && isCompleted) {
      setIsCompleted(false)
    }
  }, [otpValues, length, onComplete, isCompleted])

  const changeHandler = (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const value = e.target.value

    // Only proceed if input is a single character or empty
    if (value.length > 1) return

    // Update the OTP state
    setOtpValues((prev) => {
      const newOtp = [...prev]
      newOtp[index] = value
      return newOtp
    })

    // Move focus to next input if value is entered
    if (value && index < length - 1 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus()
    }
  }

  const keyDownHandler = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    // Handle backspace
    if (e.key === 'Backspace') {
      if (otpValues[index] === '') {
        // If current input is empty, focus on previous input
        if (index > 0 && inputRefs.current[index - 1]) {
          inputRefs.current[index - 1].focus()
        }
      } else {
        // Clear current input
        setOtpValues((prev) => {
          const newOtp = [...prev]
          newOtp[index] = ''
          return newOtp
        })
      }
    }
    // Handle arrow keys
    else if (e.key === 'ArrowLeft' && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1].focus()
    } else if (e.key === 'ArrowRight' && index < length - 1 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus()
    }
  }

  const pasteHandler = (e: ClipboardEvent<HTMLInputElement>, startIndex: number) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text/plain').trim()

    // Only proceed if we have valid data and it doesn't exceed our available inputs
    if (!pastedData || pastedData.length === 0) return

    // Filter out non-alphanumeric characters if needed
    const validChars = pastedData.split('').slice(0, length - startIndex)

    // Update OTP values
    const newOtp = [...otpValues]
    validChars.forEach((char, idx) => {
      const targetIndex = startIndex + idx
      if (targetIndex < length) {
        newOtp[targetIndex] = char
      }
    })

    setOtpValues(newOtp)

    // Focus on the appropriate input after paste
    const nextIndex = Math.min(startIndex + validChars.length, length - 1)
    if (inputRefs.current[nextIndex]) {
      inputRefs.current[nextIndex].focus()
    }
  }

  const focusHandler = (index: number) => {
    if (inputRefs.current[index]) {
      inputRefs.current[index].select()
    }
  }

  return (
    <div className={`${styles.inputOtpContainer} ${className}`}>
      {Array.from({length}, (_, idx) => (
        <input
          key={idx}
          ref={getRefCallback(idx)}
          type='text'
          inputMode='numeric'
          maxLength={1}
          value={otpValues[idx]}
          onChange={(e) => changeHandler(e, idx)}
          onKeyDown={(e) => keyDownHandler(e, idx)}
          onPaste={(e) => pasteHandler(e, idx)}
          onFocus={() => focusHandler(idx)}
          disabled={disabled}
          className={styles.inputOtpBox}
          autoComplete='off'
          placeholder=' '
          aria-label={`Digit ${idx + 1}`}
        />
      ))}
    </div>
  )
}



