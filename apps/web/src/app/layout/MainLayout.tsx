import { Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import { AppBreadcrumbs } from './AppBreadcrumbs';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useLayoutChrome } from './useLayoutChrome';
import './layout.css';

/**
 * Shell visual principal.
 * Sin lógica de negocio: solo estructura, responsive, tema y motion.
 */
export function MainLayout() {
  const {
    sidebarOpen,
    sidebarCollapsed,
    theme,
    toggleSidebar,
    closeSidebar,
    toggleCollapse,
    toggleTheme,
  } = useLayoutChrome();

  return (
    <div className="ca-shell" data-theme={theme}>
      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={closeSidebar}
        onToggleCollapse={toggleCollapse}
      />

      <AnimatePresence>
        {sidebarOpen ? (
          <motion.button
            type="button"
            className="ca-sidebar-backdrop d-lg-none"
            aria-label="Cerrar menú"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeSidebar}
          />
        ) : null}
      </AnimatePresence>

      <div className={`ca-main ${sidebarCollapsed ? 'ca-main--collapsed-collapsed' : ''}`}>
        <Topbar
          onMenuClick={toggleSidebar}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <div className="ca-content">
          <div className="ca-content__inner">
            <AppBreadcrumbs />
            <motion.main
              className="ca-page"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
            >
              <Outlet />
            </motion.main>
          </div>
        </div>
      </div>
    </div>
  );
}
