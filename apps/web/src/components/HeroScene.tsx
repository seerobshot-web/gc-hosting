import { createParallaxScene } from "@gch/motion";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function HeroScene() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const scene = createParallaxScene({
      container,
      onInit: ({ scene }) => {
        // Placeholder sculptural object — swap for a real GLTF/Spline export
        // once 3D assets exist.
        const geometry = new THREE.IcosahedronGeometry(1.4, 0);
        const material = new THREE.MeshStandardMaterial({
          color: 0xa83e1b,
          flatShading: true,
        });
        scene.add(new THREE.Mesh(geometry, material));

        const light = new THREE.DirectionalLight(0xe0a537, 2);
        light.position.set(2, 2, 3);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xf6f2e7, 0.4));
      },
    });

    return () => scene.destroy();
  }, []);

  return (
    <div className="relative h-[70vh] w-full overflow-hidden bg-midnight-veil">
      <div ref={canvasContainerRef} className="absolute inset-0" />
    </div>
  );
}
