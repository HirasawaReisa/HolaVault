import type { Variants, Transition } from 'framer-motion';

/**
 * HaloVault 动效预设
 * 原则：平滑、物理阻尼感，使用 spring 物理动画
 */

// 通用 spring 过渡参数
export const springTransition: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 20,
  mass: 0.8,
};

// 轻量 spring（更快的响应）
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
  mass: 0.6,
};

// 柔和 spring（更慢、更弹性）
export const springGentle: Transition = {
  type: 'spring',
  stiffness: 150,
  damping: 15,
  mass: 1,
};

// 淡入
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

// 从下方滑入
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
};

// 从右侧滑入
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: springTransition,
  },
};

// 缩放淡入
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springSnappy,
  },
};

// 交错容器
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

// 悬停缩放
export const hoverScale = {
  whileHover: { scale: 1.02, transition: springSnappy },
  whileTap: { scale: 0.98, transition: springSnappy },
};

// AI 脉冲动画
export const aiPulse: Variants = {
  idle: { opacity: 0.6 },
  active: {
    opacity: 1,
    transition: {
      duration: 1.5,
      repeat: Infinity,
      repeatType: 'reverse',
      ease: 'easeInOut',
    },
  },
};
