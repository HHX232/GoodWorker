import { Skeleton } from '@mui/material';
import { Children, FC } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { a11yDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';

import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';

import style from './FullPost.module.scss';
import HeaderFullPost from './HeaderFullPost/HeaderFullPost';

SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('sql', sql);


interface IFullPost {
  postId: string;
  body?: string;
  images?: string[];
  isLoading?: boolean;
  error?: boolean;
  extraClass?: string;
}


function replaceImageLinks(body: string, images: string[]): string {
  const imageRegex = /!\[.*?\]\((.*?)\)/g;
  let index = 0;
  return body.replace(imageRegex, (match) => {
    if (index < images.length) {
      return `![Изображение не загрузилось](${images[index++]})`;
    }
    return match;
  });
}

function processMarkdown(markdown: string): string {
  return markdown.replace(/==([^=]+)==/g, (_match, p1) => {
    return `<span class="borderText">${p1.trim()}</span>`;
  });
}


const SkeletonFullPost: FC = () => (
  <div>
    <Skeleton
      variant="rounded"
      width="60%"
      height={40}
      className={style.skeleton_main_title}
    />
    {[100, 100, 100, 100, 100, 250, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100].map(
      (h, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          width="100%"
          height={h}
          className={style.skeleton_main_subtitle}
          style={
            i === 2 ? { marginBottom: 45 } :
            i === 5 ? { marginBottom: 35 } :
            undefined
          }
        />
      )
    )}
  </div>
);


const markdownComponents: Components = {
  code(props) {
    const { children, className, ...rest } = props;
    const match = /language-(\w+)/.exec(className || '');
    return match ? (
      <SyntaxHighlighter
        language={match[1]}
        style={a11yDark}
        PreTag="div"
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  },

  colgroup({ children, ...props }) {
    return (
      <colgroup {...props}>
        {Children.map(children, (child) => {
          if (typeof child === 'string' && child.trim() === '') return null;
          return child;
        })}
      </colgroup>
    );
  },

  table({ children, ...props }) {
    return (
      <div className={style.table_wrapper}>
        <table {...props}>{children}</table>
      </div>
    );
  },
};


export const FullPost: FC<IFullPost> = ({
  body,
  images = [],
  isLoading = false,
  postId,
  extraClass,
}) => {
  const processedMarkdown = processMarkdown(
    body ? replaceImageLinks(body, images) : 'Ошибка загрузки поста'
  );

  return (
    <div className={`${style.full_box} ${extraClass ?? ''}`}>
      <HeaderFullPost postId={postId} />
      <div className={style.mark_box}>
        {isLoading ? (
          <SkeletonFullPost />
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkParse]}
            rehypePlugins={[rehypeRaw]}
            components={markdownComponents}
          >
            {processedMarkdown}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
};

export default FullPost;