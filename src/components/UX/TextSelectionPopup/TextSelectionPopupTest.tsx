import TextSelectionPopup from './TextSelectionPopup';

export default function TextSelectionExample() {
  return (
    <>
      {/* Портал для модального окна */}
      <div id="modal-portal"></div>
      
      <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
        <TextSelectionPopup>
          <h1 style={{ marginBottom: '20px', fontFamily: 'sans-serif' }}>
            Пример использования компонента выделения текста
          </h1>
          
          <p style={{ marginBottom: '16px', lineHeight: '1.6', fontFamily: 'sans-serif' }}>
            Выделите любой текст на этой странице, и над ним появится модальное окно 
            с различными действиями. Попробуйте выделить этот параграф!
          </p>

          <p style={{ marginBottom: '16px', lineHeight: '1.6', fontFamily: 'sans-serif' }}>
            <strong>Доступные действия:</strong>
          </p>

          <ul style={{ marginBottom: '16px', lineHeight: '1.8', fontFamily: 'sans-serif' }}>
            <li>📋 <strong>Копировать</strong> - скопировать выделенный текст в буфер обмена</li>
            <li>🔍 <strong>Поиск</strong> - найти выделенный текст в Google</li>
            <li>✏️ <strong>Выделить</strong> - подсветить текст черным фоном</li>
            <li>📤 <strong>Поделиться</strong> - поделиться выделенным текстом</li>
          </ul>

          <p style={{ marginBottom: '16px', lineHeight: '1.6', fontFamily: 'sans-serif' }}>
            Компонент автоматически определяет, есть ли место сверху от выделенного текста. 
            Если места нет, окно появится снизу. Попробуйте выделить текст в самом верху 
            или в самом низу страницы, чтобы увидеть, как это работает!
          </p>

          <blockquote style={{ 
            borderLeft: '4px solid #000', 
            paddingLeft: '20px', 
            margin: '20px 0',
            fontStyle: 'italic',
            fontFamily: 'sans-serif'
          }}>
            Дизайн в черно-белом стиле подчеркивает контраст и делает интерфейс 
            более выразительным и запоминающимся.
          </blockquote>

          <p style={{ lineHeight: '1.6', fontFamily: 'sans-serif' }}>
            Компонент полностью адаптивен и работает на мобильных устройствах. 
            На маленьких экранах текст кнопок скрывается, остаются только иконки.
            Попап теперь рендерится через портал в элемент #modal-portal.
          </p>
        </TextSelectionPopup>
      </div>
    </>
  );
}