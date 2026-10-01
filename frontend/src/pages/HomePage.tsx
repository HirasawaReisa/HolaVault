import { motion } from 'framer-motion';
import { ParallaxBackground, HaloVaultTitle } from '../components/ui';
import { FloatingNav } from '../components/layout';
import { fadeIn, staggerContainer } from '../lib/motion';

/**
 * HaloVault 首页 - Hero Section
 * - 全屏视差背景 + 巨型 HALOVAULT 交互标题
 * - 悬浮导航按钮，无传统 Header/Footer
 */
export function HomePage() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* 悬浮导航 */}
      <FloatingNav />
      {/* 背景层 - 视差图片墙 */}
      <ParallaxBackground />

      {/* 前景层 - 巨型排版 + 标语 */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="absolute inset-0 flex flex-col items-center justify-center z-10"
      >
        {/* 巨型标题 */}
        <motion.div variants={fadeIn} className="mb-8">
          <HaloVaultTitle />
        </motion.div>

        {/* 副标题 */}
        <motion.p
          variants={fadeIn}
          className="font-light text-center max-w-md px-4"
          style={{
            color: 'var(--text-tertiary)',
            fontSize: 'clamp(0.875rem, 1.2vw, 1.125rem)',
            letterSpacing: '0.08em',
          }}
        >
          个人画作 · AI 辅助创作 · 灵感无限
        </motion.p>

        {/* 滚动提示 */}
        <motion.div
          variants={fadeIn}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span
            className="text-xs font-light tracking-widest uppercase"
            style={{ color: 'var(--text-muted)' }}
          >
            Scroll
          </span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* 底部渐变融合 */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 z-10"
        style={{
          background: 'linear-gradient(to top, var(--bg-primary), transparent)',
        }}
      />
    </div>
  );
}

export default HomePage;
