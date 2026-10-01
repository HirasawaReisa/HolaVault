import { motion } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';
import { springSnappy } from '../../lib/motion';

export function Header() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={springSnappy}
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: isDark ? 'var(--bg-secondary)' : 'rgba(249, 249, 249, 0.8)',
        borderColor: 'var(--border-primary)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="container-page flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-heading font-black text-sm text-white"
            style={{ background: 'var(--ai-gradient)' }}
          >
            H
          </div>
          <span className="font-heading font-black text-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>
            HaloVault
          </span>
        </div>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {['画廊', '创作', 'AI 助手', '关于'].map((item) => (
            <a
              key={item}
              href="#"
              className="font-body font-light text-sm tracking-wide transition-colors duration-200 focus-ring"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.color = 'var(--text-secondary)';
              }}
            >
              {item}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={springSnappy}
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-200 focus-ring"
            style={{
              border: '1px solid var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
            aria-label={isDark ? '切换亮色模式' : '切换暗色模式'}
          >
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </motion.button>

          {/* CTA - AI 创作按钮 */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={springSnappy}
            className="px-5 py-2 rounded-full font-heading font-medium text-sm text-white focus-ring"
            style={{ background: 'var(--ai-gradient)' }}
          >
            <span className="flex items-center gap-2">
              <span className="ai-pulse" />
              开始创作
            </span>
          </motion.button>
        </div>
      </div>
    </motion.header>
  );
}
