'use client'

import { useQueryParams } from '@/shared/helpers/setQueryParams'
import { UserHeaderCardProps } from '@/shared/types'
import Image from 'next/image'
import { useState } from 'react'
import { SelectPhotoInput } from '../../inputs/SelectPhotoInput/SelectPhotoInput'
import UserHeaderCard from '../../User/UserHeaderCard/UserHeaderCard'
import { PostCommentModal } from './Postcommentmodal/Postcommentmodal'
import styles from './PostCommentSection.module.scss'

export const mockComments: {
  user: UserHeaderCardProps
  commentText: string
  images: string[]
}[] = [
  {
    user: {
      cardID: 'card-1',
      userID: 'user-1',
      name: 'Savannah Johnson',
      role: 'Admin',
      image: 'https://i.pravatar.cc/40?img=47',
      dateActivity: '1d',
      BlurDots: true
    },
    commentText:
      'Improving the user experience in mobile app design is crucial for retaining users and growing your product.',
    images: ['https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=200&h=200&fit=crop']
  },
  {
    user: {
      cardID: 'card-2',
      userID: 'user-2',
      name: 'Savannah Johnson',
      role: 'Admin',
      image: 'https://i.pravatar.cc/40?img=47',
      dateActivity: '1d',
      BlurDots: true
    },
    commentText: 'Improving the user experience in mobile app design is crucial for building products people love.',
    images: []
  },
  {
    user: {
      cardID: 'card-3',
      userID: 'user-3',
      name: 'Marcus Rivera',
      role: 'Member',
      image: 'https://i.pravatar.cc/40?img=12',
      dateActivity: '2d',
      BlurDots: false
    },
    commentText: 'Great post! Really helpful insights.',
    images: []
  },
  {
    user: {
      cardID: 'card-4',
      userID: 'user-4',
      name: 'Elena Petrova',
      role: 'Admin',
      image: 'https://i.pravatar.cc/40?img=32',
      dateActivity: '3d',
      BlurDots: true
    },
    commentText:
      'This is exactly what I needed to read today. The tips on onboarding flows are something our team has been discussing for weeks.',
    images: [
      'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=200&h=200&fit=crop'
    ]
  },
  {
    user: {
      cardID: 'card-5',
      userID: 'user-5',
      name: "James O'Brien",
      role: 'Member',
      image: 'https://i.pravatar.cc/40?img=60',
      dateActivity: '4d',
      BlurDots: false
    },
    commentText: 'Bookmarked this. Will share with my design team!',
    images: []
  },
  {
    user: {
      cardID: 'card-6',
      userID: 'user-6',
      name: 'Yuki Tanaka',
      role: 'Member',
      image: 'https://i.pravatar.cc/40?img=25',
      dateActivity: '5d',
      BlurDots: false
    },
    commentText: 'I especially agree with the point about reducing cognitive load. Simpler = better, always.',
    images: []
  }
]

export function PostCommentSection({
  comments,
  totalComments
}: {
  comments: {user: UserHeaderCardProps; commentText: string; images: string[]}[]
  totalComments: number
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [draftImages, setDraftImages] = useState<{file: File; url: string}[]>([])

  const {getQueryParam, setQueryParams} = useQueryParams()
  const scrollToCommentId = getQueryParam('commentIdToScroll')

  const handleOpenModal = () => setIsModalOpen(true)

  const handleCloseModal = (e: React.MouseEvent) => {
    setIsModalOpen(false)
    if (scrollToCommentId) {
      setQueryParams({commentIdToScroll: null}, {replace: true})
    }
  }

  const handleSelectFile = (file: File) => {
    const url = URL.createObjectURL(file)
    setDraftImages((prev) => [...prev, {file, url}])
  }

  const handleRemoveDraft = (url: string) => {
    setDraftImages((prev) => {
      const removed = prev.find((img) => img.url === url)
      if (removed) URL.revokeObjectURL(removed.url)
      return prev.filter((img) => img.url !== url)
    })
  }

  return (
    <>
      <div className={styles.box}>
        <div className={styles.header}>
          <p className={styles.total_comments}>Comments ({totalComments})</p>
          <button className={styles.view_all_button} onClick={handleOpenModal}>
            view all
          </button>
        </div>

        <div className={styles.content}>
          <ul>
            {comments?.map((el, i) => {
              if (i >= 10) return null
              const isLong = el.commentText.length > 50
              return (
                <div className={styles.comment_item} key={`${el.user.userID}-${i}`}>
                  <UserHeaderCard size='sm' {...el.user} />
                  <div className={styles.comment_content}>
                    <p className={styles.comment_text_mini}>
                      {isLong ? el.commentText.slice(0, 50) : el.commentText}
                      {isLong && (
                        <>
                          {' '}
                          ...
                          <span
                            onClick={() => {
                              handleOpenModal()
                              setQueryParams({commentIdToScroll: el.user.userID})
                            }}
                            className={styles.see_more}
                          >
                            {' '}
                            See more
                          </span>
                        </>
                      )}
                    </p>
                    {el.images.length > 0 && (
                      <div className={styles.images_previews}>
                        {el.images.map((url) => (
                          <Image
                            className={styles.image_preview}
                            key={url}
                            width={80}
                            height={80}
                            alt='comment image'
                            src={url}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {comments?.length >= 10 && totalComments >= 10 && (
              <button className={styles.show_all_bottom_button} onClick={handleOpenModal}>
                Show All
              </button>
            )}
          </ul>
        </div>

        <div className={styles.comment_input_bar}>
          <SelectPhotoInput size='m' onSelectImageFile={handleSelectFile} />
          <div className={styles.input_area}>
            {draftImages.length > 0 && (
              <div className={styles.draft_previews}>
                {draftImages.map(({url}) => (
                  <div key={url} className={styles.draft_preview_wrap}>
                    <Image src={url} alt='draft' width={40} height={40} className={styles.draft_preview_img} />
                    <button
                      className={styles.draft_remove_btn}
                      onClick={() => handleRemoveDraft(url)}
                      aria-label='Remove image'
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input className={styles.comment_input} type='text' placeholder='Write your comment here' />
          </div>
          <button className={styles.send_button} aria-label='Send comment'>
            <svg
              width='22'
              height='22'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='1.8'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <line x1='22' y1='2' x2='11' y2='13' />
              <polygon points='22 2 15 22 11 13 2 9 22 2' />
            </svg>
          </button>
        </div>
      </div>

      <PostCommentModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        comments={comments}
        totalComments={totalComments}
        scrollToCommentId={scrollToCommentId}
      />
    </>
  )
}
