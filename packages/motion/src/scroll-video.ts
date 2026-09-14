import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export interface ScrollVideoOptions {
  /** The <video> element to scrub. Playback is driven by scroll, not autoplay. */
  video: HTMLVideoElement;
  /** Element whose scroll progress drives the video's currentTime. */
  trigger: HTMLElement;
  /** "top top" / "bottom bottom" style GSAP ScrollTrigger start/end strings. */
  start?: string;
  end?: string;
  scrub?: boolean | number;
}

/**
 * Ties a video's playhead to scroll position — the Stokt-style "dramatic,
 * scroll-tied video reveal" rather than a static hero image or autoplay
 * loop. Framework-agnostic: an Astro island and a React component can both
 * call this against a plain DOM ref.
 */
export function createScrollVideo(options: ScrollVideoOptions) {
  const { video, trigger, start = "top top", end = "bottom bottom", scrub = true } = options;

  const setup = () => {
    if (!video.duration || Number.isNaN(video.duration)) return;

    const st = ScrollTrigger.create({
      trigger,
      start,
      end,
      scrub,
      onUpdate: (self) => {
        video.currentTime = self.progress * video.duration;
      },
    });

    return st;
  };

  let scrollTrigger = video.readyState >= 1 ? setup() : undefined;

  if (!scrollTrigger) {
    video.addEventListener(
      "loadedmetadata",
      () => {
        scrollTrigger = setup();
      },
      { once: true },
    );
  }

  return {
    destroy: () => scrollTrigger?.kill(),
  };
}
