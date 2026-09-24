'use client';

import {useEffect, useLayoutEffect, useRef, useState, type RefObject} from 'react';
import * as THREE from 'three';

/**
 * Каркас жизненного цикла THREE.WebGLRenderer/Scene/PerspectiveCamera для
 * фонового 3D в футере. Форма повторяет паттерн `CallWhiteboard/ThreeDPanel.tsx`
 * + `threeDRender.ts` (эффект создаёт рендерер/сцену один раз, чистит их на
 * unmount) — сама сцена (геометрия/материалы/приём анимации) задаётся через
 * `init`/`animate`/`onResize`.
 *
 * Инкапсулирует:
 *  - IntersectionObserver ставит rAF на паузу вне вьюпорта и продолжает
 *    (не с нуля) при возврате;
 *  - `matchMedia('(prefers-reduced-motion: reduce)')` — один статичный
 *    кадр, цикл анимации не запускается вовсе (и живой апдейт при
 *    переключении настройки без перезагрузки страницы);
 *  - создание рендерера в try/catch + `webglcontextlost` — при неудаче
 *    выставляется `failed`, компонент сам рисует статичную заглушку.
 */

export interface ThreeLifecycleContext {
   scene: THREE.Scene;
   camera: THREE.PerspectiveCamera;
   renderer: THREE.WebGLRenderer;
}

export interface ThreeLifecycleSize {
   width: number;
   height: number;
}

export interface UseThreeLifecycleOptions {
   /**
    * Строит содержимое сцены один раз, сразу после создания рендерера.
    * Может вернуть функцию очистки для ресурсов, которые не подхватит
    * автоматический traverse-дампер сцены при unmount (текстуры и т.п.);
    * геометрии/материалы добавленных в сцену объектов чистятся сами.
    */
   init: (ctx: ThreeLifecycleContext, size: ThreeLifecycleSize) => void | (() => void);
   /**
    * Один кадр анимации. НЕ вызывается при prefers-reduced-motion — тогда
    * виден только самый первый кадр, каким его оставил `init`.
    */
   animate?: (ctx: ThreeLifecycleContext, elapsed: number, delta: number) => void;
   /** Изменение размера контейнера (ResizeObserver) — `renderer`/`camera.aspect` уже обновлены. */
   onResize?: (ctx: ThreeLifecycleContext, size: ThreeLifecycleSize) => void;
   cameraFov?: number;
   cameraNear?: number;
   cameraFar?: number;
   cameraZ?: number;
   alpha?: boolean;
}

export interface ThreeLifecycleState {
   /** WebGL недоступен, рендерер не создался или контекст потерян — показать заглушку. */
   failed: boolean;
   /** Совпадает prefers-reduced-motion: reduce — цикла анимации нет. */
   reducedMotion: boolean;
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
   const materials = Array.isArray(material) ? material : [material];
   for (const m of materials) {
      const record = m as unknown as Record<string, unknown>;
      for (const key of Object.keys(record)) {
         const value = record[key];
         if (value && typeof value === 'object' && 'isTexture' in (value as object)) {
            (value as THREE.Texture).dispose();
         }
      }
      m.dispose();
   }
}

function disposeScene(scene: THREE.Scene) {
   scene.traverse((object) => {
      const withGeometry = object as Partial<THREE.Mesh>;
      if (withGeometry.geometry) withGeometry.geometry.dispose();
      if (withGeometry.material) disposeMaterial(withGeometry.material);
   });
}

