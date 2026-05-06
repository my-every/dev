"use client"

import { useCallback, useMemo, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
    Briefcase,
    Calendar,
    Check,
    Clock,
    Hash,
    MapPin,
    Pencil,
    Shield,
    Sparkles,
    User,
    Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getAvatarColor, getAvatarInitials } from "@/lib/profile/avatar-utils"
import { AVAILABLE_ROLES } from "@/types/user-settings"
import type { TeamMember } from "./user-detail-aside"

/* ================================================================== */
/*  SHARED TYPES & CONSTANTS                                           */
/* ================================================================== */

export type FieldMode = "view" | "edit"
export type ViewVariant = "card" | "list"

type EditHandler = (field: string, value: string) => void
type MultiEditHandler = (field: string, value: string[]) => void

const SPRING = { type: "spring" as const, stiffness: 420, damping: 28, mass: 0.7 }
const SPRING_GENTLE = { type: "spring" as const, stiffness: 300, damping: 24, mass: 0.8 }

/** Normalize raw values — replace underscores with spaces, title-case each word */
function normalize(value: string | null | undefined): string {
    if (!value) return "—"
    return value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

/** Skill bar color by proficiency level (1-4) */
const SKILL_LEVEL_COLORS: Record<number, string> = {
    1: "bg-muted-foreground/40",  // neutral
    2: "bg-sky-500",              // info
    3: "bg-amber-500",            // warning
    4: "bg-emerald-500",          // success
}
const SKILL_LEVEL_LABELS: Record<number, string> = {
    1: "Beginner",
    2: "Intermediate",
    3: "Proficient",
    4: "Expert",
}

/* ================================================================== */
/*  SHARED FIELD WRAPPER — handles card vs list + edit popover         */
/* ================================================================== */

interface FieldShellProps {
    label: string
    icon: React.ElementType
    color: string
    bgColor: string
    mode: FieldMode
    variant: ViewVariant
    popoverContent?: React.ReactNode
    children: React.ReactNode
    className?: string
}

function FieldShell({
    label, icon: Icon, color, bgColor, mode, variant, popoverContent, children, className,
}: FieldShellProps) {
    const reduced = useReducedMotion()
    const isCard = variant === "card"

    const inner = (
        <motion.div
            layout={!reduced}
            initial={reduced ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={SPRING}
            className={cn(
                "group relative rounded-xl border border-border/50 bg-card transition-all",
                "hover:border-border hover:shadow-sm",
                isCard ? "p-3 h-full" : "px-3 py-2",
                mode === "edit" && "cursor-pointer hover:ring-1 hover:ring-primary/30",
                className,
            )}
        >
            {isCard ? (
                /* ---------- Card variant ---------- */
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
                            {label}
                        </p>
                        <div className="mt-1">{children}</div>
                    </div>
                    <div className={cn("shrink-0 rounded-lg p-1.5", bgColor)}>
                        <Icon className={cn("h-3.5 w-3.5", color)} />
                    </div>
                    {mode === "edit" && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute -top-1.5 -right-1.5 rounded-full bg-primary p-0.5 shadow-sm"
                        >
                            <Pencil className="h-2.5 w-2.5 text-primary-foreground" />
                        </motion.div>
                    )}
                </div>
            ) : (
                /* ---------- List variant ---------- */
                <div className="flex items-center gap-3">
                    <div className={cn("shrink-0 rounded-md p-1.5", bgColor)}>
                        <Icon className={cn("h-3.5 w-3.5", color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
                        <div className="mt-0.5">{children}</div>
                    </div>
                    {mode === "edit" && (
                        <Pencil className="h-3 w-3 text-muted-foreground/50 shrink-0 group-hover:text-primary transition-colors" />
                    )}
                </div>
            )}
        </motion.div>
    )

    if (mode === "edit" && popoverContent) {
        return (
            <Popover>
                <PopoverTrigger asChild>{inner}</PopoverTrigger>
                <PopoverContent side="left" align="start" className="w-64 p-3 space-y-3">
                    <p className="text-xs font-semibold">{label}</p>
                    <Separator />
                    {popoverContent}
                </PopoverContent>
            </Popover>
        )
    }

    return inner
}

/* ================================================================== */
/*  INDIVIDUAL FIELD COMPONENTS                                        */
/* ================================================================== */

/* Shared props for every field */
interface BaseFieldProps {
    member: TeamMember
    mode?: FieldMode
    variant?: ViewVariant
    onEdit?: EditHandler
}

/* ------------------------------------------------------------------ */
/*  1. NameField                                                       */
/* ------------------------------------------------------------------ */

export function NameField({ member: m, mode = "view", variant = "card", onEdit }: BaseFieldProps) {
    const c = getAvatarColor(m.badge)
    return (
        <FieldShell
            label="Name" icon={User}
            color="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-100 dark:bg-blue-900/30"
            mode={mode} variant={variant}
            popoverContent={onEdit && (
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label className="text-[11px]">Full Name</Label>
                        <Input defaultValue={m.fullName} className="h-8 text-xs"
                            onBlur={e => onEdit("fullName", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[11px]">Preferred Name</Label>
                        <Input defaultValue={m.preferredName ?? ""} placeholder="Optional"
                            className="h-8 text-xs"
                            onBlur={e => onEdit("preferredName", e.target.value)} />
                    </div>
                </div>
            )}
        >
            <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                    <AvatarFallback className={cn("text-[9px] font-bold", c.bg, c.text)}>
                        {getAvatarInitials(m.fullName, m.preferredName)}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{m.fullName}</p>
                    {m.preferredName && m.preferredName !== m.fullName && (
                        <p className="text-[10px] text-muted-foreground truncate">"{m.preferredName}"</p>
                    )}
                </div>
            </div>
        </FieldShell>
    )
}

/* ------------------------------------------------------------------ */
/*  2. BadgeField                                                      */
/* ------------------------------------------------------------------ */

export function BadgeField({ member: m, mode = "view", variant = "card" }: BaseFieldProps) {
    return (
        <FieldShell
            label="Badge" icon={Hash}
            color="text-slate-600 dark:text-slate-400"
            bgColor="bg-slate-100 dark:bg-slate-800"
            mode="view" variant={variant}
        >
            <p className="text-sm font-mono font-bold tabular-nums">{m.badge}</p>
            {variant === "card" && m.shift && (
                <Badge variant="outline" className="text-[9px] mt-1">{m.shift} shift</Badge>
            )}
        </FieldShell>
    )
}

/* ------------------------------------------------------------------ */
/*  3. RoleField  — radio-card selector                                */
/* ------------------------------------------------------------------ */

export function RoleField({ member: m, mode = "view", variant = "card", onEdit }: BaseFieldProps) {
    return (
        <FieldShell
            label="Role" icon={Shield}
            color="text-sky-600 dark:text-sky-400"
            bgColor="bg-sky-100 dark:bg-sky-900/30"
            mode={mode} variant={variant}
            popoverContent={onEdit && (
                <RadioGroup
                    defaultValue={m.role}
                    onValueChange={v => onEdit("role", v)}
                    className="grid gap-1.5"
                >
                    {AVAILABLE_ROLES.map(r => (
                        <Label
                            key={r.key}
                            className={cn(
                                "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition-colors",
                                "hover:bg-muted/50",
                                m.role === r.key && "border-primary bg-primary/5",
                            )}
                        >
                            <RadioGroupItem value={r.key} className="h-3.5 w-3.5" />
                            {r.label}
                        </Label>
                    ))}
                </RadioGroup>
            )}
        >
            <Badge variant="outline" className="text-[11px]">{normalize(m.role)}</Badge>
        </FieldShell>
    )
}

/* ------------------------------------------------------------------ */
/*  4. LwcField  — text input                                         */
/* ------------------------------------------------------------------ */

export function LwcField({ member: m, mode = "view", variant = "card", onEdit }: BaseFieldProps) {
    return (
        <FieldShell
            label="LWC" icon={MapPin}
            color="text-emerald-600 dark:text-emerald-400"
            bgColor="bg-emerald-100 dark:bg-emerald-900/30"
            mode={mode} variant={variant}
            popoverContent={onEdit && (
                <div className="space-y-1.5">
                    <Label className="text-[11px]">Primary LWC</Label>
                    <Input defaultValue={m.primaryLwc ?? ""} placeholder="e.g. LWC-100"
                        className="h-8 text-xs"
                        onBlur={e => onEdit("primaryLwc", e.target.value)} />
                </div>
            )}
        >
            <p className={cn("text-sm font-medium", !m.primaryLwc && "text-muted-foreground")}>
                {normalize(m.primaryLwc)}
            </p>
        </FieldShell>
    )
}

/* ------------------------------------------------------------------ */
/*  5. ExperienceField  — number input + progress bar                  */
/* ------------------------------------------------------------------ */

export function ExperienceField({ member: m, mode = "view", variant = "card", onEdit }: BaseFieldProps) {
    const yrs = m.yearsExperience ?? 0
    const tier = yrs >= 10 ? "Senior" : yrs >= 5 ? "Mid-Level" : yrs >= 1 ? "Junior" : "Entry"
    const pct = Math.min(yrs / 15, 1) * 100
    const tierColor = yrs >= 10 ? "text-amber-600" : yrs >= 5 ? "text-blue-600" : yrs >= 1 ? "text-emerald-600" : "text-muted-foreground"

    return (
        <FieldShell
            label="Experience" icon={Briefcase}
            color="text-amber-600 dark:text-amber-400"
            bgColor="bg-amber-100 dark:bg-amber-900/30"
            mode={mode} variant={variant}
            popoverContent={onEdit && (
                <div className="space-y-1.5">
                    <Label className="text-[11px]">Years of Experience</Label>
                    <Input type="number" step="0.5" min="0" max="50"
                        defaultValue={m.yearsExperience ?? ""}
                        className="h-8 text-xs"
                        onBlur={e => onEdit("yearsExperience", e.target.value)} />
                </div>
            )}
        >
            <div className="space-y-1.5">
                <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-bold tabular-nums">
                        {m.yearsExperience != null ? `${yrs.toFixed(1)}` : "—"}
                    </span>
                    {m.yearsExperience != null && (
                        <span className="text-[10px] text-muted-foreground">yr</span>
                    )}
                    {m.yearsExperience != null && variant === "card" && (
                        <Badge variant="secondary" className={cn("text-[9px] ml-auto", tierColor)}>{tier}</Badge>
                    )}
                </div>
                {m.yearsExperience != null && variant === "card" && (
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                            className="h-full rounded-full bg-amber-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={SPRING_GENTLE}
                        />
                    </div>
                )}
            </div>
        </FieldShell>
    )
}

/* ------------------------------------------------------------------ */
/*  6. DepartmentField  — select dropdown                              */
/* ------------------------------------------------------------------ */

const DEPARTMENTS = ["Engineering", "Assembly", "QA", "Logistics", "Branding", "Operations", "Management"]

export function DepartmentField({ member: m, mode = "view", variant = "card", onEdit }: BaseFieldProps) {
    return (
        <FieldShell
            label="Department" icon={Users}
            color="text-cyan-600 dark:text-cyan-400"
            bgColor="bg-cyan-100 dark:bg-cyan-900/30"
            mode={mode} variant={variant}
            popoverContent={onEdit && (
                <div className="space-y-1.5">
                    <Label className="text-[11px]">Department</Label>
                    <Select defaultValue={m.department ?? ""} onValueChange={v => onEdit("department", v)}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                            {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
        >
            <p className={cn("text-sm font-medium", !m.department && "text-muted-foreground")}>
                {normalize(m.department)}
            </p>
        </FieldShell>
    )
}

/* ------------------------------------------------------------------ */
/*  7. TitleField  — text input                                        */
/* ------------------------------------------------------------------ */

export function TitleField({ member: m, mode = "view", variant = "card", onEdit }: BaseFieldProps) {
    return (
        <FieldShell
            label="Title" icon={Briefcase}
            color="text-pink-600 dark:text-pink-400"
            bgColor="bg-pink-100 dark:bg-pink-900/30"
            mode={mode} variant={variant}
            popoverContent={onEdit && (
                <div className="space-y-1.5">
                    <Label className="text-[11px]">Job Title</Label>
                    <Input defaultValue={m.title ?? ""} placeholder="e.g. Electrical Assembler"
                        className="h-8 text-xs"
                        onBlur={e => onEdit("title", e.target.value)} />
                </div>
            )}
        >
            <p className={cn("text-sm font-medium truncate", !m.title && "text-muted-foreground")}>
                {normalize(m.title)}
            </p>
        </FieldShell>
    )
}

/* ------------------------------------------------------------------ */
/*  8. LocationField  — card selector                                  */
/* ------------------------------------------------------------------ */

const LOCATIONS = [
    { value: "Building A", icon: "🏢" },
    { value: "Building B", icon: "🏭" },
    { value: "Building C", icon: "🏗️" },
    { value: "Building D", icon: "📦" },
    { value: "Remote", icon: "🏠" },
]

export function LocationField({ member: m, mode = "view", variant = "card", onEdit }: BaseFieldProps) {
    const [selected, setSelected] = useState(m.location ?? "")
    return (
        <FieldShell
            label="Location" icon={MapPin}
            color="text-teal-600 dark:text-teal-400"
            bgColor="bg-teal-100 dark:bg-teal-900/30"
            mode={mode} variant={variant}
            popoverContent={onEdit && (
                <div className="grid grid-cols-2 gap-1.5">
                    {LOCATIONS.map(loc => (
                        <button
                            key={loc.value}
                            type="button"
                            onClick={() => { setSelected(loc.value); onEdit("location", loc.value) }}
                            className={cn(
                                "flex flex-col items-center gap-1 rounded-lg border p-2 text-[11px] transition-all cursor-pointer",
                                "hover:bg-muted/50 hover:border-border",
                                selected === loc.value
                                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                    : "border-border/50",
                            )}
                        >
                            <span className="text-base">{loc.icon}</span>
                            <span className="font-medium truncate w-full text-center">{loc.value}</span>
                            {selected === loc.value && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={SPRING}
                                >
                                    <Check className="h-3 w-3 text-primary" />
                                </motion.div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        >
            <p className={cn("text-sm font-medium", !m.location && "text-muted-foreground")}>
                {normalize(m.location)}
            </p>
        </FieldShell>
    )
}

/* ------------------------------------------------------------------ */
/*  9. HireDateField  — date input                                     */
/* ------------------------------------------------------------------ */

export function HireDateField({ member: m, mode = "view", variant = "card", onEdit }: BaseFieldProps) {
    const hd = m.hireDate ? new Date(m.hireDate) : null
    const tenure = hd ? Math.floor((Date.now() - hd.getTime()) / (365.25 * 86_400_000)) : null

    return (
        <FieldShell
            label="Hire Date" icon={Calendar}
            color="text-indigo-600 dark:text-indigo-400"
            bgColor="bg-indigo-100 dark:bg-indigo-900/30"
            mode={mode} variant={variant}
            popoverContent={onEdit && (
                <div className="space-y-1.5">
                    <Label className="text-[11px]">Hire Date</Label>
                    <Input type="date" defaultValue={m.hireDate?.split("T")[0] ?? ""}
                        className="h-8 text-xs"
                        onBlur={e => onEdit("hireDate", e.target.value)} />
                </div>
            )}
        >
            <div>
                <p className="text-sm font-medium tabular-nums">
                    {hd ? hd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                </p>
                {tenure != null && variant === "card" && (
                    <p className="text-[10px] text-muted-foreground">{tenure} yr tenure</p>
                )}
            </div>
        </FieldShell>
    )
}

/* ------------------------------------------------------------------ */
/*  10. LastLoginField  — read-only                                    */
/* ------------------------------------------------------------------ */

function relativeTime(iso: string | null | undefined): string {
    if (!iso) return "Never"
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return new Date(iso).toLocaleDateString()
}

export function LastLoginField({ member: m, variant = "card" }: BaseFieldProps) {
    const ago = relativeTime(m.lastLoginAt)
    const isRecent = m.lastLoginAt && (Date.now() - new Date(m.lastLoginAt).getTime()) < 86_400_000
    return (
        <FieldShell
            label="Last Login" icon={Clock}
            color="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-100 dark:bg-orange-900/30"
            mode="view" variant={variant}
        >
            <div className="flex items-center gap-1.5">
                {isRecent && (
                    <motion.span
                        className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                )}
                <p className="text-sm font-medium">{ago}</p>
            </div>
            {m.lastLoginAt && variant === "card" && (
                <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                    {new Date(m.lastLoginAt).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                </p>
            )}
        </FieldShell>
    )
}

/* ------------------------------------------------------------------ */
/*  11. SkillsField  — multi-select checkbox + skill bars              */
/* ------------------------------------------------------------------ */

const AVAILABLE_SKILLS = [
    "brandList", "branding", "buildUp", "wiring", "wiringIpv",
    "boxBuild", "crossWire", "test", "pwrCheck", "biq", "greenChange",
]

const SKILL_LABELS: Record<string, string> = {
    brandList: "BrandList",
    branding: "Branding",
    buildUp: "Build Up",
    wiring: "Wiring",
    wiringIpv: "Wiring IPV",
    boxBuild: "Box Build",
    crossWire: "Cross Wiring",
    test: "Test",
    pwrCheck: "PWR Check",
    biq: "BIQ",
    greenChange: "Green Change",
}

export function SkillsField({ member: m, mode = "view", variant = "card", onEdit }: BaseFieldProps) {
    const entries = Object.entries(m.skills ?? {}).sort(([, a], [, b]) => b - a)
    const count = entries.length
    const avg = count > 0 ? entries.reduce((s, [, v]) => s + v, 0) / count : 0
    const [selected, setSelected] = useState<Set<string>>(() => new Set(entries.map(([k]) => k)))

    const toggleSkill = (skill: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(skill)) next.delete(skill); else next.add(skill)
            if (onEdit) onEdit("skills", JSON.stringify(Array.from(next)))
            return next
        })
    }

    return (
        <FieldShell
            label="Skills" icon={Sparkles}
            color="text-rose-600 dark:text-rose-400"
            bgColor="bg-rose-100 dark:bg-rose-900/30"
            mode={mode} variant={variant}
            popoverContent={onEdit && (
                <div className="space-y-2 max-h-56 overflow-auto">
                    <p className="text-[10px] text-muted-foreground">Select applicable skills</p>
                    {AVAILABLE_SKILLS.map(skill => (
                        <Label
                            key={skill}
                            className={cn(
                                "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer transition-colors",
                                "hover:bg-muted/50",
                                selected.has(skill) && "border-primary/50 bg-primary/5",
                            )}
                        >
                            <Checkbox
                                checked={selected.has(skill)}
                                onCheckedChange={() => toggleSkill(skill)}
                                className="h-3.5 w-3.5"
                            />
                            <span>{SKILL_LABELS[skill] ?? skill}</span>
                        </Label>
                    ))}
                </div>
            )}
        >
            {count === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
            ) : variant === "list" ? (
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold">{count}</span>
                    <span className="text-[10px] text-muted-foreground">skills</span>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {/* Summary */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-bold">{count}</span>
                            <span className="text-[10px] text-muted-foreground">skills &middot; avg {avg.toFixed(1)}/4</span>
                        </div>
                        {/* Legend */}
                        <div className="flex items-center gap-2">
                            {[1, 2, 3, 4].map(lvl => (
                                <div key={lvl} className="flex items-center gap-0.5">
                                    <div className={cn("h-1.5 w-1.5 rounded-full", SKILL_LEVEL_COLORS[lvl])} />
                                    <span className="text-[8px] text-muted-foreground">{SKILL_LEVEL_LABELS[lvl]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Skill bars — show all */}
                    <div className="space-y-1.5">
                        {entries.map(([name, level], idx) => (
                            <motion.div
                                key={name}
                                className="flex items-center gap-2"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ ...SPRING_GENTLE, delay: idx * 0.03 }}
                            >
                                <span className="w-20 text-[10px] text-muted-foreground truncate">
                                    {SKILL_LABELS[name] ?? normalize(name)}
                                </span>
                                <div className="flex gap-0.5 flex-1">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <motion.div
                                            key={i}
                                            className={cn(
                                                "h-2 flex-1 rounded-sm",
                                                i < level ? SKILL_LEVEL_COLORS[level] : "bg-muted",
                                            )}
                                            initial={{ scaleX: 0 }}
                                            animate={{ scaleX: 1 }}
                                            transition={{ ...SPRING, delay: idx * 0.03 + i * 0.04 }}
                                            style={{ transformOrigin: "left" }}
                                        />
                                    ))}
                                </div>
                                <span className={cn("text-[9px] font-medium tabular-nums w-6 text-right", {
                                    "text-muted-foreground/60": level === 1,
                                    "text-sky-600 dark:text-sky-400": level === 2,
                                    "text-amber-600 dark:text-amber-400": level === 3,
                                    "text-emerald-600 dark:text-emerald-400": level === 4,
                                })}>
                                    {level}/4
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}
        </FieldShell>
    )
}

/* ================================================================== */
/*  FIELD REGISTRY — maps column key → component                       */
/* ================================================================== */

const FIELD_REGISTRY: Record<string, React.ComponentType<BaseFieldProps>> = {
    fullName: NameField,
    badge: BadgeField,
    role: RoleField,
    primaryLwc: LwcField,
    yearsExperience: ExperienceField,
    department: DepartmentField,
    title: TitleField,
    location: LocationField,
    hireDate: HireDateField,
    lastLoginAt: LastLoginField,
    skills: SkillsField,
}

/* ================================================================== */
/*  ORCHESTRATOR — MemberStatCards                                     */
/* ================================================================== */

interface MemberStatCardsProps {
    member: TeamMember
    /** Which columns to show (all if omitted) */
    visibleColumnKeys?: Set<string>
    /** "view" shows read-only cards, "edit" adds popover editors */
    mode?: FieldMode
    /** Card = 2-col grid, List = single-col compact rows */
    variant?: ViewVariant
    /** Called when a field value is changed */
    onFieldChange?: (badge: string, field: string, value: string) => void
    className?: string
}

/** Backward-compat: `editable` maps to mode="edit" */
export function MemberStatCards({
    member,
    visibleColumnKeys,
    mode: modeProp,
    variant = "card",
    onFieldChange,
    className,
    ...rest
}: MemberStatCardsProps & { editable?: boolean }) {
    const mode: FieldMode = modeProp ?? ((rest as { editable?: boolean }).editable ? "edit" : "view")

    const keys = useMemo(() => {
        if (!visibleColumnKeys || visibleColumnKeys.size === 0) return Object.keys(FIELD_REGISTRY)
        return Object.keys(FIELD_REGISTRY).filter(k => visibleColumnKeys.has(k))
    }, [visibleColumnKeys])

    const handleEdit = useCallback<EditHandler>((field, value) => {
        if (onFieldChange) onFieldChange(member.badge, field, value)
    }, [member.badge, onFieldChange])

    return (
        <div className={cn(
            variant === "card" ? "grid grid-cols-2 gap-2.5" : "flex flex-col gap-1.5",
            className,
        )}>
            {keys.map(key => {
                const Component = FIELD_REGISTRY[key]
                if (!Component) return null
                return (
                    <div
                        key={key}
                        className={cn(
                            variant === "card" && "min-h-[88px] [&>*]:h-full",
                            variant === "card" && key === "skills" && "col-span-2",
                        )}
                    >
                        <Component
                            member={member}
                            mode={mode}
                            variant={variant}
                            onEdit={handleEdit}
                        />
                    </div>
                )
            })}
        </div>
    )
}

export { FIELD_REGISTRY }
