import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { cx } from '../../lib/utils';

export interface NavItem {
  to: string;
  icon: string;
  label: string;
  match: string[];
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 border-t border-surface-border bg-white">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((item) => {
          const active = item.match.some((m) => location.pathname.startsWith(m));
          return (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex min-h-tap min-w-tap flex-1 flex-col items-center justify-center gap-0.5 py-2 transition active:scale-95',
                active ? 'text-primary' : 'text-ink-secondary/60 hover:text-ink-secondary',
              )}
            >
              <Icon name={item.icon} size={22} />
              <span className={cx('text-[10px] font-semibold', active && 'text-primary')}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
