import { FC, useEffect, useState } from 'react'
import style from './FullPost.module.scss'
//@ts-ignore
import Markdown from 'react-markdown'
//@ts-ignore
import remarkGfm from 'remark-gfm'
import postAPI from '../../services/PostService';
import remarkParse from 'remark-parse';
//@ts-ignore
import {Prism as SyntaxHighlighter} from 'react-syntax-highlighter'
//@ts-ignore
import {dark,okaidia,a11yDark} from 'react-syntax-highlighter/dist/esm/styles/prism'
// @ts-ignore
import rehypeRaw from 'rehype-raw'
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import warSvg from '../../images/svg/warr.svg'
import datsSvg from '../../images/svg/threeDats.svg'
import leftArrow from '../../images/svg/leftArrowBlack.svg'
import shareSvg from '../../images/svg/share.svg'
import Tooltip from '@mui/material/Tooltip';
import preloader from '../../images/loaders/Bean Eater@1x-1.0s-200px-200px.svg'
import Skeleton from '@mui/material/Skeleton';



const SkeletonFullPost = () =>{

  return <div>
  <Skeleton variant="rounded" width={"60%"} height={40} className={style.skeleton_main_title} />
  <Skeleton variant="rounded" width={"100%"} height={30} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={30} style={{marginBottom:"45px"}} className={style.skeleton_main_subtitle} />

  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} style={{marginBottom:"35px"}} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={250} style={{marginBottom:"35px"}} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22}  style={{marginBottom:"25px"}} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22}  className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
  <Skeleton variant="rounded" width={"100%"} height={22} className={style.skeleton_main_subtitle} />
</div>
}
function replaceImageLinks(body:string, images:string[]) {
  // Регулярное выражение для поиска ссылок изображений
  const imageRegex = /!\[.*?\]\((.*?)\)/g;

  let index = 0; // Индекс для массива images

  // Заменяем все найденные ссылки на ссылки из массива images
  return body.replace(imageRegex, (match) => {
      if (index < images.length) {
          return `![Текст если изображение не загрузилось](${images[index++]})`;
      }
      return match; // Если изображений больше нет, оставляем оригинал
  });
}

const markdown = `
 пишем текст текст текст == Whereas recogni == хуяк

---
<a href="https://api64w.ilovepdf.com/v1/download/84tr3zp3v3m94jy08xrjygkjsp8c0x3b2qngqnfz4rAd569Ag1y1t44v01r2wvl3bz7q93wr5hml3dt7xllq3c5dnlb6kjtp1twfrfw4mz6r6km9f4yfth4kgp8yrq1yAndqsz50xdbf1n1s5f4wc98qsv58mk5bv5hAmpn1jpz2bwrdwvb1" download>Скачать PDF файл</a>

</div>

== Whereas recogni ==
== Whereas recogni ==
== Whereas recogni ==

ttttttt
tttttt
tttttt

ttttttt
ttttttt\n

\`\`\` js
import React from 'react'
import ReactDOM from 'react-dom'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'


ReactDOM.render(
  <Markdown rehypePlugins={[rehypeHighlight]}>{markdown}</Markdown>,
  document.querySelector('#content')
) 
\`\`\`

---

# Mastering the Art of Programming: A Journey from Beginner to Expert
## Ссылки
### Ссылки
#### Ссылки
##### Ссылки
###### Ссылки


[Простая ссылка](https://docs.google.com/document/d/1HM-jQmJSJi0HkteKZzRK9WPNFR1ctqurttNIq__Qx4s/edit?usp=drive_link)

[Ссылка с подсказкой](https://example.com "Подсказка при наведении")

---

## Изображения

![Текст если изображение не загрузилось](https://images.pexels.com/photos/29743804/pexels-photo-29743804.jpeg?auto=compress&cs=tinysrgb&w=800&lazy=load)

---

~~~js
console.log(cdacsdc)

<PRE></PRE>
~~~

## Списки

### Маркированный список:
- Элемент 1
  - Подэлемент 1.1
  
- Элемент 2
- Элемент 3

### Нумерованный список:
1. Элемент 1

    2. Подэлемент 1.1
    
    2. Элемент 2

3. Элемент 3

---

## Таблицы


| Заголовок 1 | Заголовок 2 | Заголовок 3 | Заголовок 4 |
|-------------|-------------|-------------|-------------|
| Ячейка 1    | Ячейка 2    | Ячейка 3    |             |
| Ячейка 4    | Ячейка 5    | Ячейка 6    |             |

---
<div class="table_wrapper">
<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 28%" />
<col style="width: 10%" />
<col style="width: 10%" />
<col style="width: 28%" />
<col style="width: 10%" />
</colgroup>
<thead>
<tr class="header">
<th colspan="3">Кратные</th>
<th colspan="3">Дольные</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p>10<sup>1</sup></p>
<p>10<sup>2</sup></p>
<p>10<sup>3</sup></p>
<p>10<sup>6</sup></p>
<p>10<sup>9</sup></p>
<p>10<sup>12</sup></p></td>
<td><p>дека</p>
<p>гекто</p>
<p>кило</p>
<p>мега</p>
<p>гига</p>
<p>тера</p></td>
<td><p>[да]</p>
<p>[г]</p>
<p>[к]</p>
<p>[М]</p>
<p>[Г]</p>
<p>[Т]</p></td>
<td><p>10<sup>-1</sup></p>
<p>10<sup>-2</sup></p>
<p>10<sup>-3</sup></p>
<p>10<sup>-6</sup></p>
<p>10<sup>-9</sup></p>
<p>10<sup>-12</sup></p></td>
<td><p>деци</p>
<p>санти</p>
<p>мили</p>
<p>микро</p>
<p>нано</p>
<p>пико</p></td>
<td><p>[д]</p>
<p>[с]</p>
<p>[м]</p>
<p>[мк]</p>
<p>[н]</p>
<p>[п]</p></td>
</tr>
</tbody>
</table>
</div>



## Цитаты

> Это пример цитаты.  
> Цитаты могут быть многострочными.  

---

## Чек-листы

- [x] Завершённый элемент
- [ ] Незавершённый элемент

---

## Горизонтальная линия

---

---
---

## Встраивание HTML

Можно вставить HTML:

<div style="background-color: lightblue; padding: 10px;">
  Это блок с HTML внутри Markdown.
</div>
`;




