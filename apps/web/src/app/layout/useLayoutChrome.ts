import { useEffect, useState } from 'react';

export type LayoutTheme = 'light' | 'dark';

/** Estado visual del chrome (sin persistencia ni lógica de producto). */
export function useLayoutChrome() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<LayoutTheme>('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return {
    sidebarOpen,
    sidebarCollapsed,
    theme,
    toggleSidebar: () => setSidebarOpen((value) => !value),
    closeSidebar: () => setSidebarOpen(false),
    toggleCollapse: () => setSidebarCollapsed((value) => !value),
    toggleTheme: () => setTheme((value) => (value === 'light' ? 'dark' : 'light')),
  };
}
