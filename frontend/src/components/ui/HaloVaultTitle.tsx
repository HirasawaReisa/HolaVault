import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { springSnappy, springGentle } from '../../lib/motion';

/**
 * HALOVAULT 巨型交互排版
 *
 * 每个字母独立组件：
 * - H → 悬停变画笔图标 → 点击 /gallery
 * - A(1st) → 默认悬停上漂
 * - L(1st) → 悬停变调色盘图标 → 点击 /moodboard
 * - O → 悬停变 AI 光环(电光蓝渐变阴影+自转) → 点击 /ai-critique
 * - V → 悬停变灯泡图标(熄灭→点亮动画) → 点击 /ai-expand
 * - A(2nd) → 默认悬停上漂
 * - U → 悬停变数据图标 → 点击 /data
 * - L(2nd) → 悬停变目录图标 → 点击 /showcase
 * - T → 悬停变日历图标 → 点击 /checkin
 */

// ======== SVG 图标 ========

function PaintBrushIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M18.37 2.63a2.12 2.12 0 0 1 3 3L14 13l-4 1 1-4 7.37-7.37z" />
      <path d="M9 8c-3 0-6 2-6 6s3 4 3 4v3h4v-3s3-1 3-4-3-6-6-6z" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c0.93 0 1.5-0.67 1.5-1.5 0-0.39-0.15-0.74-0.39-1.04-0.23-0.29-0.38-0.63-0.38-1.04 0-0.83 0.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.17-4.5-8.92-10-8.92z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <rect x="8" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 灯泡图标 — 带熄灭→点亮动画 */
