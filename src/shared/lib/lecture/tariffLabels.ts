// Admin tariff card copy. Served only by GET /api/admin/lecture-settings —
// NOT in messages/*.json, which the root layout ships to every visitor: the
// pricing mechanism (tiers, DeepSeek markup) is internal.
export const TARIFF_LABELS = {
  "ru": {
    "lectureTariff": "Конспекты лекций — тариф",
    "lectureTariffHint": "Первые минуты лекции — по базовой цене за каждые начатые 5 минут; дальше — доплата за 5 минут плюс стоимость DeepSeek × наценка.",
    "lectureModeNoWallet": "Без Кошелька: считается, не списывается",
    "lectureBaseMinutes": "Базовые минуты",
    "lectureBasePrice": "Цена базовых минут",
    "lectureExtraPrice": "Доплата после базовых",
    "lectureAiMarkup": "Наценка на DeepSeek",
    "lectureAiMarkupHint": "Применяется к стоимости токенов после базовых минут",
    "lectureAiInput": "DeepSeek: входные токены",
    "lectureAiOutput": "DeepSeek: выходные токены",
    "lectureDailyCap": "Лимит записи в день",
    "lectureDailyCapHint": "Пока нет Кошелька — предохранитель на пользователя (0 — без лимита). Админов не касается.",
    "lectureUnitMin": "мин",
    "lectureMonth": "В этом месяце: {lectures} лекций, {minutes} мин, начислено {cost} ₽, {tokens} токенов DeepSeek",
    "lectureUnitPer5Min": "₽ / 5 мин"
  },
  "en": {
    "lectureTariff": "Lecture notes — pricing",
    "lectureTariffHint": "The first minutes of a lecture cost the base price per started 5 minutes; after that, a per-5-minute fee plus the DeepSeek cost × markup.",
    "lectureModeNoWallet": "No Wallet: metered, not charged",
    "lectureBaseMinutes": "Base minutes",
    "lectureBasePrice": "Base price",
    "lectureExtraPrice": "Fee after base minutes",
    "lectureAiMarkup": "DeepSeek markup",
    "lectureAiMarkupHint": "Applied to the token cost after the base minutes",
    "lectureAiInput": "DeepSeek: input tokens",
    "lectureAiOutput": "DeepSeek: output tokens",
    "lectureDailyCap": "Daily recording cap",
    "lectureDailyCapHint": "Until there is a Wallet — a per-user safety cap (0 = none). Admins are exempt.",
    "lectureUnitMin": "min",
    "lectureMonth": "This month: {lectures} lectures, {minutes} min, {cost} ₽ metered, {tokens} DeepSeek tokens",
    "lectureUnitPer5Min": "₽ / 5 min"
  },
  "hi": {
    "lectureTariff": "लेक्चर नोट्स — मूल्य",
    "lectureTariffHint": "लेक्चर के पहले मिनट हर शुरू हुए 5 मिनट के आधार मूल्य पर; उसके बाद 5 मिनट का शुल्क और DeepSeek लागत × मार्कअप।",
    "lectureModeNoWallet": "वॉलेट नहीं: गिना जाता है, काटा नहीं जाता",
    "lectureBaseMinutes": "आधार मिनट",
    "lectureBasePrice": "आधार मूल्य",
    "lectureExtraPrice": "आधार मिनट के बाद शुल्क",
    "lectureAiMarkup": "DeepSeek मार्कअप",
    "lectureAiMarkupHint": "आधार मिनट के बाद टोकन लागत पर लागू",
    "lectureAiInput": "DeepSeek: इनपुट टोकन",
    "lectureAiOutput": "DeepSeek: आउटपुट टोकन",
    "lectureDailyCap": "प्रतिदिन रिकॉर्डिंग सीमा",
    "lectureDailyCapHint": "वॉलेट आने तक — प्रति उपयोगकर्ता सीमा (0 = कोई नहीं)। एडमिन पर लागू नहीं।",
    "lectureUnitMin": "मिनट",
    "lectureMonth": "इस महीने: {lectures} लेक्चर, {minutes} मिनट, {cost} ₽ गिना गया, {tokens} DeepSeek टोकन",
    "lectureUnitPer5Min": "₽ / 5 मिनट"
  },
  "zh": {
    "lectureTariff": "课堂笔记——资费",
    "lectureTariffHint": "讲座前若干分钟按每开始的 5 分钟基础价计费；之后按每 5 分钟附加费加 DeepSeek 成本 × 加价倍数计费。",
    "lectureModeNoWallet": "无钱包：只计量，不扣费",
    "lectureBaseMinutes": "基础分钟数",
    "lectureBasePrice": "基础价格",
    "lectureExtraPrice": "基础分钟后的附加费",
    "lectureAiMarkup": "DeepSeek 加价倍数",
    "lectureAiMarkupHint": "适用于基础分钟之后的 token 成本",
    "lectureAiInput": "DeepSeek：输入 token",
    "lectureAiOutput": "DeepSeek：输出 token",
    "lectureDailyCap": "每日录音上限",
    "lectureDailyCapHint": "在有钱包之前——每位用户的安全上限（0 = 不限）。管理员不受限。",
    "lectureUnitMin": "分钟",
    "lectureMonth": "本月：{lectures} 场讲座，{minutes} 分钟，计费 {cost} ₽，DeepSeek {tokens} 个 token",
    "lectureUnitPer5Min": "₽ / 5 分钟"
  }
} as const

export type TariffLocale = keyof typeof TARIFF_LABELS
