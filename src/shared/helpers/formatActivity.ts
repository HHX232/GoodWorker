export function formatActivity(online: boolean, lastSeenAt: Date | null): string {
  if (online) return 'Online'
  if (!lastSeenAt) return ''

  const diff = Date.now() - lastSeenAt.getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 60) return `${minutes}м назад`
  if (hours < 24) return `${hours}ч назад`
  return `${days}д назад`
}