function LightbulbIcon({ isLit }: { isLit: boolean }) {
  return (
    <div className="w-full h-full relative">
      {/* 点亮时的外部光晕层 */}
      <motion.div
        className="absolute inset-[-30%] rounded-full pointer-events-none"
        animate={{
          opacity: isLit ? 1 : 0,
          scale: isLit ? 1 : 0.6,
        }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          background: 'radial-gradient(circle, rgba(255,212,59,0.25) 0%, rgba(255,212,59,0.08) 40%, transparent 70%)',
        }}
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-full h-full relative z-10"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          color: isLit ? '#FFD43B' : 'var(--text-primary)',
          filter: isLit
            ? 'drop-shadow(0 0 6px rgba(255,212,59,0.8)) drop-shadow(0 0 16px rgba(255,212,59,0.4)) drop-shadow(0 0 32px rgba(255,180,0,0.15))'
            : 'none',
          transition: 'color 0.5s ease-out, filter 0.5s ease-out',
        }}
      >
        {/* 灯泡玻璃体 — 点亮时填充暖黄半透明 */}
        <motion.path
          d="M12 2a7 7 0 0 0-4.5 12.37V17a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2.63A7 7 0 0 0 12 2z"
          animate={{
            fill: isLit ? 'rgba(255,212,59,0.2)' : 'rgba(0,0,0,0)',
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        {/* 底座 */}
        <path d="M9 21h6" />
        <path d="M9 18h6" />
        {/* 灯丝 — 点亮时亮起 */}
        <motion.path
          d="M10 14v-3a2 2 0 0 1 4 0v3"
          animate={{
            stroke: isLit ? '#FFD43B' : 'currentColor',
            fill: isLit ? 'rgba(255,212,59,0.5)' : 'none',
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          strokeWidth="2"
        />
      </svg>
      {/* 光芒射线 — 独立层，不受 viewBox 裁切 */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-20"
        animate={{
          opacity: isLit ? 1 : 0,
          scale: isLit ? 1 : 0.4,
        }}
        initial={{ opacity: 0, scale: 0.4 }}
        transition={{ duration: 0.45, ease: 'easeOut', delay: 0.15 }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-full h-full"
          style={{ overflow: 'visible' }}
        >
          {/* 5条光芒 — 更长更明显 */}
          <line x1="12" y1="0.5" x2="12" y2="-2" stroke="#FFD43B" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
          <line x1="3.5" y1="4" x2="1.5" y2="2" stroke="#FFD43B" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
          <line x1="20.5" y1="4" x2="22.5" y2="2" stroke="#FFD43B" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
          <line x1="0.5" y1="10.5" x2="-1.5" y2="10.5" stroke="#FFD43B" strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
          <line x1="23.5" y1="10.5" x2="25.5" y2="10.5" stroke="#FFD43B" strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
        </svg>
      </motion.div>
    </div>
  );
}

/** 数据图标 */
function DataIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      {/* 数据库圆柱体 */}
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
      {/* 小数据点装饰 */}
      <circle cx="8" cy="9.5" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="9.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 目录图标 */
function CatalogIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      {/* 三条横线（目录列表） */}
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
      {/* 左侧圆点指示器 */}
      <circle cx="7" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ======== AI 光环 (O 字母专用) ========

function AIRing({ isSpinning }: { isSpinning: boolean }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* 外圈 - 电光蓝渐变阴影 + 自转 */}
      <motion.div
        className="absolute w-[110%] h-[110%] rounded-full"
        animate={isSpinning ? { rotate: 360 } : { rotate: 0 }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{
          background: 'conic-gradient(from 0deg, #06B6D4, #2563EB, #8B5CF6, #EC4899, #06B6D4)',
          WebkitMask: 'radial-gradient(transparent 55%, black 56%, black 100%)',
          mask: 'radial-gradient(transparent 55%, black 56%, black 100%)',
          filter: 'blur(2px)',
        }}
      />
      {/* 内圈发光 */}
      <motion.div
        className="absolute w-[100%] h-[100%] rounded-full"
        animate={isSpinning ? {
          boxShadow: [
            '0 0 20px rgba(37,99,235,0.3), 0 0 60px rgba(37,99,235,0.1)',
            '0 0 30px rgba(139,92,246,0.4), 0 0 80px rgba(139,92,246,0.15)',
            '0 0 20px rgba(37,99,235,0.3), 0 0 60px rgba(37,99,235,0.1)',
          ],
        } : {}}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}

// ======== 字母类型 ========

type LetterType = 'default' | 'brush' | 'ring' | 'palette' | 'calendar' | 'bulb' | 'data' | 'catalog';

interface LetterConfig {
  char: string;
  type: LetterType;
  route?: string;
}

const HALOVAULT_LETTERS: LetterConfig[] = [
  { char: 'H', type: 'brush', route: '/gallery' },
  { char: 'A', type: 'default' },
  { char: 'L', type: 'palette', route: '/moodboard' },
  { char: 'O', type: 'ring', route: '/ai-critique' },
  { char: 'V', type: 'bulb', route: '/ai-expand' },
  { char: 'A', type: 'default' },
  { char: 'U', type: 'data', route: '/data' },
  { char: 'L', type: 'catalog', route: '/showcase' },
  { char: 'T', type: 'calendar', route: '/checkin' },
];

// ======== 单字母组件 ========

interface LetterCellProps {
  config: LetterConfig;
}

function LetterCell({ config }: LetterCellProps) {
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  const handleClick = () => {
    if (config.route) {
      navigate(config.route);
    }
  };

  // 默认字母的悬停效果：向上漂移 + 放大
  if (config.type === 'default') {
    return (
      <motion.span
        className="inline-block cursor-default select-none"
        style={{
          fontSize: 'clamp(4rem, 8vw, 10rem)',
          fontWeight: 900,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.05em',
          lineHeight: 1,
          color: 'var(--text-primary)',
        }}
        whileHover={{
          y: -8,
          scale: 1.08,
          transition: springSnappy,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {config.char}
      </motion.span>
    );
  }

  // 交互字母
  return (
    <motion.span
      className="inline-block relative cursor-pointer select-none"
      style={{
        fontSize: 'clamp(4rem, 8vw, 10rem)',
        fontWeight: 900,
        fontFamily: 'var(--font-heading)',
        letterSpacing: '0.05em',
        lineHeight: 1,
        color: 'var(--text-primary)',
        width: '1ch', // 固定宽度防止切换时抖动
        textAlign: 'center',
      }}
      whileHover={{
        scale: 1.05,
        transition: springGentle,
      }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 字母 - 悬停时淡出 */}
      <motion.span
        className="relative z-10"
        animate={{
          opacity: isHovered ? 0 : 1,
        }}
        transition={{ duration: 0.2 }}
      >
        {config.char}
      </motion.span>

      {/* 悬停替换内容 */}
      <AnimatePresence mode="wait">
        {isHovered && (
          <motion.span
            className="absolute inset-0 flex items-center justify-center z-20"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={springSnappy}
          >
            {config.type === 'brush' && (
              <span className="w-[60%] h-[60%]" style={{ color: 'var(--text-primary)' }}>
                <PaintBrushIcon />
              </span>
            )}
            {config.type === 'ring' && (
              <span className="w-[90%] h-[90%]">
                <AIRing isSpinning={isHovered} />
              </span>
            )}
            {config.type === 'palette' && (
              <span className="w-[60%] h-[60%]" style={{ color: 'var(--text-primary)' }}>
                <PaletteIcon />
              </span>
            )}
            {config.type === 'calendar' && (
              <span className="w-[55%] h-[55%]" style={{ color: 'var(--text-primary)' }}>
                <CalendarIcon />
              </span>
            )}
            {config.type === 'bulb' && (
              <span className="w-[70%] h-[70%]">
                <LightbulbIcon isLit={isHovered} />
              </span>
            )}
            {config.type === 'data' && (
              <span className="w-[55%] h-[55%]" style={{ color: 'var(--text-primary)' }}>
                <DataIcon />
              </span>
            )}
            {config.type === 'catalog' && (
              <span className="w-[55%] h-[55%]" style={{ color: 'var(--text-primary)' }}>
                <CatalogIcon />
              </span>
            )}
          </motion.span>
        )}
      </AnimatePresence>

      {/* 底部路线提示 */}
      <AnimatePresence>
        {isHovered && config.route && (
          <motion.span
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-light"
            style={{ color: 'var(--ai-accent)' }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {config.route}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  );
}

// ======== HALOVAULT 主组件 ========

export function HaloVaultTitle() {
  return (
    <div className="flex items-center justify-center flex-wrap gap-x-[0.05em]">
      {HALOVAULT_LETTERS.map((config, i) => (
        <LetterCell key={`${config.char}-${i}`} config={config} />
      ))}
    </div>
  );
}

export default HaloVaultTitle;
