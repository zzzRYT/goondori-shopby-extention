import { useState } from 'react';
import { BrandShowcase } from './ui/BrandShowcase';
import { DisplayWorkspace } from './ui/DisplayWorkspace';
import { Tabs, type TabItem } from './ui/Tabs';

const TABS: TabItem[] = [
  { id: 'display', label: '진열' },
  { id: 'brand', label: '브랜드' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);

  return (
    <main className="app">
      <header className="app__header">
        <div>
          <p className="app__eyebrow">Shopby MD Panel</p>
          <h1>군돌이 샵바이 진열 관리</h1>
        </div>
      </header>

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <section className="app__workspace" aria-label="작업 영역">
        {activeTab === 'display' && <DisplayWorkspace />}
        {activeTab === 'brand' && <BrandShowcase />}
      </section>
    </main>
  );
}
