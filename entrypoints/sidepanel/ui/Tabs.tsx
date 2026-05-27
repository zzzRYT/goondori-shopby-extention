export type TabItem = {
  id: string;
  label: string;
};

type TabsProps = {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
};

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <nav className="tabs" aria-label="작업 탭">
      {tabs.map((tab) => {
        const selected = tab.id === activeTab;

        return (
          <button
            aria-current={selected ? 'page' : undefined}
            className="tabs__button"
            data-active={selected}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
