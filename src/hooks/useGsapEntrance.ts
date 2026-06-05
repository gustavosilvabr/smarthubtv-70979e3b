import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { RefObject } from "react";

gsap.registerPlugin(useGSAP);

interface GsapEntranceOptions {
  /** The parent scope to bound animations (e.g. a container ref) */
  scope?: RefObject<HTMLElement | null>;
  /** Automatically animate children with this selector in a stagger */
  staggerSelector?: string;
  /** Delay before animation starts */
  delay?: number;
  /** Y translation starting point */
  y?: number;
  /** X translation starting point */
  x?: number;
  /** Scale starting point */
  scale?: number;
  /** Duration of animation */
  duration?: number;
  /** Easing function */
  ease?: string;
  /** Opacity starting point */
  opacity?: number;
}

/**
 * Reusable GSAP hook for standard fade/slide/scale entrances.
 * @param ref The target element to animate (or the container if using staggerSelector)
 * @param options Animation config
 */
export function useGsapEntrance(
  ref: RefObject<HTMLElement | null>,
  {
    scope,
    staggerSelector,
    delay = 0,
    y = 0,
    x = 0,
    scale = 1,
    duration = 0.5,
    ease = "power2.out",
    opacity = 0,
  }: GsapEntranceOptions = {}
) {
  useGSAP(
    () => {
      if (!ref.current) return;

      const target = staggerSelector ? staggerSelector : ref.current;
      
      gsap.fromTo(
        target,
        {
          opacity,
          y,
          x,
          scale,
        },
        {
          opacity: 1,
          y: 0,
          x: 0,
          scale: 1,
          duration,
          delay,
          ease,
          stagger: staggerSelector ? 0.05 : 0,
          clearProps: "transform", // prevent residual transform issues after animation
        }
      );
    },
    { scope: scope || ref, dependencies: [] }
  );
}
