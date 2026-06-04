"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Tutorial.module.scss";
import { useTutorial } from "./TutorialContext";

type Position = "top" | "bottom" | "left" | "right";

export default function TutorialOverlay() {
  const t = useTranslations('tutorial');
  const {
    isActive,
    currentStep,
    steps,
    nextStep,
    prevStep,
    stopTutorial,
    isPaused,
  } = useTutorial();
  
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [actualPosition, setActualPosition] = useState<Position>("right");
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStepData = steps[currentStep];

  // Мемоизируем функцию проверки позиции
  const checkPositionFits = useCallback((
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
      case "top":
        return (
          rect.top - tooltipHeight - padding - extraSpace >= 0 &&
          rect.left + rect.width / 2 - tooltipWidth / 2 >= extraSpace &&
          rect.left + rect.width / 2 + tooltipWidth / 2 <= viewportWidth - extraSpace
        );
      case "bottom":
        return (
          rect.bottom + tooltipHeight + padding + extraSpace <= viewportHeight &&
          rect.left + rect.width / 2 - tooltipWidth / 2 >= extraSpace &&
          rect.left + rect.width / 2 + tooltipWidth / 2 <= viewportWidth - extraSpace
        );
      case "left":
        return (
          rect.left - tooltipWidth - padding - extraSpace >= 0 &&
          rect.top + rect.height / 2 - tooltipHeight / 2 >= extraSpace &&
          rect.top + rect.height / 2 + tooltipHeight / 2 <= viewportHeight - extraSpace
        );
      case "right":
        return (
          rect.right + tooltipWidth + padding + extraSpace <= viewportWidth &&
          rect.top + rect.height / 2 - tooltipHeight / 2 >= extraSpace &&
          rect.top + rect.height / 2 + tooltipHeight / 2 <= viewportHeight - extraSpace
        );
      default:
        return false;
    }
  }, []);

  // Мемоизируем функцию поиска лучшей позиции
  const findBestPosition = useCallback((
    rect: DOMRect,
    preferredPosition: string,
    tooltipWidth: number,
    tooltipHeight: number
  ): Position => {
    const positionPriority: Position[] = ["right", "left", "bottom", "top"];

    if (preferredPosition !== "auto") {
      const preferred = preferredPosition as Position;
      if (checkPositionFits(rect, preferred, tooltipWidth, tooltipHeight)) {
        return preferred;
      }
      const index = positionPriority.indexOf(preferred);
      if (index > -1) {
        positionPriority.splice(index, 1);
        positionPriority.unshift(preferred);
      }
    }

    for (const position of positionPriority) {
      if (checkPositionFits(rect, position, tooltipWidth, tooltipHeight)) {
        return position;
      }
    }

    return "right";
  }, [checkPositionFits]);

  useEffect(() => {
    if (!isActive || !currentStepData) return;

    const updateHighlight = () => {
      const element = document.getElementById(currentStepData.elementId);
      if (!element) return;

      const rect = element.getBoundingClientRect();
      setHighlightRect(rect);

      const padding = 20;
      const tooltipWidth = 300;
      const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
      const preferredPosition = currentStepData.position || "auto";

      // Находим лучшую позицию
      const bestPosition = findBestPosition(
        rect,
        preferredPosition,
        tooltipWidth,
        tooltipHeight
      );

      // Обновляем позицию только если она изменилась
      setActualPosition(prev => prev !== bestPosition ? bestPosition : prev);

      // Рассчитываем координаты
      let top = 0;
      let left = 0;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      switch (bestPosition) {
        case "top":
          top = rect.top - tooltipHeight - padding;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case "bottom":
          top = rect.bottom + padding;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case "left":
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - padding;
          break;
        case "right":
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + padding;
          break;
      }

      // Корректируем границы
      if (left < 10) left = 10;
      if (left + tooltipWidth > viewportWidth - 10)
        left = viewportWidth - tooltipWidth - 10;
      if (top < 10) top = 10;
      if (top + tooltipHeight > viewportHeight - 10)
        top = viewportHeight - tooltipHeight - 10;

      setTooltipPosition({ top, left });
    };

    updateHighlight();

    const handleUpdate = () => {
      updateHighlight();
    };

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);

    return () => {
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
    };
  }, [currentStep, isActive, currentStepData?.elementId, currentStepData?.position, findBestPosition]);

  if (!isActive || !highlightRect || !currentStepData) return null;

  return (
    <>
      {/* Overlay с затемнением - скрывается при паузе */}
      {!isPaused && (
        <div className={styles.tutorialOverlay}>
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

          <div
            className={styles.highlightBorder}
            style={{
              top: highlightRect.top - 5,
              left: highlightRect.left - 5,
              width: highlightRect.width + 10,
              height: highlightRect.height + 10,
            }}
          />
        </div>
      )}

      {/* Подсказка - всегда видна */}
      <div className={styles.tooltipContainer}>
        <div
          ref={tooltipRef}
          className={`${styles.tooltip} ${styles[`tooltip-${actualPosition}`]}`}
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
          }}
        >
          <div className={styles.tooltipHeader}>
            <h3 className={styles.tooltipTitle}>{currentStepData.title}</h3>
            <button className={styles.closeButton} onClick={stopTutorial} title={t('skip')}>
              ✕
            </button>
          </div>
          <p className={styles.tooltipDescription}>
            {currentStepData.description}
          </p>
          <div className={styles.tooltipFooter}>
            <div className={styles.stepCounter}>
              {t('step', { current: currentStep + 1, total: steps.length })}
            </div>
            <div className={styles.buttonGroup}>
              {currentStep > 0 && (
                <button className={styles.prevButton} onClick={prevStep}>
                  {t('prev')}
                </button>
              )}
              <button className={styles.nextButton} onClick={nextStep}>
                {currentStep < steps.length - 1 ? t('next') : t('finish')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}