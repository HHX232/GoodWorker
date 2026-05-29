const BOT_API = (token: string) => `https://api.telegram.org/bot${token}`

export async function sendTelegramMessage(chatId: bigint, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false
  try {
    const res = await fetch(`${BOT_API(token)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId.toString(), text, parse_mode: 'Markdown' }),
    })
    return res.ok
  } catch {
    return false
  }
}
