import { jwtDecode } from 'jwt-decode'

const PREFIX = 'worksync_chat_v1_'
const MAX_MESSAGES = 250

export function getChatStorageKeyFromToken(token) {
  if (!token) return null
  try {
    const d = jwtDecode(token)
    const id = d.id ?? d.sub ?? d.userId
    if (id == null || id === '') return null
    return `${PREFIX}${id}`
  } catch {
    return null
  }
}

export function loadChatMessages() {
  const token = localStorage.getItem('token')
  const k = getChatStorageKeyFromToken(token)
  if (!k) return []
  try {
    const raw = localStorage.getItem(k)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((m, i) => ({
      ...m,
      id: m.id ?? `restored_${i}_${m.time ?? ''}`,
    }))
  } catch {
    return []
  }
}

export function saveChatMessages(messages) {
  const token = localStorage.getItem('token')
  const k = getChatStorageKeyFromToken(token)
  if (!k) return
  try {
    const trimmed =
      messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages
    localStorage.setItem(k, JSON.stringify(trimmed))
  } catch (e) {
    console.warn('Chat history save failed', e)
  }
}

/** Logout: token abhi bhi localStorage mein hona chahiye */
export function clearChatStorageForCurrentUser() {
  const token = localStorage.getItem('token')
  const k = getChatStorageKeyFromToken(token)
  if (k) localStorage.removeItem(k)
}
