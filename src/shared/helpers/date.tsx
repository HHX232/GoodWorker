export function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' - ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + 'GMT';
}
