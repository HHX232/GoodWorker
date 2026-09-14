// Shared "is this calendar event a billable lesson, and how much" logic — used
// server-side by every place that needs to know which lessons are unpaid:
// GET /api/teacher/calendar (badge), /api/teacher/payment-reminder/summary,
// and /api/statistics/[teacherId] (receipts widget).
//
// A "calendar event" here can come from three places that all end up in the
// same events array: manually created/edited/repeated bookings saved via
// POST /api/teacher/calendar, events auto-added when a public ServiceBooking
// gets confirmed (id starts with "booking-"), and Conference rows merged in
// read-only. Booking-confirmed events are skipped here — their payment status
// is tracked on the ServiceBooking row itself, not on the synthetic event, so
// counting both would double the same lesson.

export interface BillableCalendarEvent {
  id: string
  studentId?: string
  studentName?: string
  status?: 'scheduled' | 'completed' | 'cancelled'
  serviceId?: string
  serviceTitle?: string
  servicePrice?: number
  serviceCurrency?: string
  serviceDurationMinutes?: number
  durationMinutes?: number
  startTime: string
  endTime: string
  date: string
  paid?: boolean
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function isBookingConfirmedEvent(id: string): boolean {
  return id.startsWith('booking-')
}

export function isBillableEvent(e: BillableCalendarEvent): boolean {
  return (
    !!e.serviceId &&
    !!e.servicePrice &&
    !!e.serviceDurationMinutes &&
    !!e.studentId &&
    e.status !== 'cancelled' &&
    !isBookingConfirmedEvent(e.id)
  )
}

export function eventAmount(e: BillableCalendarEvent): number | null {
  if (!e.servicePrice || !e.serviceDurationMinutes) return null
  const meetingMins = e.durationMinutes ?? (timeToMins(e.endTime) - timeToMins(e.startTime))
  if (meetingMins <= 0) return null
  return Math.round((e.servicePrice * meetingMins) / e.serviceDurationMinutes)
}
