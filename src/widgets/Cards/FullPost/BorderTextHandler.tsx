'use client';

import { useEffect } from 'react';

export const BorderTextHandler = () => {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('.borderText');

    const copyText = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const original = target.innerText;
      navigator.clipboard.writeText(original).then(() => {
        target.innerText = 'Скопировано!';
        setTimeout(() => (target.innerText = original), 1000);
      });
    };

    elements.forEach((el) => el.addEventListener('click', copyText));
    return () => elements.forEach((el) => el.removeEventListener('click', copyText));
  });

  return null; 
};

