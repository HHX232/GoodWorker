export type ReceiptStatus = 'paid' | 'unpaid' | 'planned'

export interface Receipt {
  id: string
  status: ReceiptStatus
  subject: string
  date: string | null
  amount: number
  currency: string
  studentId: string
  studentName: string
  studentAvatar?: string | null
}
