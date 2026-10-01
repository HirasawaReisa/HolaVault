import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// ── 路由级代码分割：每个页面独立 chunk ──
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const ShowcasePage = lazy(() => import('./pages/ShowcasePage').then(m => ({ default: m.ShowcasePage })));
const GalleryPage = lazy(() => import('./pages/GalleryPage').then(m => ({ default: m.GalleryPage })));
const AICritiquePage = lazy(() => import('./pages/AICritiquePage').then(m => ({ default: m.AICritiquePage })));
const LoreBuilderSpread = lazy(() => import('./pages/AIExpandPage').then(m => ({ default: m.LoreBuilderSpread })));
const TimelineAnalytics = lazy(() => import('./pages/DataPage').then(m => ({ default: m.TimelineAnalytics })));
const MoodboardStudio = lazy(() => import('./pages/MoodboardPage').then(m => ({ default: m.MoodboardStudio })));
const Challenge100Days = lazy(() => import('./pages/CheckinPage').then(m => ({ default: m.Challenge100Days })));

// ── 全局最小化加载骨架 ──
function PageFallback() {
  return (
    <div
      className="w-screen h-screen flex items-center justify-center"
      style={{ backgroundColor: '#F9F9F9' }}
    >
      <div className="font-heading font-light tracking-[0.2em] text-[12px] text-gray-400 animate-pulse">
        Loading...
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/showcase" element={<ShowcasePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/ai-critique" element={<AICritiquePage />} />
          <Route path="/ai-expand" element={<LoreBuilderSpread />} />
          <Route path="/data" element={<TimelineAnalytics />} />
          <Route path="/moodboard" element={<MoodboardStudio />} />
          <Route path="/checkin" element={<Challenge100Days />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
