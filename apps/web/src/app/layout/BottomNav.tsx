import { NavLink } from 'react-router-dom';

import { BOTTOM_NAV_ITEMS } from './nav-config';

/** Navegación inferior — solo tablet y mobile. */
export function BottomNav() {
  return (
    <nav className="ca-bottom-nav d-lg-none" aria-label="Navegación principal">
      <ul className="ca-bottom-nav__list">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id} className={item.primary ? 'ca-bottom-nav__item--primary' : undefined}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'ca-bottom-nav__link',
                    item.primary ? 'ca-bottom-nav__link--primary' : '',
                    isActive && !item.primary ? 'ca-bottom-nav__link--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
                aria-label={item.label}
              >
                <span className="ca-bottom-nav__icon" aria-hidden>
                  <Icon size={item.primary ? 26 : 22} strokeWidth={1.75} />
                </span>
                {!item.primary ? <span className="ca-bottom-nav__label">{item.label}</span> : null}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
