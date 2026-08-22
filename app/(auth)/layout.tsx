import {DottedSurface} from '@/shared/ui/DottedSurface/DottedSurface'

export default function AuthLayout({children}: {children: React.ReactNode}) {
  return (
    <>
      <DottedSurface />
      {children}
    </>
  )
}
