import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';
import { springSnappy } from '../../lib/motion';

/**
 * 悬浮导航按钮 + 下拉菜单
 * 固定在左上角，悬浮于页面之上，不影响页面布局
 */
export function FloatingNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // 路由变化时关闭菜单
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const menuItems = [
    { label: '首页', path: '/', icon: '⌂' },
    { label: '画廊', path: '/gallery', icon: '🖼' },
    { label: 'AI 点评', path: '/ai-critique', icon: '✦' },
    { label: 'AI 扩展', path: '/ai-expand', icon: '◆' },
    { label: '数据', path: '/data', icon: '◎' },
    { label: '情绪板', path: '/moodboard', icon: '◉' },
    { label: '打卡', path: '/checkin', icon: '▦' },
    { label: '设计系统', path: '/showcase', icon: '◈' },
  ];

  return (
    <div ref={menuRef} className="fixed top-5 left-5 z-[9999]">
      {/* 悬浮触发按钮 */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        transition={springSnappy}
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative w-11 h-11 rounded-full flex items-center justify-center cursor-pointer focus-ring"
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
          backdropFilter: 'blur(16px)',
        }}
        aria-label="导航菜单"
      >
        {/* 汉堡 → 叉号动画 */}
        <div className="relative w-5 h-5 flex flex-col items-center justify-center">
          <motion.span
            animate={isOpen ? { rotate: 45, y: 0 } : { rotate: 0, y: -4 }}
            transition={springSnappy}
            className="absolute block w-5 h-[1.5px] rounded-full"
            style={{ backgroundColor: 'var(--text-primary)' }}
          />
          <motion.span
            animate={isOpen ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.1 }}
            className="absolute block w-5 h-[1.5px] rounded-full"
            style={{ backgroundColor: 'var(--text-primary)' }}
          />
          <motion.span
            animate={isOpen ? { rotate: -45, y: 0 } : { rotate: 0, y: 4 }}
            transition={springSnappy}
            className="absolute block w-5 h-[1.5px] rounded-full"
            style={{ backgroundColor: 'var(--text-primary)' }}
          />
        </div>
      </motion.button>

      {/* 下拉菜单 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={springSnappy}
            className="absolute top-[calc(100%+8px)] left-0 min-w-[200px] rounded-2xl overflow-hidden"
            style={{
              backgroundColor: isDark ? 'rgba(26,26,26,0.95)' : 'rgba(255,255,255,0.95)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              backdropFilter: 'blur(20px) saturate(180%)',
              boxShadow: isDark
                ? '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)'
                : '0 16px 48px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.03)',
            }}
          >
            {/* 菜单项 */}
            <div className="py-2">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <motion.button
                    key={item.path}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    onClick={() => navigate(item.path)}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors duration-150"
                    style={{
                      color: isActive ? 'var(--ai-accent)' : 'var(--text-secondary)',
                      backgroundColor: isActive
                        ? isDark
                          ? 'rgba(37,99,235,0.1)'
                          : 'rgba(37,99,235,0.06)'
                        : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = isDark
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(0,0,0,0.03)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span className="text-base w-6 text-center opacity-60">{item.icon}</span>
                    <span className="font-heading font-medium text-sm tracking-wide">
                      {item.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="ml-auto w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: 'var(--ai-accent)' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* 分隔线 */}
            <div
              className="mx-4"
              style={{
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}
            />

            {/* 底部：主题切换 */}
            <div className="p-2">
              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                onClick={toggleTheme}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.03)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                {isDark ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
                <span className="font-heading font-medium text-sm tracking-wide">
                  {isDark ? '亮色模式' : '暗色模式'}
                </span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