const processMarkdown = (markdown:any) => {

   
  return markdown.replace(/==([^=]+)==/g, (match:any, p1:any) => {
      return `<span  class="borderText">${p1.trim()}</span>`;
  });
};


const HeaderFullPost = ()=>{
  const navigate = useNavigate();
  const paramsUrl = useParams().id;
  const [copyMessage, setCopuMessage] = useState(false);

  const handleShareClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setCopuMessage(true)
    setTimeout(() => {
      setCopuMessage(false)
    }, 2500);
    //TODO добавить актуальную ссылку
    const urlToCopy = `https://goodworker.com/posts/${paramsUrl}`;
    navigator.clipboard.writeText(urlToCopy)
      .then(() => {
        console.log('Ссылка скопирована в буфер обмена!'); 
      })
      .catch(err => {
        console.error('Ошибка при копировании: ', err);
      });
  };
  
  return <nav className={`${style.header_post}`}>
    <img src={leftArrow} className={`${style.arrowBack}`} onClick={( ) => navigate(-1)} alt="" />
    <div onClick={(e)=>{handleShareClick(e)}}  className={`${style.img_comm_box_2}`}>
   <Tooltip title={copyMessage ? "Copy" : null}>  
   <img src={shareSvg} alt="" className={`${style.comm_img}`} />
   </Tooltip>
   </div>

   <svg className={`${style.warrSvg2}`} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 7.75V13" stroke="#868897" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M21.0802 8.58003V15.42C21.0802 16.54 20.4802 17.58 19.5102 18.15L13.5702 21.58C12.6002 22.14 11.4002 22.14 10.4202 21.58L4.48016 18.15C3.51016 17.59 2.91016 16.55 2.91016 15.42V8.58003C2.91016 7.46003 3.51016 6.41999 4.48016 5.84999L10.4202 2.42C11.3902 1.86 12.5902 1.86 13.5702 2.42L19.5102 5.84999C20.4802 6.41999 21.0802 7.45003 21.0802 8.58003Z" stroke="#868897" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12 16.2002V16.3002" stroke="#868897" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
   
  </nav>
}


const FullPost:FC = () => {
  const paramsUrl = useParams().id;
 const stringPostId: any = (paramsUrl && paramsUrl.toString())
 const { data: post, error, isLoading } = postAPI.useFetchPostByIdQuery(stringPostId);

 useEffect(() => {
  const specialLinks = document.querySelectorAll<HTMLElement>('.borderText');

  const copyText = (event: MouseEvent) => {
    const target = event.target as HTMLElement; // Приводим к типу HTMLElement
    const originalText = target.innerText; // Сохраняем оригинальный текст
    const textToCopy = originalText; // Получаем текст из элемента

    navigator.clipboard.writeText(textToCopy) // Копируем текст в буфер обмена
      .then(() => {
        console.log('Текст скопирован:', textToCopy);
        target.innerText = 'Скопировано!'; // Меняем текст на "Скопировано!"

        setTimeout(() => {
          target.innerText = originalText; // Возвращаем оригинальный текст
        }, 1000);
      })
      .catch(err => {
        console.error('Ошибка при копировании текста:', err);
      });
  };

  specialLinks.forEach((value) => {
    value.addEventListener('click', copyText);
  });


  return () => {
    specialLinks.forEach((value) => {
      value.removeEventListener('click', copyText);
    });
  };
  
}, [post, paramsUrl]);
console.log("post",post)  
  //  if (isLoading) return <img className={style.preloader_svg} src={preloader} alt="" />
  //  if (error && stringPostId !== "adminpost123") return <div>Error loading post</div>;
   const processedMarkdown = processMarkdown(
    stringPostId === "adminpost123" ? markdown :
    post && post.body ?  replaceImageLinks(post.body, post.images) : 
    "Error loading post"
);

// Функция для замены непонятных ссылок изображений
function replaceImageLinks(body:string, images:string[]) {
    // Регулярное выражение для поиска ссылок изображений
    const imageRegex = /!\[.*?\]\((.*?)\)/g;

    let index = 0; // Индекс для массива images

    // Заменяем все найденные ссылки на ссылки из массива images
    return body.replace(imageRegex, (match) => {
        if (index < images.length) {
            return `![Текст если изображение не загрузилось](${images[index++]})`;
        }
        return match; // Если изображений больше нет, оставляем оригинал
    });
}

  
   return <div className={`${style.full_box}`}>
    <HeaderFullPost/>

    <div className={`${style.mark_box}`}>
      
      
      {isLoading ? <SkeletonFullPost/> : <Markdown
    children={
      processedMarkdown}
      
    rehypePlugins={[rehypeRaw,remarkGfm, remarkParse]}
    components={{
      code(props) {
        const {children, className, node, ...rest} = props
        const match = /language-(\w+)/.exec(className || '')
        return match ? (
          <SyntaxHighlighter
            {...rest}
            PreTag="div"
            children={String(children).replace(/\n$/, '')}
            language={match[1]}
            style={a11yDark}
          />
        ) : (
          <code {...rest} className={className}>
            {children}
          </code>
        )
      }
    }}
  />}
   </div>
   </div> 
}
export default FullPost