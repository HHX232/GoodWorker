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


const MOCK_IMAGE   = 'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=800';
const MOCK_IMAGE_2 = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800';
const MOCK_IMAGE_3 = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800';

export const MOCK_HIGHLIGHTED_POSTS: ISliderPost[] = [
  {
    id: '1',
    title: 'Как стать Senior за 2 года',
    subtitle: 'Разбираем реальный путь роста от Junior до Senior разработчика',
    backgroundImage: MOCK_IMAGE,
    author: { id: '101', username: 'Алексей Смирнов', avatar: 'https://i.pravatar.cc/150?img=1', role: 'Teacher' },
  },
  {
    id: '2',
    title: 'TypeScript: продвинутые паттерны',
    subtitle: 'Generic, Conditional Types и mapped types на реальных примерах',
    backgroundImage: MOCK_IMAGE_2,
    author: { id: '102', username: 'Мария Иванова', avatar: 'https://i.pravatar.cc/150?img=5', role: 'Admin' },
  },
  {
    id: '3',
    title: 'Next.js App Router: полный гайд',
    subtitle: 'Server Components, layouts и streaming — всё что нужно знать',
    backgroundImage: MOCK_IMAGE_3,
    author: { id: '103', username: 'Дмитрий Козлов', avatar: 'https://i.pravatar.cc/150?img=8', role: 'Teacher' },
  },
  {
    id: '4',
    title: 'CSS Grid vs Flexbox',
    subtitle: 'Когда использовать Grid, а когда Flexbox — наглядное сравнение',
    backgroundImage: MOCK_IMAGE,
    author: { id: '104', username: 'Анна Петрова', avatar: 'https://i.pravatar.cc/150?img=9', role: 'Student' },
  },
];


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
  posts = MOCK_HIGHLIGHTED_POSTS,
  isLoading = false,
  error = false,
}) => {
  const showSkeleton = isLoading || error;

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
                  dateActivity: 'Online',
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

