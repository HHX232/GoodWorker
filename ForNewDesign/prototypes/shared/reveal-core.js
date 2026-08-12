/**
 * reveal-core.js — общее ядро появления по скроллу.
 *
 * Контракт (interfaces.md, дословно):
 *  - Подключается: <script src="shared/reveal-core.js" defer></script>
 *  - Находит все [data-reveal], вешает IntersectionObserver (порог ~0.15).
 *  - При въезде в вьюпорт добавляет класс .is-in (один раз, затем отписывается).
 *  - При matchMedia('(prefers-reduced-motion: reduce)') — сразу ставит .is-in всем
 *      и НЕ анимирует (observer не создаётся).
 *
 * Что делает .is-in визуально — задаёт CSS каждого мира.
 * Доп. data-атрибуты (data-reveal="mask", data-reveal-delay) мир трактует сам —
 * ядро их не читает.
 *
 * Скрывает: сам IntersectionObserver. Vanilla JS, без зависимостей.
 */
(function () {
  'use strict';

  var THRESHOLD = 0.15;

  function markAll(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.add('is-in');
    }
  }

  function init() {
    var nodes = document.querySelectorAll('[data-reveal]');
    if (!nodes.length) return;

    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Reduced-motion ИЛИ нет IntersectionObserver → показываем всё сразу, без анимации.
    if (reduced || typeof window.IntersectionObserver === 'undefined') {
      markAll(nodes);
      return;
    }

    var observer = new window.IntersectionObserver(function (entries, obs) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.isIntersecting || entry.intersectionRatio >= THRESHOLD) {
          entry.target.classList.add('is-in');
          obs.unobserve(entry.target); // один раз
        }
      }
    }, { threshold: THRESHOLD });

    for (var j = 0; j < nodes.length; j++) {
      observer.observe(nodes[j]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
