import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

export const INITIALS_MODE = '__initials__'

export const FOOD_EMOJIS = [
  '🍕','🍔','🌮','🍜','🍣','🍩','🧇','🌯','🥗','🍛',
  '🍱','🥘','🍝','🌽','🫕','🥙','🍟','🧆','🥞','🍙',
  '🍤','🌶️','🥐','🧀','🥨','🍿','🥓','🍖','🫔','🥩',
]

export function getInitials(name: string | null | undefined): string {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? 'U'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function useUserAvatar() {
  const { user } = useAuth()
  const key = user ? `avatar_emoji_${user.id}` : null

  const [value, setValue] = useState<string>(() => {
    if (!key) return INITIALS_MODE
    return localStorage.getItem(key) ?? INITIALS_MODE
  })

  useEffect(() => {
    if (key) {
      const stored = localStorage.getItem(key)
      setValue(stored ?? INITIALS_MODE)
    }
  }, [key])

  const pick = (v: string) => {
    setValue(v)
    if (key) localStorage.setItem(key, v)
  }

  return { value, isInitials: value === INITIALS_MODE, pick }
}
