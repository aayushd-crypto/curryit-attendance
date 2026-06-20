import { useEffect } from 'react'

export function useTheme() {
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }, [])
  return { dark: false, toggle: () => {} }
}
