/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { DragEvent, useState } from 'react';
import styles from './QuizSequence.module.scss';

export interface QuizItem {
  id: number;
  text: string;
  correctOrder: number;
}

interface DragDropQuizProps {
  items: QuizItem[];
  title?: string;
  subtitle?: string;
  itemsPerRow?: {
    large?: number;
    medium?: number;
    small?: number;
  };
}

export default function DragDropQuiz({
  items,
  title = 'Упорядочьте элементы',
  subtitle = 'Перетащите блоки в правильной последовательности',
  itemsPerRow = { large: 10, medium: 5, small: 2 },
}: DragDropQuizProps) {
  const [availableItems, setAvailableItems] = useState<QuizItem[]>(()=>
    [...items].sort(() => Math.random() - 0.5)
  );
  const [sortedItems, setSortedItems] = useState<QuizItem[]>([]);
  const [draggedItem, setDraggedItem] = useState<QuizItem | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleDragStart = (item: QuizItem, source: 'available' | 'sorted') => {
    setDraggedItem({ ...item, source } as any);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDropToSorted = (e: DragEvent, index?: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    const item = availableItems.find((i) => i.id === draggedItem.id) || 
                 sortedItems.find((i) => i.id === draggedItem.id);
    
    if (!item) return;

    // Удаляем из исходного массива
    if ((draggedItem as any).source === 'available') {
      setAvailableItems(availableItems.filter((i) => i.id !== item.id));
    } else {
      setSortedItems(sortedItems.filter((i) => i.id !== item.id));
    }

    // Добавляем в sorted на нужную позицию
    const newSorted = [...sortedItems.filter((i) => i.id !== item.id)];
    if (index !== undefined) {
      newSorted.splice(index, 0, item);
    } else {
      newSorted.push(item);
    }
    setSortedItems(newSorted);
    setDraggedItem(null);
  };

  const handleDropToAvailable = (e: DragEvent) => {
    e.preventDefault();
    if (!draggedItem) return;

    const item = sortedItems.find((i) => i.id === draggedItem.id);
    if (!item) return;

    setSortedItems(sortedItems.filter((i) => i.id !== item.id));
    setAvailableItems([...availableItems, item]);
    setDraggedItem(null);
  };

  const checkAnswer = () => {
    const correct = sortedItems.every(
      (item, index) => item.correctOrder === index + 1
    ) && sortedItems.length === items.length;
    
    setIsCorrect(correct);
    setShowResult(true);
  };

  const resetQuiz = () => {
    setAvailableItems([...items].sort(() => Math.random() - 0.5));
    setSortedItems([]);
    setShowResult(false);
    setIsCorrect(false);
  };

  // Генерируем CSS переменные для grid
  const gridStyle = {
    '--items-per-row-large': itemsPerRow.large || 10,
    '--items-per-row-medium': itemsPerRow.medium || 5,
    '--items-per-row-small': itemsPerRow.small || 2,
  } as React.CSSProperties;

  return (
    <div className={styles.container}>
      <div className={styles.quizWrapper}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>

        {/* Область с доступными блоками */}
        <div
          className={styles.availableArea}
          onDragOver={handleDragOver}
          onDrop={handleDropToAvailable}
        >
          <div className={styles.areaLabel}>Доступные блоки</div>
          <div className={styles.itemsGrid} style={gridStyle}>
            {availableItems.map((item) => (
              <div
                key={item.id}
                className={styles.item}
                draggable
                onDragStart={() => handleDragStart(item, 'available')}
              >
                <div className={styles.itemText}>{item.text}</div>
                <div className={styles.dragHandle}>⋮⋮</div>
              </div>
            ))}
          </div>
        </div>

        {/* Стрелка вниз */}
        <div className={styles.arrow}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5V19M12 19L5 12M12 19L19 12"
              stroke="#666"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Область для сортировки */}
        <div
          className={`${styles.sortedArea} ${
            sortedItems.length === 0 ? styles.empty : ''
          }`}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDropToSorted(e)}
        >
          <div className={styles.areaLabel}>Правильная последовательность</div>
          {sortedItems.length === 0 ? (
            <div className={styles.emptyMessage}>
              Перетащите блоки сюда
            </div>
          ) : (
            <div className={styles.sortedList} style={gridStyle}>
              {sortedItems.map((item, index) => (
                <div key={item.id} className={styles.sortedItemWrapper}>
                  <div
                    className={`${styles.sortedItem} ${
                      showResult
                        ? item.correctOrder === index + 1
                          ? styles.correct
                          : styles.incorrect
                        : ''
                    }`}
                    draggable
                    onDragStart={() => handleDragStart(item, 'sorted')}
                    onDragOver={handleDragOver}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleDropToSorted(e, index);
                    }}
                  >
                    <div className={styles.orderNumber}>{index + 1}</div>
                    <div className={styles.itemText}>{item.text}</div>
                    <div className={styles.dragHandle}>⋮⋮</div>
                  </div>
                  {index < sortedItems.length - 1 && (
                    <div
                      className={styles.dropZone}
                      onDragOver={handleDragOver}
                      onDrop={(e) => {
                        e.stopPropagation();
                        handleDropToSorted(e, index + 1);
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className={styles.actions}>
          {!showResult ? (
            <button
              className={styles.button}
              onClick={checkAnswer}
              disabled={sortedItems.length === 0}
            >
              Проверить ответ
            </button>
          ) : (
            <div className={styles.result}>
              <div
                className={`${styles.resultMessage} ${
                  isCorrect ? styles.success : styles.error
                }`}
              >
                {isCorrect
                  ? '✓ Отлично! Последовательность верна!'
                  : '✗ Неправильно. Попробуйте ещё раз!'}
              </div>
              <button className={styles.button} onClick={resetQuiz}>
                Начать заново
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}