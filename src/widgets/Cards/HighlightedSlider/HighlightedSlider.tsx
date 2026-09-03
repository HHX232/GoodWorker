'use client';

import Skeleton from '@mui/material/Skeleton';
import { FC } from 'react';
import { Autoplay, Navigation } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';

import 'swiper/css';
import 'swiper/css/navigation';

import HighlightedPost from '@/shared/ui/Posts/HighlightedPost/HighlightedPost';
import style from './HighlightedSlider.module.scss';


export interface ISliderAuthor {
  id: string | number;
  username: string;
  avatar?: string;
  role?: string;
}

export interface ISliderPost {
  id: string | number;
  title: string;
  subtitle: string;
  backgroundImage?: string;
  author: ISliderAuthor;
}

interface IHighlightedSlider {
  posts?: ISliderPost[];
  isLoading?: boolean;
  error?: boolean;
}

const ArrowLeft: FC = () => (
  <button
    className={`${style.custom_box_left} highlighted-prev`}
    aria-label="Previous"
  >
    <svg className={style.image_tag} viewBox="0 0 24 24" fill="none">
      <path
        d="M14 18L8 12L14 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
);

const ArrowRight: FC = () => (
  <button
    className={`${style.custom_box_right} highlighted-next`}
    aria-label="Next"
  >
    <svg className={style.image_tag} viewBox="0 0 24 24" fill="none">
      <path
        d="M10 18L16 12L10 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
);


const SkeletonSlides: FC = () => (
  <>
    {[0, 1].map((i) => (
      <SwiperSlide key={i}>
        <Skeleton
          variant="rounded"
          width="100%"
          className={style.skeleton_card}
        />
      </SwiperSlide>
    ))}
  </>
);


export  const HighlightedSlider: FC<IHighlightedSlider> = ({
  posts = [],
  isLoading = false,
  error = false,
}) => {
  const showSkeleton = isLoading || error;

  // No fabricated placeholder posts — if there's nothing real to show and
  // we're not actively loading, just don't render the slider at all.
  if (!showSkeleton && posts.length === 0) return null;

  return (
    <div className={style.slider_wrapper}>
      <ArrowLeft />
      <ArrowRight />

      <Swiper
        modules={[Autoplay, Navigation]}
        spaceBetween={16}
        loop={!showSkeleton}
        autoplay={{ delay: 5000, disableOnInteraction: false }}
        navigation={{
          prevEl: '.highlighted-prev',
          nextEl: '.highlighted-next',
        }}
        style={{ overflow: 'hidden' }} 
        breakpoints={{
          0:   { slidesPerView: 1 },
          640: { slidesPerView: 1 },
          900: { slidesPerView: 2 },
        }}
        className={style.swiper_box}
      >
        {showSkeleton ? (
          <SkeletonSlides />
        ) : (
          posts.map((post) => (
            <SwiperSlide key={post.id} className={style.swiper_slide}>
              <HighlightedPost
                cardId={post.id.toString()}
                backgroundImage={post.backgroundImage}
                highLightTitle={post.title}
                defaultTitle={post.title}
                subtitle={post.subtitle}
                user={{
                  id: post.author.id,
                  name: post.author.username,
                  image: post.author.avatar ?? '',
                  dateActivity: '',
                  role: post.author.role,
                }}
              />
            </SwiperSlide>
          ))
        )}
      </Swiper>
    </div>
  );
};

