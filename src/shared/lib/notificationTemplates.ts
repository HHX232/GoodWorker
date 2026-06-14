type LangMap = { ru: string; en: string; hi: string; zh: string }

interface NotifContent {
  title: string
  body: string
  titleTranslations: LangMap
  bodyTranslations: LangMap
}

function mk(title: LangMap, body: LangMap): NotifContent {
  return { title: title.ru, body: body.ru, titleTranslations: title, bodyTranslations: body }
}

export function tplNewComplaint(
  actorName: string,
  targetTitle: string,
  targetType: 'roadmap' | 'post',
): NotifContent {
  const isRoadmap = targetType === 'roadmap'
  return mk(
    { ru: 'Новая жалоба', en: 'New Complaint', hi: 'नई शिकायत', zh: '新投诉' },
    {
      ru: isRoadmap
        ? `${actorName} пожаловался на блок курса «${targetTitle}»`
        : `${actorName} пожаловался на пост «${targetTitle}»`,
      en: isRoadmap
        ? `${actorName} filed a complaint about a block in the course «${targetTitle}»`
        : `${actorName} filed a complaint about the post «${targetTitle}»`,
      hi: isRoadmap
        ? `${actorName} ने पाठ्यक्रम «${targetTitle}» के एक ब्लॉक की शिकायत की`
        : `${actorName} ने पोस्ट «${targetTitle}» की शिकायत की`,
      zh: isRoadmap
        ? `${actorName} 投诉了课程《${targetTitle}》中的内容`
        : `${actorName} 投诉了帖子《${targetTitle}》`,
    },
  )
}

export function tplNewStudent(studentName: string, courseTitle: string): NotifContent {
  return mk(
    { ru: 'Новый ученик', en: 'New Student', hi: 'नया छात्र', zh: '新学员' },
    {
      ru: `${studentName} получил доступ к курсу «${courseTitle}»`,
      en: `${studentName} has been granted access to the course «${courseTitle}»`,
      hi: `${studentName} को पाठ्यक्रम «${courseTitle}» तक पहुँच मिली`,
      zh: `${studentName} 已获得课程《${courseTitle}》的访问权限`,
    },
  )
}

export function tplRoadmapPurchase(studentName: string, courseTitle: string): NotifContent {
  return mk(
    { ru: 'Новая покупка', en: 'New Purchase', hi: 'नई खरीद', zh: '新购买' },
    {
      ru: `${studentName} приобрёл курс «${courseTitle}»`,
      en: `${studentName} purchased the course «${courseTitle}»`,
      hi: `${studentName} ने पाठ्यक्रम «${courseTitle}» खरीदा`,
      zh: `${studentName} 购买了课程《${courseTitle}》`,
    },
  )
}

export function tplNewComment(authorName: string, postTitle: string): NotifContent {
  return mk(
    { ru: 'Новый комментарий', en: 'New Comment', hi: 'नई टिप्पणी', zh: '新评论' },
    {
      ru: `${authorName} оставил комментарий к посту «${postTitle}»`,
      en: `${authorName} commented on the post «${postTitle}»`,
      hi: `${authorName} ने पोस्ट «${postTitle}» पर टिप्पणी की`,
      zh: `${authorName} 评论了帖子《${postTitle}》`,
    },
  )
}

export function tplVideoCallInvite(senderName: string, roomName: string): NotifContent {
  return mk(
    {
      ru: 'Приглашение в видеозвонок',
      en: 'Video Call Invitation',
      hi: 'वीडियो कॉल आमंत्रण',
      zh: '视频通话邀请',
    },
    {
      ru: `${senderName} приглашает вас в комнату «${roomName}»`,
      en: `${senderName} is inviting you to the room «${roomName}»`,
      hi: `${senderName} आपको कमरे «${roomName}» में आमंत्रित कर रहे हैं`,
      zh: `${senderName} 邀请您进入房间《${roomName}》`,
    },
  )
}

