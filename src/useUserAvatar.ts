import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

export const FOOD_EMOJIS = [
  '🍕','🍔','🌮','🍜','🍣','🍩','🧇','🌯','🥗','🍛',
  '🍱','🥘','🍝','🌽','🫕','🥙','🍟','🧆','🥞','🍙',
  '🍤','🌶️','🥐','🧀','🥨','🍿','🥓','🍖','🫔','🥩',
]

export function useUserAvatar() {
  const { user } = useAuth()
  const key = user ? `avatar_emoji_${user.id}` : null

  const [emoji, setEmoji] = useState<string>(() => {
    if (!key) return '🍕'
    return localStorage.getItem(key) ?? ''
  })

  useEffect(() => {
    if (key) {
      const stored = localStorage.getItem(key)
      if (stored) setEmoji(stored)
    }
  }, [key])

  const pick = (e: string) => {
    setEmoji(e)
    if (key) localStorage.setItem(key, e)
  }

  return { emoji: emoji || '🍕', pick }
}
