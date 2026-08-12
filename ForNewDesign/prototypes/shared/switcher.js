/**
 * switcher.js — общий переключатель вариантов лендинга + синхронизация скролла.
 *
 * Контракт (interfaces.md, дословно):
 *  - Подключается: <script src="shared/switcher.js" defer></script>
 *  - Ждёт разметку: <nav data-switcher> с <a data-variant="a|b|c" href="variant-*.html">
 *  - По имени текущего файла ставит aria-current="page" активной ссылке.
 *  - При клике по ссылке пишет sessionStorage['pdfland:scrollRatio'] =
 *      scrollY / (scrollHeight - innerHeight)  (доля прокрутки, 0..1).
 *  - На загрузке любой страницы, если ключ есть — восстанавливает скролл по доле
 *      (после layout; мгновенно при prefers-reduced-motion).
 *
 * Скрывает: определение активного файла, чтение/запись доли скролла.
 * Vanilla JS, без зависимостей.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'pdfland:scrollRatio';

  // Имя текущего файла (без пути/квери/хэша). Для file:// index.html и «/» — index.
  function currentFile() {
    var path = window.location.pathname || '';
    var name = path.split('/').pop() || '';
    if (name === '' || name === '/') name = 'index.html';
    return name;
  }

  // Имя файла из href ссылки (относительный href резолвится через .pathname).
  function fileFromLink(a) {
    var href = a.getAttribute('href') || '';
    // Отрезаем query/hash, берём последний сегмент.
    var clean = href.split('#')[0].split('?')[0];
    var name = clean.split('/').pop() || '';
    return name;
  }

  // Доля прокрутки: 0..1. Если страница не скроллится — 0.
  function currentRatio() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    if (max <= 0) return 0;
    var y = window.scrollY || window.pageYOffset || 0;
    var ratio = y / max;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    return ratio;
  }

  function prefersReducedMotion() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Восстановление позиции по сохранённой доле, после layout.
  function restoreScroll() {
    var raw;
    try {
      raw = window.sessionStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return; // sessionStorage недоступен (напр. жёсткие privacy-настройки)
    }
    if (raw === null || raw === '') return;
    var ratio = parseFloat(raw);
    if (isNaN(ratio)) return;

    function apply() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var target = max > 0 ? ratio * max : 0;
      window.scrollTo({
        top: target,
        left: 0,
        behavior: prefersReducedMotion() ? 'auto' : 'auto'
      });
    }

    // Ждём полный layout: reveal-эффекты и шрифты могут менять высоту.
    // Двойной rAF гарантирует применение после первой отрисовки.
    if (prefersReducedMotion()) {
      apply();
    } else {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(apply);
      });
    }
  }

  function init() {
    var nav = document.querySelector('nav[data-switcher]');
    if (!nav) return;

    var here = currentFile();
    var links = nav.querySelectorAll('a[href]');

    for (var i = 0; i < links.length; i++) {
      var a = links[i];

      // Активная ссылка — по совпадению имени файла.
      if (fileFromLink(a) === here) {
        a.setAttribute('aria-current', 'page');
      } else {
        a.removeAttribute('aria-current');
      }

      // Сохранение доли скролла перед уходом.
      a.addEventListener('click', function () {
        try {
          window.sessionStorage.setItem(STORAGE_KEY, String(currentRatio()));
        } catch (e) {
          /* нет sessionStorage — просто не сохраняем */
        }
      });
    }
  }

  // Отключаем нативное восстановление скролла браузером — управляем сами.
  if ('scrollRestoration' in window.history) {
    try { window.history.scrollRestoration = 'manual'; } catch (e) {}
  }

  // DOM уже готов? (defer гарантирует, но подстрахуемся.)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Восстановление — после полной загрузки (шрифты/изображения → финальный layout).
  if (document.readyState === 'complete') {
    restoreScroll();
  } else {
    window.addEventListener('load', restoreScroll);
  }
})();