export function tplPersonalService(
  serviceTitle: string,
  price: number,
  currency: string,
): NotifContent {
  return mk(
    {
      ru: 'Личное предложение от преподавателя',
      en: 'Personal Offer from Teacher',
      hi: 'शिक्षक का व्यक्तिगत प्रस्ताव',
      zh: '来自老师的个人报价',
    },
    {
      ru: `Преподаватель создал для вас личное предложение: «${serviceTitle}» — ${price} ${currency}`,
      en: `Your teacher made you a personal offer: «${serviceTitle}» — ${price} ${currency}`,
      hi: `आपके शिक्षक ने आपके लिए एक व्यक्तिगत प्रस्ताव बनाया: «${serviceTitle}» — ${price} ${currency}`,
      zh: `您的老师为您创建了个人报价：《${serviceTitle}》— ${price} ${currency}`,
    },
  )
}

export function tplComplaintReplied(): NotifContent {
  return mk(
    {
      ru: 'Ответ на вашу жалобу',
      en: 'Reply to Your Complaint',
      hi: 'आपकी शिकायत का जवाब',
      zh: '投诉回复',
    },
    {
      ru: 'Автор контента ответил на вашу жалобу',
      en: 'The content author replied to your complaint',
      hi: 'सामग्री के लेखक ने आपकी शिकायत का जवाब दिया',
      zh: '内容作者回复了您的投诉',
    },
  )
}

export function tplComplaintClosed(): NotifContent {
  return mk(
    { ru: 'Жалоба закрыта', en: 'Complaint Closed', hi: 'शिकायत बंद', zh: '投诉已关闭' },
    {
      ru: 'Ваша жалоба была закрыта администратором',
      en: 'Your complaint has been closed by an administrator',
      hi: 'आपकी शिकायत एक प्रशासक द्वारा बंद की गई है',
      zh: '您的投诉已被管理员关闭',
    },
  )
}

export function tplFeedbackPromo(promoCode: string): NotifContent {
  return mk(
    {
      ru: 'Спасибо за обратную связь!',
      en: 'Thank you for your feedback!',
      hi: 'आपकी प्रतिक्रिया के लिए धन्यवाद!',
      zh: '感谢您的反馈！',
    },
    {
      ru: `Вы получили промокод за первый отзыв: ${promoCode}`,
      en: `You received a promo code for your first review: ${promoCode}`,
      hi: `आपको पहली समीक्षा के लिए एक प्रोमो कोड मिला: ${promoCode}`,
      zh: `您获得了首次评论的优惠码：${promoCode}`,
    },
  )
}

export function tplFeedbackValuable(): NotifContent {
  return mk(
    {
      ru: 'Ваш отзыв отмечен как ценный',
      en: 'Your Feedback Has Been Marked as Valuable',
      hi: 'आपकी प्रतिक्रिया को मूल्यवान माना गया',
      zh: '您的反馈被标记为有价值',
    },
    {
      ru: 'Администраторы рассмотрели ваш отзыв и нашли информацию полезной. Если она окажется стоящей — вы получите вознаграждение.',
      en: 'Administrators reviewed your feedback and found it useful. If it proves worthwhile, you will receive a reward.',
      hi: 'प्रशासकों ने आपकी प्रतिक्रिया की समीक्षा की और जानकारी को उपयोगी पाया। यदि यह मूल्यवान साबित होती है, तो आपको पुरस्कार मिलेगा।',
      zh: '管理员审查了您的反馈并认为信息有用。如果证明有价值，您将获得奖励。',
    },
  )
}

