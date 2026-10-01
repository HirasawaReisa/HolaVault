import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout';
import { AIHighlight, NeonText, AIGlowCard, AIStatus } from '../components/ui';
import { Footer } from '../components/layout/Footer';
import { slideUp, staggerContainer, springGentle } from '../lib/motion';

/**
 * 设计系统展示页 (/showcase)
 * 唯一保留 Footer 的页面
 */
export function ShowcasePage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      {/* ====== Hero Section ====== */}
      <section className="section-gap pt-20">
        <div className="container-page">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="max-w-3xl mx-auto text-center py-20"
          >
            <motion.div variants={slideUp} className="mb-6">
              <AIStatus active label="AI 灵感引擎就绪" />
            </motion.div>

            <motion.h1 variants={slideUp} className="mb-6">
              你的创作，<NeonText as="span">灵感无限</NeonText>
            </motion.h1>

            <motion.p
              variants={slideUp}
              className="text-lg font-light leading-relaxed mb-10"
              style={{ color: 'var(--text-secondary)', maxWidth: '560px', marginInline: 'auto' }}
            >
              HaloVault 是一个极简的个人画作与{' '}
              <AIHighlight>AI 辅助创作</AIHighlight>{' '}
              平台。在这里，每一笔都有可能被 AI 的灵感点燃。
            </motion.p>

            <motion.div
              variants={slideUp}
              className="flex items-center justify-center gap-4"
            >
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={springGentle}
                onClick={() => navigate('/')}
                className="px-8 py-3 rounded-full font-heading font-medium text-sm text-white focus-ring"
                style={{ background: 'var(--ai-gradient)' }}
              >
                进入平台
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={springGentle}
                onClick={() => navigate('/gallery')}
                className="px-8 py-3 rounded-full font-heading font-light text-sm focus-ring"
                style={{
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                浏览画廊
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ====== Design System Showcase ====== */}
      <section className="section-gap" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="container-page">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
          >
            <motion.h2 variants={slideUp} className="mb-4 text-center">
              设计系统预览
            </motion.h2>
            <motion.p
              variants={slideUp}
              className="text-center mb-16"
              style={{ color: 'var(--text-tertiary)' }}
            >
              极简黑白灰 · AI 电光蓝/霓虹全息 · 物理阻尼动效
            </motion.p>

            {/* Color Palette */}
            <motion.div variants={slideUp} className="mb-16">
              <h3 className="mb-6">配色</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[
                  { name: '极光白', color: '#F9F9F9', text: '#0A0A0A' },
                  { name: 'Gray-100', color: '#F5F5F5', text: '#0A0A0A' },
                  { name: 'Gray-300', color: '#D4D4D4', text: '#0A0A0A' },
                  { name: 'Gray-500', color: '#737373', text: '#FFFFFF' },
                  { name: 'Gray-800', color: '#262626', text: '#FFFFFF' },
                  { name: '深渊黑', color: '#121212', text: '#FFFFFF' },
                ].map((swatch) => (
                  <div key={swatch.name} className="text-center">
                    <div
                      className="w-full aspect-square rounded-xl mb-2"
                      style={{
                        backgroundColor: swatch.color,
                        border: swatch.name === '极光白' ? '1px solid var(--border-primary)' : 'none',
                      }}
                    />
                    <span className="text-xs font-light" style={{ color: 'var(--text-tertiary)' }}>
                      {swatch.name}
                    </span>
                    <br />
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {swatch.color}
                    </span>
                  </div>
                ))}
              </div>

              <h3 className="mt-12 mb-6">
                AI 专属色 <span className="ai-pulse ml-2" />
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: '电光蓝', color: '#2563EB' },
                  { name: '电光蓝 Light', color: '#3B82F6' },
                  { name: '霓虹青', color: '#06B6D4' },
                  { name: '霓虹紫', color: '#8B5CF6' },
                ].map((swatch) => (
                  <div key={swatch.name} className="text-center">
                    <div
                      className="w-full aspect-square rounded-xl mb-2"
                      style={{ backgroundColor: swatch.color }}
                    />
                    <span className="text-xs font-light" style={{ color: 'var(--text-tertiary)' }}>
                      {swatch.name}
                    </span>
                    <br />
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {swatch.color}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <div
                  className="w-full h-24 rounded-xl"
                  style={{ background: 'var(--ai-gradient)' }}
                />
                <span className="text-xs font-light mt-2 block" style={{ color: 'var(--text-tertiary)' }}>
                  霓虹全息渐变 — Cyan → Electric Blue → Violet → Pink
                </span>
              </div>
            </motion.div>

            {/* Typography */}
            <motion.div variants={slideUp} className="mb-16">
              <h3 className="mb-6">排版</h3>
              <div className="space-y-4" style={{ color: 'var(--text-primary)' }}>
                <div>
                  <span className="text-xs font-light block mb-1" style={{ color: 'var(--text-muted)' }}>
                    H1 · Montserrat 900 · clamp(2.5rem–4rem)
                  </span>
                  <h1>标题展示 Heading One</h1>
                </div>
                <div>
                  <span className="text-xs font-light block mb-1" style={{ color: 'var(--text-muted)' }}>
                    H2 · Montserrat 900 · clamp(1.75rem–2.5rem)
                  </span>
                  <h2>二级标题 Heading Two</h2>
                </div>
                <div>
                  <span className="text-xs font-light block mb-1" style={{ color: 'var(--text-muted)' }}>
                    Body · Montserrat 300 · 16px
                  </span>
                  <p>
                    正文使用细体（font-weight: 300），保持优雅克制的视觉节奏。大面积留白让内容自然呼吸，
                    极简主义不是空洞，而是对每个像素的审慎抉择。
                  </p>
                </div>
                <div>
                  <span className="text-xs font-light block mb-1" style={{ color: 'var(--text-muted)' }}>
                    AI Highlight + Neon Text
                  </span>
                  <p>
                    当 <AIHighlight>AI 参与创作</AIHighlight> 时，电光蓝点亮界面，
                    犹如<NeonText>灵感在黑夜中迸发</NeonText>。
                  </p>
                </div>
              </div>
            </motion.div>

            {/* AI Components */}
            <motion.div variants={slideUp}>
              <h3 className="mb-6">AI 组件</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <AIGlowCard>
                  <div className="flex items-center gap-2 mb-3">
                    <AIStatus active label="AI 点评" />
                  </div>
                  <p className="text-sm font-light" style={{ color: 'var(--text-secondary)' }}>
                    这幅画的色彩运用大胆而和谐，建议在前景增加一些细节来增强空间感。
                  </p>
                </AIGlowCard>

                <AIGlowCard>
                  <div className="flex items-center gap-2 mb-3">
                    <AIStatus active label="AI 故事" />
                  </div>
                  <p className="text-sm font-light" style={{ color: 'var(--text-secondary)' }}>
                    在一个被极光覆盖的世界里，每一笔都是通往另一个维度的入口...
                  </p>
                </AIGlowCard>

                <AIGlowCard>
                  <div className="flex items-center gap-2 mb-3">
                    <AIStatus label="AI 待命" />
                  </div>
                  <p className="text-sm font-light" style={{ color: 'var(--text-secondary)' }}>
                    开始创作后，AI 将实时分析你的画作风格并提供灵感建议。
                  </p>
                </AIGlowCard>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer — 仅展示页保留 */}
      <Footer />
    </AppLayout>
  );
}
