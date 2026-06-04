'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Tutorial.module.scss';

interface TutorialStep {
  elementId: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

interface TutorialProps {
  steps: TutorialStep[];
  isActive: boolean;
  onComplete: () => void;
}

type Position = 'top' | 'bottom' | 'left' | 'right';

export default function Tutorial({ steps, isActive, onComplete }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [actualPosition, setActualPosition] = useState<Position>('right');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const calculateTooltipPosition = (rect: DOMRect, preferredPosition: string) => {
   const padding = 20;
   const tooltipWidth = 300;
   const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
   const findBestPosition = (
      rect: DOMRect,
      preferredPosition: string,
      tooltipWidth: number,
      tooltipHeight: number
    ): Position => {
      // Порядок приоритета позиций
      const positionPriority: Position[] = ['right', 'left', 'bottom', 'top'];
      const checkPositionFits = (
         rect: DOMRect,
         position: Position,
         tooltipWidth: number,
         tooltipHeight: number
       ): boolean => {
         const padding = 20;
         const extraSpace = 10;
         const viewportWidth = window.innerWidth;
         const viewportHeight = window.innerHeight;
     
         switch (position) {
           case 'top':
             return (
               rect.top - tooltipHeight - padding - extraSpace >= 0 &&
               rect.left + rect.width / 2 - tooltipWidth / 2 >= extraSpace &&
               rect.left + rect.width / 2 + tooltipWidth / 2 <= viewportWidth - extraSpace
             );
           case 'bottom':
             return (
               rect.bottom + tooltipHeight + padding + extraSpace <= viewportHeight &&
               rect.left + rect.width / 2 - tooltipWidth / 2 >= extraSpace &&
               rect.left + rect.width / 2 + tooltipWidth / 2 <= viewportWidth - extraSpace
             );
           case 'left':
             return (
               rect.left - tooltipWidth - padding - extraSpace >= 0 &&
               rect.top + rect.height / 2 - tooltipHeight / 2 >= extraSpace &&
               rect.top + rect.height / 2 + tooltipHeight / 2 <= viewportHeight - extraSpace
             );
           case 'right':
             return (
               rect.right + tooltipWidth + padding + extraSpace <= viewportWidth &&
               rect.top + rect.height / 2 - tooltipHeight / 2 >= extraSpace &&
               rect.top + rect.height / 2 + tooltipHeight / 2 <= viewportHeight - extraSpace
             );
           default:
             return false;
         }
       };
     
      // Если указана конкретная позиция (не auto), пробуем сначала её
      if (preferredPosition !== 'auto') {
        const preferred = preferredPosition as Position;
        if (checkPositionFits(rect, preferred, tooltipWidth, tooltipHeight)) {
          return preferred;
        }
        // Перемещаем предпочитаемую позицию в начало списка
        const index = positionPriority.indexOf(preferred);
        if (index > -1) {
          positionPriority.splice(index, 1);
          positionPriority.unshift(preferred);
        }
      }
  
      // Пробуем все позиции по приоритету
      for (const position of positionPriority) {
        if (checkPositionFits(rect, position, tooltipWidth, tooltipHeight)) {
          return position;
        }
      }
  
      // Если ни одна не подходит, возвращаем право (с ограничением по границам)
      return 'right';
    };
  
   const bestPosition = findBestPosition(rect, preferredPosition, tooltipWidth, tooltipHeight);
   setActualPosition(bestPosition);

   let top = 0;
   let left = 0;
   const viewportWidth = window.innerWidth;
   const viewportHeight = window.innerHeight;

   switch (bestPosition) {
     case 'top':
       top = rect.top - tooltipHeight - padding;
       left = rect.left + rect.width / 2 - tooltipWidth / 2;
       break;
     case 'bottom':
       top = rect.bottom + padding;
       left = rect.left + rect.width / 2 - tooltipWidth / 2;
       break;
     case 'left':
       top = rect.top + rect.height / 2 - tooltipHeight / 2;
       left = rect.left - tooltipWidth - padding;
       break;
     case 'right':
       top = rect.top + rect.height / 2 - tooltipHeight / 2;
       left = rect.right + padding;
       break;
   }

   // Дополнительная проверка границ и коррекция если нужно
   if (left < 10) left = 10;
   if (left + tooltipWidth > viewportWidth - 10) left = viewportWidth - tooltipWidth - 10;
   if (top < 10) top = 10;
   if (top + tooltipHeight > viewportHeight - 10) top = viewportHeight - tooltipHeight - 10;

   setTooltipPosition({ top, left });
 };
  useEffect(() => {
    if (!isActive || steps.length === 0) return;

    const updateHighlight = () => {
      const element = document.getElementById(steps[currentStep].elementId);
      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightRect(rect);
        const preferredPosition = steps[currentStep].position || 'auto';
        calculateTooltipPosition(rect, preferredPosition);
      }
    };

    updateHighlight();
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight);

    return () => {
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight);
    };
  }, [currentStep, isActive, steps]);





  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!isActive || !highlightRect) return null;

  return (
    <div className={styles.tutorialOverlay}>
      {/* Затемненный фон с вырезом для подсвеченного элемента */}
      <svg className={styles.highlightMask}>
        <defs>
          <mask id="highlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={highlightRect.left - 5}
              y={highlightRect.top - 5}
              width={highlightRect.width + 10}
              height={highlightRect.height + 10}
              rx="8"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#highlight-mask)"
        />
      </svg>

      {/* Подсветка элемента */}
      <div
        className={styles.highlightBorder}
        style={{
          top: highlightRect.top - 5,
          left: highlightRect.left - 5,
          width: highlightRect.width + 10,
          height: highlightRect.height + 10,
        }}
      />

      {/* Всплывающее окно с инструкцией */}
      <div
        ref={tooltipRef}
        className={`${styles.tooltip} ${styles[`tooltip-${actualPosition}`]}`}
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        <div className={styles.tooltipHeader}>
          <h3 className={styles.tooltipTitle}>{steps[currentStep].title}</h3>
          <button className={styles.closeButton} onClick={handleSkip}>
            ✕
          </button>
        </div>
        <p className={styles.tooltipDescription}>{steps[currentStep].description}</p>
        <div className={styles.tooltipFooter}>
          <div className={styles.stepCounter}>
            {currentStep + 1} / {steps.length}
          </div>
          <div className={styles.buttonGroup}>
            {currentStep > 0 && (
              <button className={styles.prevButton} onClick={handlePrev}>
                Назад
              </button>
            )}
            <button className={styles.nextButton} onClick={handleNext}>
              {currentStep < steps.length - 1 ? 'Далее' : 'Завершить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}