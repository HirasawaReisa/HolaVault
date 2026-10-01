import { motion, type HTMLMotionProps } from 'framer-motion';
import { springSnappy } from '../../lib/motion';

/**
 * AI 高亮文字 - 电光蓝高亮，用于 AI 点评、AI 故事等场景
 */
interface AIHighlightProps extends HTMLMotionProps<'span'> {
  children: React.ReactNode;
}

export function AIHighlight({ children, ...props }: AIHighlightProps) {
  return (
    <motion.span
      className="ai-highlight"
      whileHover={{ scale: 1.01 }}
      transition={springSnappy}
      {...props}
    >
      {children}
    </motion.span>
  );
}

/**
 * 霓虹全息文字 - 渐变流动效果，用于 AI 激发灵感的标语
 */
interface NeonTextProps {
  children: React.ReactNode;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
  className?: string;
}

export function NeonText({ children, as: Tag = 'span', className }: NeonTextProps) {
  return (
    <Tag className={`neon-text ${className ?? ''}`}>
      {children}
    </Tag>
  );
}

/**
 * AI 发光卡片 - 带全息渐变边框的卡片容器
 */
interface AIGlowCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
}

export function AIGlowCard({ children, ...props }: AIGlowCardProps) {
  return (
    <motion.div
      className="ai-glow-border rounded-2xl p-6"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
      whileHover={{ y: -2 }}
      transition={springSnappy}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * AI 状态指示器 - 脉冲圆点 + 文字
 */
interface AIStatusProps {
  active?: boolean;
  label?: string;
}

export function AIStatus({ active = false, label = 'AI 就绪' }: AIStatusProps) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className={`ai-pulse ${active ? '' : 'opacity-40'}`} />
      <span
        className="text-xs font-light tracking-wide"
        style={{ color: active ? 'var(--ai-accent)' : 'var(--text-muted)' }}
      >
        {label}
      </span>
    </div>
  );
}
