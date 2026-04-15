'use client'
import {UserRolesObject} from '@/shared/constants/user/user.const'
import {PostCommentSection, UserPostInfo} from '@/shared/ui'
import {mockComments} from '@/shared/ui/Posts/PostCommentSection/PostCommentSection'
import {NavBar} from '@/widgets/BaseUI'
import {BorderTextHandler, FullPost} from '@/widgets/Cards'
import styles from './PostPage.module.scss'

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
`

const mockUserPostInfo = {
  avatarUrl: 'https://i.pravatar.cc/120?img=47',
  name: 'Ekaterina Ivanova',
  email: '@Ekaterina',
  userId: 'user-001',
  userType: UserRolesObject.Admin,
  totalView: 50000,
  publishDate: new Date('2024-07-20T04:21:00Z'),
  postCategory: 'Science'
}

function PostPage({id}: {id: string}) {
  return (
    <div className={`container default_content ${styles.extra_content}`}>
      <NavBar />
      <BorderTextHandler />

      <div className={styles.mobile_wrapper}>
        <UserPostInfo {...mockUserPostInfo} />
        <FullPost extraClass={styles.extra_full} body={markdown} postId={id} />
        <PostCommentSection comments={mockComments} totalComments={400} />
      </div>

      <FullPost extraClass={styles.extra_full_bot} body={markdown} postId={id} />
      <div className={`${styles.sticky_sidebar} ${styles.not_mobile_box}`}>
        <UserPostInfo {...mockUserPostInfo} /> <PostCommentSection comments={mockComments} totalComments={400} />
      </div>

      <div className='mobile_padding'></div>
    </div>
  )
}
export default PostPage
