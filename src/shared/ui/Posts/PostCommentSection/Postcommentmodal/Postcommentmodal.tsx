'use client';

import { UserHeaderCardProps } from '@/shared/types';
import { SelectPhotoInput } from '@/shared/ui/inputs/SelectPhotoInput/SelectPhotoInput';
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault';
import UserHeaderCard from '@/shared/ui/User/UserHeaderCard/UserHeaderCard';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import styles from './Postcommentmodal.module.scss';

interface PostCommentModalProps {
  isOpen: boolean;
  onClose: (e: React.MouseEvent) => void;
  comments: { user: UserHeaderCardProps; commentText: string; images: string[] }[];
  totalComments: number;
  scrollToCommentId?: string | null;
}

export function PostCommentModal({
  isOpen,
  onClose,
  comments,
  totalComments,
  scrollToCommentId,
}: PostCommentModalProps) {
  const [draftImages, setDraftImages] = useState<{ file: File; url: string }[]>([]);

  const handleSelectFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setDraftImages((prev) => [...prev, { file, url }]);
  };

  const handleRemoveDraft = (url: string) => {
    setDraftImages((prev) => {
      const removed = prev.find((img) => img.url === url);
      if (removed) URL.revokeObjectURL(removed.url);
      return prev.filter((img) => img.url !== url);
    });
  };

  // Scroll to target comment after modal opens
  useEffect(() => {
    if (!isOpen || !scrollToCommentId) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(scrollToCommentId);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, scrollToCommentId]);

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={onClose}
      additionalTitle={
        <p className={styles.modal_title}>Comments ({totalComments})</p>
      }
    >
      <div className={styles.box}>
        {/* Comments list */}
        <div className={styles.content}>
          <ul>
            {comments.map((el, i) => (
              <div
                className={styles.comment_item}
                key={`${el.user.userID}-${i}`}
                id={el.user.userID}
              >
                <UserHeaderCard size="lg" {...el.user} />

                <div className={styles.comment_content}>
                  <p className={styles.comment_text}>{el.commentText}</p>

                  {el.images.length > 0 && (
                    <div className={styles.images_previews}>
                      {el.images.map((url) => (
                        <div key={url} className={styles.image_wrap}>
                          <Image
                            className={styles.image_preview}
                            src={url}
                            alt={`comment image`}
                            fill
                            sizes="(max-width: 600px) 100px, 200px"
                            style={{ objectFit: 'cover' }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </ul>
        </div>

        {/* Fixed bottom input */}
        <div className={styles.comment_input_bar}>
          <SelectPhotoInput size="m" onSelectImageFile={handleSelectFile} />

          <div className={styles.input_area}>
            {draftImages.length > 0 && (
              <div className={styles.draft_previews}>
                {draftImages.map(({ url }) => (
                  <div key={url} className={styles.draft_preview_wrap}>
                    <Image
                      src={url}
                      alt="draft"
                      width={40}
                      height={40}
                      className={styles.draft_preview_img}
                    />
                    <button
                      className={styles.draft_remove_btn}
                      onClick={() => handleRemoveDraft(url)}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              className={styles.comment_input}
              type="text"
              placeholder="Write your comment here"
            />
          </div>

          <button className={styles.send_button} aria-label="Send comment">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </ModalWindowDefault>
  );
}