export function useThreeLifecycle(
   containerRef: RefObject<HTMLDivElement | null>,
   options: UseThreeLifecycleOptions
): ThreeLifecycleState {
   // Kept in a ref (not state) so the mount-once effect below can always read
   // the latest init/animate/onResize without re-running the whole WebGL
   // setup on every prop change. Assigned in a layout effect, not during
   // render — mutating a ref's .current in the render body can run more than
   // once or read a stale value under concurrent rendering.
   const optionsRef = useRef(options);
   useLayoutEffect(() => {
      optionsRef.current = options;
   });

   const [failed, setFailed] = useState(false);
   const [reducedMotion, setReducedMotion] = useState(false);

   useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let mql: MediaQueryList | null = null;
      try {
         mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      } catch {
         mql = null;
      }
      let reduced = mql?.matches ?? false;
      setReducedMotion(reduced);

      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);

      let renderer: THREE.WebGLRenderer;
      try {
         renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: optionsRef.current.alpha ?? true,
            powerPreference: 'low-power'
         });
      } catch {
         setFailed(true);
         return;
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.domElement.style.display = 'block';
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
         optionsRef.current.cameraFov ?? 45,
         width / height,
         optionsRef.current.cameraNear ?? 0.1,
         optionsRef.current.cameraFar ?? 100
      );
      camera.position.z = optionsRef.current.cameraZ ?? 5;

      const ctx: ThreeLifecycleContext = {scene, camera, renderer};

      let disposeInit: (() => void) | void;
      try {
         disposeInit = optionsRef.current.init(ctx, {width, height});
      } catch {
         renderer.dispose();
         renderer.forceContextLoss();
         renderer.domElement.remove();
         setFailed(true);
         return;
      }

      let rafId: number | null = null;
      let lastTime: number | null = null;
      let elapsed = 0;
      let visible = false;
      let destroyed = false;

      const renderFrame = () => {
         renderer.render(scene, camera);
      };

      const tick = (time: number) => {
         if (destroyed) return;
         if (lastTime === null) lastTime = time;
         const delta = Math.min((time - lastTime) / 1000, 0.1);
         lastTime = time;
         elapsed += delta;
         optionsRef.current.animate?.(ctx, elapsed, delta);
         renderFrame();
         if (visible && !reduced) {
            rafId = requestAnimationFrame(tick);
         } else {
            rafId = null;
         }
      };

      const startLoop = () => {
         if (reduced || rafId !== null || !visible || !optionsRef.current.animate) return;
         lastTime = null;
         rafId = requestAnimationFrame(tick);
      };

      const stopLoop = () => {
         if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
         }
      };

      // Первый кадр рисуем всегда и сразу — до первого срабатывания
      // IntersectionObserver канвас не должен быть пустым.
      renderFrame();

      const handleContextLost = (event: Event) => {
         event.preventDefault();
         stopLoop();
         setFailed(true);
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

      let observer: IntersectionObserver | null = null;
      try {
         observer = new IntersectionObserver(
            (entries) => {
               const entry = entries[0];
               if (!entry) return;
               visible = entry.isIntersecting;
               if (visible) startLoop();
               else stopLoop();
            },
            {threshold: 0.05}
         );
         observer.observe(container);
      } catch {
         visible = true;
         startLoop();
      }

      let resizeObserver: ResizeObserver | null = null;
      try {
         resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const w = Math.max(Math.round(entry.contentRect.width), 1);
            const h = Math.max(Math.round(entry.contentRect.height), 1);
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            optionsRef.current.onResize?.(ctx, {width: w, height: h});
            if (!visible || reduced) renderFrame();
         });
         resizeObserver.observe(container);
      } catch {
         resizeObserver = null;
      }

      const handleReducedMotionChange = (event: MediaQueryListEvent) => {
         reduced = event.matches;
         setReducedMotion(reduced);
         if (reduced) {
            stopLoop();
            renderFrame();
         } else {
            startLoop();
         }
      };
      try {
         mql?.addEventListener('change', handleReducedMotionChange);
      } catch {
         try {
            // Safari < 14
            mql?.addListener(handleReducedMotionChange as (e: MediaQueryListEvent) => void);
         } catch {
            /* noop */
         }
      }

      return () => {
         destroyed = true;
         stopLoop();
         observer?.disconnect();
         resizeObserver?.disconnect();
         renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
         try {
            mql?.removeEventListener('change', handleReducedMotionChange);
         } catch {
            try {
               mql?.removeListener(handleReducedMotionChange as (e: MediaQueryListEvent) => void);
            } catch {
               /* noop */
            }
         }
         disposeInit?.();
         disposeScene(scene);
         renderer.dispose();
         renderer.forceContextLoss();
         renderer.domElement.remove();
      };
      // Монтируем/размонтируем сцену ровно один раз за жизнь контейнера —
      // init/animate/onResize читаются каждый кадр из optionsRef, свежие.
       
   }, [containerRef]);

   return {failed, reducedMotion};
}
