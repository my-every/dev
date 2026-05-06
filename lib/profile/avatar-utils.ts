/**
 * Deterministic avatar color palette.
 * Given a stable key (badge, name, etc.) the same color is always returned.
 */

const AVATAR_COLORS = [
    { bg: 'bg-red-600', text: 'text-white', headerFrom: 'from-red-600/30', headerTo: 'to-red-400/10' },
    { bg: 'bg-orange-600', text: 'text-white', headerFrom: 'from-orange-600/30', headerTo: 'to-orange-400/10' },
    { bg: 'bg-amber-600', text: 'text-white', headerFrom: 'from-amber-600/30', headerTo: 'to-amber-400/10' },
    { bg: 'bg-yellow-500', text: 'text-black', headerFrom: 'from-yellow-500/30', headerTo: 'to-yellow-300/10' },
    { bg: 'bg-lime-600', text: 'text-white', headerFrom: 'from-lime-600/30', headerTo: 'to-lime-400/10' },
    { bg: 'bg-green-600', text: 'text-white', headerFrom: 'from-green-600/30', headerTo: 'to-green-400/10' },
    { bg: 'bg-emerald-600', text: 'text-white', headerFrom: 'from-emerald-600/30', headerTo: 'to-emerald-400/10' },
    { bg: 'bg-teal-600', text: 'text-white', headerFrom: 'from-teal-600/30', headerTo: 'to-teal-400/10' },
    { bg: 'bg-cyan-600', text: 'text-white', headerFrom: 'from-cyan-600/30', headerTo: 'to-cyan-400/10' },
    { bg: 'bg-sky-600', text: 'text-white', headerFrom: 'from-sky-600/30', headerTo: 'to-sky-400/10' },
    { bg: 'bg-blue-600', text: 'text-white', headerFrom: 'from-blue-600/30', headerTo: 'to-blue-400/10' },
    { bg: 'bg-indigo-600', text: 'text-white', headerFrom: 'from-indigo-600/30', headerTo: 'to-indigo-400/10' },
    { bg: 'bg-sky-600', text: 'text-white', headerFrom: 'from-sky-600/30', headerTo: 'to-sky-400/10' },
    { bg: 'bg-purple-600', text: 'text-white', headerFrom: 'from-purple-600/30', headerTo: 'to-purple-400/10' },
    { bg: 'bg-fuchsia-600', text: 'text-white', headerFrom: 'from-fuchsia-600/30', headerTo: 'to-fuchsia-400/10' },
    { bg: 'bg-pink-600', text: 'text-white', headerFrom: 'from-pink-600/30', headerTo: 'to-pink-400/10' },
    { bg: 'bg-rose-600', text: 'text-white', headerFrom: 'from-rose-600/30', headerTo: 'to-rose-400/10' },
    { bg: 'bg-slate-600', text: 'text-white', headerFrom: 'from-slate-600/30', headerTo: 'to-slate-400/10' },
] as const

function hashCode(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
}

/**
 * Returns a deterministic { bg, text } color pair for the given key.
 * Same key always produces the same color.
 */
export function getAvatarColor(key: string): { bg: string; text: string } {
    const index = hashCode(key) % AVATAR_COLORS.length
    return AVATAR_COLORS[index]
}

/** Get the gradient classes for a header background (derived from avatar color). */
export function getHeaderGradient(key: string): { from: string; to: string } {
    const index = hashCode(key) % AVATAR_COLORS.length
    const c = AVATAR_COLORS[index]
    return { from: c.headerFrom, to: c.headerTo }
}

/** Get header gradient by explicit color index (for user-chosen color). */
export function getHeaderGradientByIndex(index: number): { from: string; to: string } {
    const c = AVATAR_COLORS[Math.abs(index) % AVATAR_COLORS.length]
    return { from: c.headerFrom, to: c.headerTo }
}

/** Get the solid bg class for a header background (derived from avatar color). */
export function getHeaderSolidBg(key: string): string {
    const index = hashCode(key) % AVATAR_COLORS.length
    return AVATAR_COLORS[index].bg
}

/** Get header solid bg by explicit color index (for user-chosen color). */
export function getHeaderSolidBgByIndex(index: number): string {
    return AVATAR_COLORS[Math.abs(index) % AVATAR_COLORS.length].bg
}

/** The full color palette — for building a color picker UI. */
export const HEADER_COLOR_OPTIONS = AVATAR_COLORS.map((c, i) => ({
    index: i,
    bg: c.bg,
    from: c.headerFrom,
    to: c.headerTo,
}))

/**
 * Generate 2-letter initials from a full name.
 * Always uses `fullName` to get first + last initial.
 * Falls back to `preferredName` only if `fullName` is empty.
 */
export function getAvatarInitials(fullName: string, preferredName?: string | null): string {
    const primary = fullName || preferredName || ''
    const parts = primary.trim().split(/\s+/).filter(Boolean)

    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    if (parts.length === 1) {
        // Single word name — try preferredName for a second initial
        const fallback = fullName && preferredName ? preferredName : ''
        const fallbackParts = fallback.trim().split(/\s+/).filter(Boolean)
        if (fallbackParts.length >= 1 && fallbackParts[0] !== parts[0]) {
            return (parts[0][0] + fallbackParts[0][0]).toUpperCase()
        }
        return parts[0].slice(0, 2).toUpperCase()
    }

    return '??'
}
