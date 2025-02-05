import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { IDefaultPost, ICustomPost } from '../interfaces/interfaces';
import { i } from 'vite/dist/node/types.d-aGj9QkWt';

interface HighlightedPostObj {
    title: string;
    subtitle:string;
    image?: string;
    images?: string[];
    publicationDate: string;
    video: string;
    videoPreview:string;
    id: number | string;
    author:{
      avatar: string | null;
      id: number | string;
      username:string;
      roles: string| string[];
    };
    user?:{
      avatar: string | null;
      id: number | string;
      username:string;
      roles: string| string[];
      role?:string | undefined;
    }
    commentsCount?:string;
    viewsCount?:string;
    starsCount?:string;
  }
interface PostsResponse {
    highlightedPosts: HighlightedPostObj[];
    posts: IDefaultPost[];
  }
// export const postAPI = createApi({
//     reducerPath: 'postAPI',
//     baseQuery : fetchBaseQuery({baseUrl:"https://jsonplaceholder.typicode.com"}),
//     tagTypes:['Post'],
//     endpoints: (build)=>({
//         fetchAllPosts:build.query<IPost[], number>({
//    query:(limit = 5)=>({
//       url: '/posts',
//       params:{
//          _limit: limit
//       }
//    }),
//    //запрос/ы обозначены тегом пост
//    providesTags: result => ['Post']
// }),
// //если бы мы создали POST запрос то для автоматического перезапроса на сервер за новыми данными
// //! invalidatesTags;['Post']
//     })
// });

export const postAPI = createApi({
    reducerPath: 'postAPI', // Название ключа в хранилище
    baseQuery: fetchBaseQuery({ baseUrl: 'https://goodworker.onrender.com/api/v1' }),
    tagTypes: ['Posts'], // Теги для кэширования и перезапроса
    endpoints: (build) => ({

      fetchAllPosts: build.query<PostsResponse, void>({
        query: () => '/all_posts',
        providesTags: (result) => ['Posts'], 
      }),
      fetchPostById: build.query<ICustomPost, string>({
        query: (id) => `/posts/${id}`,
        providesTags: (result, error, id) => [{ type: 'Posts', id }],
      }),
    }),
  });

  export default postAPI;