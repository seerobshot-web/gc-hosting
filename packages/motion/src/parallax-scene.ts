import * as THREE from "three";

export interface ParallaxSceneOptions {
  container: HTMLElement;
  /** Called once with the scene/camera so the caller can add its own meshes. */
  onInit?: (ctx: { scene: THREE.Scene; camera: THREE.PerspectiveCamera }) => void;
  /** How strongly the camera drifts in response to scroll (0-1 range is typical). */
  parallaxStrength?: number;
}

/**
 * A minimal Three.js scene wired to scroll-driven camera parallax — the
 * primitive behind Stokt-style 3D icon sculptures and hero renders. Exports
 * a composable primitive, not a fully-baked component, so each consuming
 * app (Astro island vs React component) controls its own markup and asset
 * loading around it.
 */
export function createParallaxScene(options: ParallaxSceneOptions) {
  const { container, onInit, parallaxStrength = 0.15 } = options;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    1000,
  );
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  onInit?.({ scene, camera });

  const basePosition = camera.position.clone();
  let scrollFraction = 0;

  const onScroll = () => {
    const rect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 1;
    scrollFraction = 1 - Math.min(Math.max(rect.top / viewportHeight, -1), 1);
    camera.position.y = basePosition.y + scrollFraction * parallaxStrength;
  };

  const onResize = () => {
    const { clientWidth, clientHeight } = container;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);

  let frameId: number;
  const animate = () => {
    frameId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  };
  animate();

  return {
    scene,
    camera,
    renderer,
    destroy: () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
  };
}
