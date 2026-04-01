export interface ICardUser {
  id?: string | number
  name?: string
  image?: string
  role?: string
  dateActivity?: string
}

export interface ICard {
  title: string
  subTitle: string
  highlightText?: string
  user: ICardUser
  imagesArray?: string[]
  comments: string
  vues: string
  stars: string
  commentsCount?: string
  cardId: string
  userId?: string
  useLink?: boolean
}
