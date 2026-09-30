import * as THREE from 'three';

/**
 * Механика "дрейфующих фигур" — медленное покачивание и вращение вокруг
 * стартовой позиции (синус/косинус от времени). Набор позиций и цвет
 * передаются вызывающей стороной.
 */

export interface FloatingShapeConfig {
   geometry: () => THREE.BufferGeometry;
   base: [number, number, number];
   scale: number;
   opacity: number;
}

export interface FloatingShapeState {
   mesh: THREE.LineSegments;
   base: THREE.Vector3;
   driftSpeed: number;
   driftAmount: number;
   phase: THREE.Vector2;
   spin: THREE.Vector3;
}

export function buildFloatingShapes(
   group: THREE.Group,
   configs: FloatingShapeConfig[],
   color: number
): FloatingShapeState[] {
   return configs.map((config, index) => {
      const geometry = new THREE.EdgesGeometry(config.geometry());
      const material = new THREE.LineBasicMaterial({
         color,
         transparent: true,
         opacity: config.opacity
      });
      const mesh = new THREE.LineSegments(geometry, material);
      mesh.position.set(...config.base);
      mesh.scale.setScalar(config.scale);
      group.add(mesh);
      return {
         mesh,
         base: new THREE.Vector3(...config.base),
         driftSpeed: 0.16 + index * 0.025,
         driftAmount: 0.3 + (index % 3) * 0.12,
         phase: new THREE.Vector2(index * 1.3, index * 0.7),
         spin: new THREE.Vector3(0.05 + index * 0.008, 0.07 - index * 0.004, 0.025)
      };
   });
}

export function animateFloatingShapes(shapes: FloatingShapeState[], elapsed: number) {
   for (const shape of shapes) {
      shape.mesh.rotation.x += shape.spin.x * 0.016;
      shape.mesh.rotation.y += shape.spin.y * 0.016;
      shape.mesh.rotation.z += shape.spin.z * 0.016;
      shape.mesh.position.x = shape.base.x + Math.sin(elapsed * shape.driftSpeed + shape.phase.x) * shape.driftAmount;
      shape.mesh.position.y =
         shape.base.y + Math.cos(elapsed * shape.driftSpeed * 0.8 + shape.phase.y) * shape.driftAmount;
   }
}
