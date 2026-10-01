import type { ReactNode } from 'react';
import { FloatingNav } from './FloatingNav';

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * 全局布局容器
 * - 悬浮导航按钮（不影响页面布局）
 * - Footer 由各页面自行决定是否渲染
 */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <FloatingNav />
      <main>{children}</main>
    </div>
  );
}
