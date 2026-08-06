import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

import { AppBreadcrumbs } from './AppBreadcrumbs';
import { AppFooter } from './AppFooter';
import { BottomNav } from './BottomNav';
import { Topbar } from './Topbar';
import { useLayoutChrome } from './useLayoutChrome';
import './layout.css';

/**
 * Shell autenticado estilo marketplace:
 * header con logo + menú de usuario; bottom nav solo tablet/móvil; sin sidebar.
 */
export function MainLayout() {
  const { theme, toggleTheme } = useLayoutChrome();
  const { pathname } = useLocation();
  const isHome = pathname === '/inicio' || pathname === '/inicio/';

  return (
    <div className="ca-shell" data-theme={theme}>
      <div className="ca-main">
        <Topbar theme={theme} onToggleTheme={toggleTheme} />

        <div className={`ca-content ${isHome ? 'ca-content--home' : ''}`}>
          <div className="ca-content__inner">
            {!isHome ? <AppBreadcrumbs /> : null}
            <motion.main
              className={`ca-page ${isHome ? 'ca-page--flush' : ''}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
            >
              <Outlet />
            </motion.main>
          </div>
        </div>

        <AppFooter />
      </div>

      <BottomNav />
    </div>
  );
}
