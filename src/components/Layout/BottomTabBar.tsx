/**
 * BottomTabBar — mobile-only primary navigation (hidden at md+).
 * Replaces the sidebar for the 5 most-used CTI views on small screens.
 * This is a layout-only component: no data model, no storage changes.
 */
import { Briefcase, FileText, ListChecks, Clock, Search, type LucideIcon } from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';
import type { ViewMode } from '../../types';

interface Tab {
  view: ViewMode;
  label: string;
  Icon: LucideIcon;
}

const TABS: Tab[] = [
  { view: 'investigations', label: 'Cases',    Icon: Briefcase  },
  { view: 'notes',          label: 'Notes',    Icon: FileText   },
  { view: 'tasks',          label: 'Tasks',    Icon: ListChecks },
  { view: 'timeline',       label: 'Timeline', Icon: Clock      },
  { view: 'ioc-stats',      label: 'IOCs',     Icon: Search     },
];

export function BottomTabBar() {
  const { activeView, navigateTo } = useNavigation();

  return (
    <nav
      className="md:hidden flex shrink-0 border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm safe-area-inset-bottom"
      aria-label="Mobile navigation"
      data-testid="bottom-tab-bar"
    >
      {TABS.map(({ view, label, Icon }) => {
        const isActive = activeView === view;
        return (
          <button
            key={view}
            type="button"
            onClick={() => navigateTo(view)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors ${
              isActive
                ? 'text-accent'
                : 'text-gray-500 hover:text-gray-300 active:text-gray-200'
            }`}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={20} aria-hidden="true" />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
