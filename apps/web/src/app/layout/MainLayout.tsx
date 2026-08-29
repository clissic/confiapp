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
  const isChat = pathname === '/mensajes' || pathname.startsWith('/mensajes/');
  const isBuyerStart =
    pathname === '/operaciones/nueva/comprador' ||
    pathname.startsWith('/operaciones/nueva/comprador/');
  const isSellerStart =
    pathname === '/operaciones/nueva/vendedor' ||
    pathname.startsWith('/operaciones/nueva/vendedor/');
  const isJoinInvite = pathname.startsWith('/operaciones/unirse/');
  const pageFlush = isHome || isChat || isBuyerStart || isSellerStart || isJoinInvite;

  return (
    <div className="ca-shell" data-theme={theme}>
      <div className="ca-main">
        <Topbar theme={theme} onToggleTheme={toggleTheme} />

        <div
          className={[
            'ca-content',
            isHome ? 'ca-content--home' : '',
            isChat ? 'ca-content--chat' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="ca-content__inner">
            {!isHome ? <AppBreadcrumbs /> : null}
            <motion.main
              className={[
                'ca-page',
                pageFlush ? 'ca-page--flush' : '',
                isChat ? 'ca-page--chat' : '',
              ]
                .filter(Boolean)
                .join(' ')}
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
