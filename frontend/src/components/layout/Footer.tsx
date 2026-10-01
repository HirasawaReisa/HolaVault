export function Footer() {
  return (
    <footer
      className="border-t"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      <div className="container-page py-12">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          {/* Brand */}
          <div className="max-w-xs">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center font-heading font-black text-xs text-white"
                style={{ background: 'var(--ai-gradient)' }}
              >
                H
              </div>
              <span
                className="font-heading font-black text-base tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                HaloVault
              </span>
            </div>
            <p className="text-sm font-light" style={{ color: 'var(--text-tertiary)' }}>
              个人画作与 AI 辅助创作平台，让灵感自由流动。
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-16">
            <div>
              <h4
                className="font-heading font-bold text-xs uppercase tracking-widest mb-4"
                style={{ color: 'var(--text-muted)' }}
              >
                产品
              </h4>
              <ul className="space-y-2">
                {['画廊', '创作工具', 'AI 助手'].map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-sm font-light transition-colors duration-200 focus-ring"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4
                className="font-heading font-bold text-xs uppercase tracking-widest mb-4"
                style={{ color: 'var(--text-muted)' }}
              >
                支持
              </h4>
              <ul className="space-y-2">
                {['帮助中心', '隐私政策', '服务条款'].map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-sm font-light transition-colors duration-200 focus-ring"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Divider + Copyright */}
        <div
          className="mt-10 pt-6"
          style={{ borderTop: '1px solid var(--border-primary)' }}
        >
          <p className="text-xs font-light" style={{ color: 'var(--text-muted)' }}>
            &copy; {new Date().getFullYear()} HaloVault. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
