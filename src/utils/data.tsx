interface Author {
   name: string;
   role: 'admin' | 'trustedAuthor' | 'null'; // Можно добавить другие роли по желанию
   avatar: string;
}

interface HighlightedPost {
   highlightedTitle: string;
   _id: string;
   title: string;
   subtitle: string;
   publickDate: string; //уточнить формат даты
   highlightedImage: string;
   author: Author;
}
interface DefaultPost {
   _id: string;
   title: string;
   subtitle: string;
   publickDate: string; //уточнить формат даты
   images: string[];
   author: Author;
   commentsNumber:string;
   vuesNumber:string;
   stars: string;
}
interface AllPosts {
   highlighted: HighlightedPost[];
   allPosts: DefaultPost[];
}
export const AllPosts: AllPosts = {
   "highlighted": [{
      "highlightedTitle": "Highlight",
      "_id": "123123",
      "title": "Title",
      "subtitle": "SubTitle",
      "publickDate": "дата в каком о формате",
      "highlightedImage":"imageUrl",
      "author": {"name":"John Smith", "role":"admin", "avatar":"someUrl"},//при желании можешь и другие роли добавить или переименовать
   },{
      "highlightedTitle": "Highlight",
      "_id": "123123",
      "title": "Title",
      "subtitle": "SubTitle",
      "publickDate": "дата в каком о формате",
      "highlightedImage":"imageUrl",
      "author": {"name":"John Smith", "role":"admin", "avatar":"avatarURL"}
   }],
   "allPosts":[{
      "_id": "123123",
      "title": "Title",
      "subtitle": "SubTitle",
      "publickDate": "дата в каком о формате",
      "images":["imageUrl","VideoUrl"],
      "author": {"name":"John Smith", "role":"admin", "avatar":"avatarURL"},
      //plus
      "commentsNumber":"123",
      "vuesNumber":"123",
      "stars":"4.3",
   }]
}