/**
 * Framer Motion animation variant presets.
 *
 * All animations in the application are defined here as reusable
 * Framer Motion variant objects. Import and spread these into
 * motion components — never define one-off animations inline.
 *
 * Spring defaults: stiffness 300, damping 30 (snappy, no bounce)
 * Duration defaults: 150ms hover, 250ms modals, 300ms page
 */

import type { Variants, Transition } from "framer-motion";

// ---------------------------------------------------------------------------
// Base transitions
// ---------------------------------------------------------------------------

export const springTransition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const smoothTransition: Transition = {
  type: "tween",
  ease: [0.4, 0, 0.2, 1],
  duration: 0.25,
};

export const fastTransition: Transition = {
  type: "tween",
  ease: "easeOut",
  duration: 0.15,
};

// ---------------------------------------------------------------------------
// Fade variants
// ---------------------------------------------------------------------------

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: smoothTransition },
  exit: { opacity: 0, transition: fastTransition },
};

// ---------------------------------------------------------------------------
// Fade + slide up (most common — cards, toasts, dropdowns)
// ---------------------------------------------------------------------------

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: smoothTransition },
  exit: { opacity: 0, y: 8, transition: fastTransition },
};

export const fadeDownVariants: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: smoothTransition },
  exit: { opacity: 0, y: -6, transition: fastTransition },
};

// ---------------------------------------------------------------------------
// Scale variants (modals, popovers)
// ---------------------------------------------------------------------------

export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 350, damping: 32 },
  },
  exit: { opacity: 0, scale: 0.95, transition: fastTransition },
};

// ---------------------------------------------------------------------------
// Slide variants (drawers, sidebars)
// ---------------------------------------------------------------------------

export const slideLeftVariants: Variants = {
  hidden: { x: "-100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: springTransition },
  exit: { x: "-100%", opacity: 0, transition: smoothTransition },
};

export const slideRightVariants: Variants = {
  hidden: { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: springTransition },
  exit: { x: "100%", opacity: 0, transition: smoothTransition },
};

export const slideUpVariants: Variants = {
  hidden: { y: "100%", opacity: 0 },
  visible: { y: 0, opacity: 1, transition: springTransition },
  exit: { y: "100%", opacity: 0, transition: smoothTransition },
};

// ---------------------------------------------------------------------------
// Stagger list (used for grids of cards, table rows)
// ---------------------------------------------------------------------------

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: smoothTransition },
};

// ---------------------------------------------------------------------------
// Sidebar collapse
// ---------------------------------------------------------------------------

export const sidebarVariants: Variants = {
  expanded: { width: 256, transition: springTransition },
  collapsed: { width: 64, transition: springTransition },
};

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export const toastVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 400, damping: 30 },
  },
  exit: { opacity: 0, scale: 0.95, transition: fastTransition },
};

// ---------------------------------------------------------------------------
// Page transition
// ---------------------------------------------------------------------------

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: smoothTransition },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

// ---------------------------------------------------------------------------
// Card hover (applied via whileHover — not variants)
// ---------------------------------------------------------------------------

export const cardHover = {
  y: -2,
  boxShadow:
    "0 8px 30px -4px rgba(0,0,0,0.12), 0 4px 8px -2px rgba(0,0,0,0.08)",
  transition: fastTransition,
};

export const cardTap = {
  scale: 0.98,
  transition: fastTransition,
};

// ---------------------------------------------------------------------------
// Button press
// ---------------------------------------------------------------------------

export const buttonTap = { scale: 0.97 };