export function tplServiceBooking(
  studentName: string,
  serviceTitle: string,
  desiredDate?: string | null,
  desiredTime?: string | null,
): NotifContent {
  const dateRu = desiredDate && desiredTime
    ? ` на ${desiredDate} в ${desiredTime}`
    : desiredDate ? ` на ${desiredDate}` : ''
  const dateEn = desiredDate && desiredTime
    ? ` for ${desiredDate} at ${desiredTime}`
    : desiredDate ? ` for ${desiredDate}` : ''
  const dateHi = desiredDate && desiredTime
    ? ` ${desiredDate} को ${desiredTime} बजे के लिए`
    : desiredDate ? ` ${desiredDate} के लिए` : ''
  const dateZh = desiredDate && desiredTime
    ? `，时间：${desiredDate} ${desiredTime}`
    : desiredDate ? `，日期：${desiredDate}` : ''

  return mk(
    { ru: 'Новая запись на услугу', en: 'New Service Booking', hi: 'नई सेवा बुकिंग', zh: '新服务预约' },
    {
      ru: `${studentName} записался на «${serviceTitle}»${dateRu}`,
      en: `${studentName} booked «${serviceTitle}»${dateEn}`,
      hi: `${studentName} ने «${serviceTitle}»${dateHi} बुक किया`,
      zh: `${studentName} 预约了《${serviceTitle}》${dateZh}`,
    },
  )
}

export function tplBookingConfirmed(serviceName: string, desiredDate?: string | null, desiredTime?: string | null): NotifContent {
  const dateRu = desiredDate && desiredTime
    ? ` на ${desiredDate} в ${desiredTime}`
    : desiredDate ? ` на ${desiredDate}` : ''
  const dateEn = desiredDate && desiredTime
    ? ` for ${desiredDate} at ${desiredTime}`
    : desiredDate ? ` for ${desiredDate}` : ''
  const dateHi = desiredDate && desiredTime
    ? ` ${desiredDate} को ${desiredTime} बजे के लिए`
    : desiredDate ? ` ${desiredDate} के लिए` : ''
  const dateZh = desiredDate && desiredTime
    ? `，时间：${desiredDate} ${desiredTime}`
    : desiredDate ? `，日期：${desiredDate}` : ''

  return mk(
    { ru: 'Запись подтверждена', en: 'Booking Confirmed', hi: 'बुकिंग की पुष्टि हुई', zh: '预约已确认' },
    {
      ru: `Учитель подтвердил вашу запись на «${serviceName}»${dateRu}`,
      en: `Your teacher confirmed your booking for «${serviceName}»${dateEn}`,
      hi: `आपके शिक्षक ने «${serviceName}»${dateHi} के लिए आपकी बुकिंग की पुष्टि की`,
      zh: `您的老师确认了您对《${serviceName}》的预约${dateZh}`,
    },
  )
}

export function tplBookingRescheduled(confirmedDate?: string | null, confirmedTime?: string | null): NotifContent {
  const dateStr = confirmedDate && confirmedTime ? `${confirmedDate} в ${confirmedTime}` : confirmedDate ?? ''
  const dateEn = confirmedDate && confirmedTime ? `${confirmedDate} at ${confirmedTime}` : confirmedDate ?? ''
  const dateHi = confirmedDate && confirmedTime ? `${confirmedDate} को ${confirmedTime} बजे` : confirmedDate ?? ''
  const dateZh = confirmedDate && confirmedTime ? `${confirmedDate} ${confirmedTime}` : confirmedDate ?? ''

  return mk(
    {
      ru: 'Новое время для записи',
      en: 'Booking Rescheduled',
      hi: 'बुकिंग का समय बदला',
      zh: '预约时间已更改',
    },
    {
      ru: `Учитель предложил другое время: ${dateStr}`,
      en: `Your teacher suggested a new time: ${dateEn}`,
      hi: `आपके शिक्षक ने नया समय सुझाया: ${dateHi}`,
      zh: `您的老师建议了新时间：${dateZh}`,
    },
  )
}

export function tplBookingCancelled(serviceName: string): NotifContent {
  return mk(
    { ru: 'Запись отменена', en: 'Booking Cancelled', hi: 'बुकिंग रद्द', zh: '预约已取消' },
    {
      ru: `Учитель отменил вашу запись на «${serviceName}»`,
      en: `Your teacher cancelled your booking for «${serviceName}»`,
      hi: `आपके शिक्षक ने «${serviceName}» के लिए आपकी बुकिंग रद्द कर दी`,
      zh: `您的老师取消了您对《${serviceName}》的预约`,
    },
  )
}
