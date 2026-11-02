import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext({
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {}
});

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('melt_theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch (e) {}
    return 'dark';
  });

  const [resolvedTheme, setResolvedTheme] = useState('dark');

  const applyTheme = useCallback((targetTheme) => {
    let activeDark = true;
    if (targetTheme === 'system') {
      activeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      activeDark = targetTheme === 'dark';
    }

    setResolvedTheme(activeDark ? 'dark' : 'light');

    if (activeDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.style.colorScheme = 'light';
    }
  }, []);

  const setTheme = useCallback((newTheme) => {
    try {
      localStorage.setItem('melt_theme', newTheme);
    } catch (e) {}
    setThemeState(newTheme);
    applyTheme(newTheme);
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  // Handle system preference changes
  useEffect(() => {
    applyTheme(theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;

