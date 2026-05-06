"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowUpDown, ArrowUp, ArrowDown, Check, Filter, Loader2, Pencil, Save, Search, Users, X } from "lucide-react"

import AnimatedTabs from "@/components/ui/animated-tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useLayoutUI } from "@/components/layout/layout-context"
import { getAvatarColor, getAvatarInitials } from "@/lib/profile/avatar-utils"
import { AVAILABLE_ROLES } from "@/types/user-settings"
import type { TeamMember } from "./user-detail-aside"

const ROW_SPRING = {
    type: "spring" as const,
    stiffness: 400,
    damping: 28,
    mass: 0.6,
}

const SAVE_SPRING = {
    type: "spring" as const,
    stiffness: 300,
    damping: 24,
    mass: 0.8,
}

/** Normalize raw values — replace underscores with spaces, title-case each word */
function normalize(value: string | null | undefined): string {
    if (!value) return "—"
    return value
        .replace(/_/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase())
}

const SHIFT_TABS = [
    { id: "1st", label: "1st Shift" },
    { id: "2nd", label: "2nd Shift" },
]

/* ------------------------------------------------------------------ */
/*  Pending-changes tracker                                            */
/* ------------------------------------------------------------------ */

/** Per-badge map of field → new value */
type PendingChanges = Map<string, Record<string, string>>

function hasPending(pending: PendingChanges) { return pending.size > 0 }

function mergePending(prev: PendingChanges, badge: string, field: string, value: string): PendingChanges {
    const next = new Map(prev)
    const fields = { ...(next.get(badge) ?? {}), [field]: value }
    next.set(badge, fields)
    return next
}

/* ------------------------------------------------------------------ */
/*  Inline-edit popover cells                                          */
/* ------------------------------------------------------------------ */

const DEPARTMENTS = ["Engineering", "Assembly", "QA", "Logistics", "Branding", "Operations", "Management"]
const LOCATIONS = ["Building A", "Building B", "Building C", "Building D", "Remote"]
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

interface InlineCellProps {
    member: TeamMember
    onFieldChange: (badge: string, field: string, value: string) => void
    isPending: boolean
}

/** Wraps a table cell value with an edit-popover trigger */
function EditableCell({
    children,
    popoverContent,
    isPending,
    className,
}: {
    children: React.ReactNode
    popoverContent: React.ReactNode
    isPending: boolean
    className?: string
}) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <div className={cn(
                    "group/cell flex items-center gap-1 cursor-pointer rounded-md px-1 -mx-1 py-0.5 transition-colors",
                    "hover:bg-muted/60",
                    isPending && "bg-primary/5 ring-1 ring-primary/20",
                    className,
                )}>
                    <div className="flex-1 min-w-0">{children}</div>
                    <Pencil className={cn(
                        "h-3 w-3 shrink-0 transition-opacity",
                        isPending ? "text-primary opacity-100" : "opacity-0 group-hover/cell:opacity-50",
                    )} />
                </div>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-60 p-3 space-y-2">
                {popoverContent}
            </PopoverContent>
        </Popover>
    )
}

function InlineNameCell({ member: m, onFieldChange, isPending }: InlineCellProps) {
    const color = getAvatarColor(m.badge)
    return (
        <EditableCell isPending={isPending} popoverContent={
            <div className="space-y-3">
                <p className="text-xs font-semibold">Edit Name</p>
                <Separator />
                <div className="space-y-1.5">
                    <Label className="text-[11px]">Full Name</Label>
                    <Input defaultValue={m.fullName} className="h-8 text-xs"
                        onBlur={e => { if (e.target.value !== m.fullName) onFieldChange(m.badge, "fullName", e.target.value) }} />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[11px]">Preferred Name</Label>
                    <Input defaultValue={m.preferredName ?? ""} placeholder="Optional" className="h-8 text-xs"
                        onBlur={e => { if (e.target.value !== (m.preferredName ?? "")) onFieldChange(m.badge, "preferredName", e.target.value) }} />
                </div>
            </div>
        }>
            <div className="flex items-center gap-2.5">
                <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className={cn("text-[10px] font-semibold", color.bg, color.text)}>
                        {getAvatarInitials(m.fullName, m.preferredName)}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <span className="truncate">{m.fullName}</span>
                    {m.preferredName && m.preferredName !== m.fullName && (
                        <span className="ml-1.5 text-xs text-muted-foreground">({m.preferredName})</span>
                    )}
                </div>
            </div>
        </EditableCell>
    )
}

function InlineRoleCell({ member: m, onFieldChange, isPending }: InlineCellProps) {
    return (
        <EditableCell isPending={isPending} popoverContent={
            <div className="space-y-2">
                <p className="text-xs font-semibold">Change Role</p>
                <Separator />
                <RadioGroup defaultValue={m.role} onValueChange={v => onFieldChange(m.badge, "role", v)} className="grid gap-1.5">
                    {AVAILABLE_ROLES.map(r => (
                        <Label key={r.key} className={cn(
                            "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition-colors",
                            "hover:bg-muted/50",
                            m.role === r.key && "border-primary bg-primary/5",
                        )}>
                            <RadioGroupItem value={r.key} className="h-3.5 w-3.5" />
                            {r.label}
                        </Label>
                    ))}
                </RadioGroup>
            </div>
        }>
            <Badge variant="outline" className="text-[11px]">{normalize(m.role)}</Badge>
        </EditableCell>
    )
}

function InlineTextCell({ member: m, field, label, placeholder, onFieldChange, isPending }: InlineCellProps & { field: string; label: string; placeholder?: string }) {
    const value = (m as Record<string, any>)[field] as string | null | undefined
    return (
        <EditableCell isPending={isPending} popoverContent={
            <div className="space-y-2">
                <p className="text-xs font-semibold">{label}</p>
                <Separator />
                <Input defaultValue={value ?? ""} placeholder={placeholder} className="h-8 text-xs"
                    onBlur={e => { if (e.target.value !== (value ?? "")) onFieldChange(m.badge, field, e.target.value) }} />
            </div>
        }>
            <span className={cn("text-muted-foreground", !value && "italic")}>{normalize(value)}</span>
        </EditableCell>
    )
}

function InlineExperienceCell({ member: m, onFieldChange, isPending }: InlineCellProps) {
    return (
        <EditableCell isPending={isPending} popoverContent={
            <div className="space-y-2">
                <p className="text-xs font-semibold">Years of Experience</p>
                <Separator />
                <Input type="number" step="0.5" min="0" max="50"
                    defaultValue={m.yearsExperience ?? ""} className="h-8 text-xs"
                    onBlur={e => {
                        const v = e.target.value
                        if (v !== String(m.yearsExperience ?? "")) onFieldChange(m.badge, "yearsExperience", v)
                    }} />
            </div>
        }>
            <span className="text-muted-foreground">
                {m.yearsExperience != null ? `${m.yearsExperience.toFixed(1)} yr` : "—"}
            </span>
        </EditableCell>
    )
}

function InlineDepartmentCell({ member: m, onFieldChange, isPending }: InlineCellProps) {
    return (
        <EditableCell isPending={isPending} popoverContent={
            <div className="space-y-2">
                <p className="text-xs font-semibold">Department</p>
                <Separator />
                <Select defaultValue={m.department ?? ""} onValueChange={v => onFieldChange(m.badge, "department", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                        {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        }>
            <span className="text-muted-foreground text-xs">{normalize(m.department)}</span>
        </EditableCell>
    )
}

function InlineLocationCell({ member: m, onFieldChange, isPending }: InlineCellProps) {
    return (
        <EditableCell isPending={isPending} popoverContent={
            <div className="space-y-2">
                <p className="text-xs font-semibold">Location</p>
                <Separator />
                <Select defaultValue={m.location ?? ""} onValueChange={v => onFieldChange(m.badge, "location", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                        {LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        }>
            <span className="text-muted-foreground text-xs">{normalize(m.location)}</span>
        </EditableCell>
    )
}

function InlineHireDateCell({ member: m, onFieldChange, isPending }: InlineCellProps) {
    return (
        <EditableCell isPending={isPending} popoverContent={
            <div className="space-y-2">
                <p className="text-xs font-semibold">Hire Date</p>
                <Separator />
                <Input type="date" defaultValue={m.hireDate?.split("T")[0] ?? ""} className="h-8 text-xs"
                    onBlur={e => { if (e.target.value !== (m.hireDate?.split("T")[0] ?? "")) onFieldChange(m.badge, "hireDate", e.target.value) }} />
            </div>
        }>
            <span className="text-muted-foreground text-xs tabular-nums">
                {m.hireDate ? new Date(m.hireDate).toLocaleDateString() : "—"}
            </span>
        </EditableCell>
    )
}

function InlineSkillsCell({ member: m, onFieldChange, isPending }: InlineCellProps) {
    const entries = Object.entries(m.skills ?? {})
    const count = entries.length
    const [selected, setSelected] = useState<Set<string>>(() => new Set(entries.map(([k]) => k)))

    const toggleSkill = (skill: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(skill)) next.delete(skill); else next.add(skill)
            onFieldChange(m.badge, "skills", JSON.stringify(Array.from(next)))
            return next
        })
    }

    return (
        <EditableCell isPending={isPending} popoverContent={
            <div className="space-y-2">
                <p className="text-xs font-semibold">Skills</p>
                <Separator />
                <div className="space-y-1.5 max-h-48 overflow-auto">
                    {AVAILABLE_SKILLS.map(skill => (
                        <Label key={skill} className={cn(
                            "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer transition-colors",
                            "hover:bg-muted/50",
                            selected.has(skill) && "border-primary/50 bg-primary/5",
                        )}>
                            <Checkbox checked={selected.has(skill)} onCheckedChange={() => toggleSkill(skill)} className="h-3.5 w-3.5" />
                            <span className="capitalize">{skill.replace(/_/g, " ")}</span>
                        </Label>
                    ))}
                </div>
            </div>
        }>
            {count > 0
                ? <Badge variant="secondary" className="text-[10px]">{count} skill{count !== 1 ? "s" : ""}</Badge>
                : <span className="text-muted-foreground text-xs">—</span>}
        </EditableCell>
    )
}

/* ------------------------------------------------------------------ */
/*  Column visibility                                                  */
/* ------------------------------------------------------------------ */

export interface ColumnDef {
    key: string
    label: string
    sortable: boolean
    defaultVisible: boolean
    /** Inline-editable cell — receives edit helpers */
    renderEditable?: (member: TeamMember, onFieldChange: (badge: string, field: string, value: string) => void, isPending: boolean) => React.ReactNode
    /** Read-only fallback render */
    render: (member: TeamMember) => React.ReactNode
    getValue: (member: TeamMember) => string | number
}

const ALL_COLUMNS: ColumnDef[] = [
    {
        key: "fullName", label: "Name", sortable: true, defaultVisible: true,
        getValue: m => m.fullName.toLowerCase(),
        renderEditable: (m, onFieldChange, isPending) => (
            <InlineNameCell member={m} onFieldChange={onFieldChange} isPending={isPending} />
        ),
        render: (member) => {
            const color = getAvatarColor(member.badge)
            return (
                <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className={cn("text-[10px] font-semibold", color.bg, color.text)}>
                            {getAvatarInitials(member.fullName, member.preferredName)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <span className="truncate">{member.fullName}</span>
                        {member.preferredName && member.preferredName !== member.fullName && (
                            <span className="ml-1.5 text-xs text-muted-foreground">({member.preferredName})</span>
                        )}
                    </div>
                </div>
            )
        },
    },
    {
        key: "badge", label: "Badge", sortable: true, defaultVisible: true,
        getValue: m => m.badge,
        render: m => <span className="font-mono text-xs text-muted-foreground">{m.badge}</span>,
    },
    {
        key: "role", label: "Role", sortable: true, defaultVisible: true,
        getValue: m => m.role.toLowerCase(),
        renderEditable: (m, onFieldChange, isPending) => (
            <InlineRoleCell member={m} onFieldChange={onFieldChange} isPending={isPending} />
        ),
        render: m => <Badge variant="outline" className="text-[11px]">{normalize(m.role)}</Badge>,
    },
    {
        key: "primaryLwc", label: "LWC", sortable: true, defaultVisible: true,
        getValue: m => (m.primaryLwc ?? "").toLowerCase(),
        renderEditable: (m, onFieldChange, isPending) => (
            <InlineTextCell member={m} field="primaryLwc" label="Primary LWC" placeholder="e.g. LWC-100" onFieldChange={onFieldChange} isPending={isPending} />
        ),
        render: m => <span className="text-muted-foreground">{normalize(m.primaryLwc)}</span>,
    },
    {
        key: "yearsExperience", label: "Experience", sortable: true, defaultVisible: true,
        getValue: m => m.yearsExperience ?? 0,
        renderEditable: (m, onFieldChange, isPending) => (
            <InlineExperienceCell member={m} onFieldChange={onFieldChange} isPending={isPending} />
        ),
        render: m => (
            <span className="text-muted-foreground">
                {m.yearsExperience != null ? `${m.yearsExperience.toFixed(1)} yr` : "—"}
            </span>
        ),
    },
    {
        key: "department", label: "Department", sortable: true, defaultVisible: false,
        getValue: m => (m.department ?? "").toLowerCase(),
        renderEditable: (m, onFieldChange, isPending) => (
            <InlineDepartmentCell member={m} onFieldChange={onFieldChange} isPending={isPending} />
        ),
        render: m => <span className="text-muted-foreground text-xs">{normalize(m.department)}</span>,
    },
    {
        key: "title", label: "Title", sortable: true, defaultVisible: false,
        getValue: m => (m.title ?? "").toLowerCase(),
        renderEditable: (m, onFieldChange, isPending) => (
            <InlineTextCell member={m} field="title" label="Job Title" placeholder="e.g. Electrical Assembler" onFieldChange={onFieldChange} isPending={isPending} />
        ),
        render: m => <span className="text-muted-foreground text-xs truncate">{normalize(m.title)}</span>,
    },
    {
        key: "location", label: "Location", sortable: true, defaultVisible: false,
        getValue: m => (m.location ?? "").toLowerCase(),
        renderEditable: (m, onFieldChange, isPending) => (
            <InlineLocationCell member={m} onFieldChange={onFieldChange} isPending={isPending} />
        ),
        render: m => <span className="text-muted-foreground text-xs">{normalize(m.location)}</span>,
    },
    {
        key: "hireDate", label: "Hire Date", sortable: true, defaultVisible: false,
        getValue: m => m.hireDate ?? "",
        renderEditable: (m, onFieldChange, isPending) => (
            <InlineHireDateCell member={m} onFieldChange={onFieldChange} isPending={isPending} />
        ),
        render: m => (
            <span className="text-muted-foreground text-xs tabular-nums">
                {m.hireDate ? new Date(m.hireDate).toLocaleDateString() : "—"}
            </span>
        ),
    },
    {
        key: "lastLoginAt", label: "Last Login", sortable: true, defaultVisible: false,
        getValue: m => m.lastLoginAt ?? "",
        render: m => (
            <span className="text-muted-foreground text-xs tabular-nums">
                {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString() : "—"}
            </span>
        ),
    },
    {
        key: "skills", label: "Skills", sortable: false, defaultVisible: false,
        getValue: m => Object.keys(m.skills ?? {}).length,
        renderEditable: (m, onFieldChange, isPending) => (
            <InlineSkillsCell member={m} onFieldChange={onFieldChange} isPending={isPending} />
        ),
        render: m => {
            const count = Object.keys(m.skills ?? {}).length
            return count > 0
                ? <Badge variant="secondary" className="text-[10px]">{count} skill{count !== 1 ? "s" : ""}</Badge>
                : <span className="text-muted-foreground text-xs">—</span>
        },
    },
]

type SortDir = "asc" | "desc"

/* ------------------------------------------------------------------ */
/*  Filter types                                                       */
/* ------------------------------------------------------------------ */

interface ActiveFilters {
    role: string | null
    department: string | null
    lwc: string | null
}

const EMPTY_FILTERS: ActiveFilters = { role: null, department: null, lwc: null }

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface UsersViewProps {
    onSelectMember?: (member: TeamMember | null) => void
    selectedBadge?: string | null
    /** Badge of the current user performing actions (for role changes) */
    performerBadge?: string
}

const NOOP_SELECT_MEMBER = (_member: TeamMember | null) => {}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function sortMembers(members: TeamMember[], col: ColumnDef, dir: SortDir): TeamMember[] {
    return [...members].sort((a, b) => {
        const av = col.getValue(a)
        const bv = col.getValue(b)
        if (av < bv) return dir === "asc" ? -1 : 1
        if (av > bv) return dir === "asc" ? 1 : -1
        return 0
    })
}

function SortIcon({ column, sortKey, sortDir }: { column: string; sortKey: string | null; sortDir: SortDir }) {
    if (column !== sortKey) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === "asc"
        ? <ArrowUp className="h-3 w-3" />
        : <ArrowDown className="h-3 w-3" />
}

function SkeletonRows({ colCount }: { colCount: number }) {
    return (
        <>
            {Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                    {Array.from({ length: colCount }).map((_, c) => (
                        <TableCell key={c}>
                            {c === 0 ? (
                                <div className="flex items-center gap-2.5">
                                    <Skeleton className="h-7 w-7 rounded-full" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                            ) : (
                                <Skeleton className="h-4 w-16" />
                            )}
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    )
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function UsersView({ onSelectMember = NOOP_SELECT_MEMBER, selectedBadge, performerBadge }: UsersViewProps) {
    const shouldReduceMotion = useReducedMotion()
    const { openAside, closeAside, isAsideOpen } = useLayoutUI()
    const [activeShift, setActiveShift] = useState("1st")
    const [members, setMembers] = useState<TeamMember[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState("")
    const [sortKey, setSortKey] = useState<string>("fullName")
    const [sortDir, setSortDir] = useState<SortDir>("asc")
    const [focusIndex, setFocusIndex] = useState(-1)
    const [visibleColumnKeys, setVisibleColumnKeys] = useState<Set<string>>(
        () => new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
    )
    const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS)

    // Pending changes & save state
    const [pendingChanges, setPendingChanges] = useState<PendingChanges>(new Map())
    const [saving, setSaving] = useState(false)
    const [saveResult, setSaveResult] = useState<{ ok: number; failed: number } | null>(null)

    const containerRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    const visibleColumns = useMemo(
        () => ALL_COLUMNS.filter(c => visibleColumnKeys.has(c.key)),
        [visibleColumnKeys]
    )

    const pendingCount = pendingChanges.size
    const totalFieldChanges = useMemo(() => {
        let count = 0
        for (const fields of pendingChanges.values()) count += Object.keys(fields).length
        return count
    }, [pendingChanges])

    // Unique filter options derived from members
    const filterOptions = useMemo(() => ({
        roles: [...new Set(members.map(m => m.role).filter(Boolean))].sort(),
        departments: [...new Set(members.map(m => m.department).filter((d): d is string => !!d))].sort(),
        lwcs: [...new Set(members.map(m => m.primaryLwc).filter((l): l is string => !!l))].sort(),
    }), [members])

    const activeFilterCount = [filters.role, filters.department, filters.lwc].filter(Boolean).length

    const fetchMembers = useCallback(async (shift: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/users/team?shift=${shift}`)
            if (res.ok) {
                const data = await res.json()
                setMembers(data.members ?? [])
            } else {
                setMembers([])
            }
        } catch {
            setMembers([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchMembers(activeShift)
    }, [activeShift, fetchMembers])

    // Filtered + sorted members (apply pending changes to display)
    const filteredMembers = useMemo(() => {
        let list = members.map(m => {
            const changes = pendingChanges.get(m.badge)
            if (!changes) return m
            const patched = { ...m } as Record<string, any>
            for (const [field, value] of Object.entries(changes)) {
                if (field === "yearsExperience") patched[field] = value === "" ? null : Number(value)
                else if (field === "skills") {
                    // Skills are stored as JSON array of skill keys — reconstruct as Record
                    try {
                        const arr: string[] = JSON.parse(value)
                        const skillsObj: Record<string, number> = {}
                        for (const sk of arr) skillsObj[sk] = (m.skills as Record<string, number>)?.[sk] ?? 1
                        patched.skills = skillsObj
                    } catch { /* keep original */ }
                } else {
                    patched[field] = value || null
                }
            }
            return patched as TeamMember
        })

        // Text search
        const q = search.trim().toLowerCase()
        if (q) {
            list = list.filter(m =>
                m.fullName.toLowerCase().includes(q) ||
                (m.preferredName?.toLowerCase().includes(q)) ||
                m.badge.includes(q) ||
                m.role.toLowerCase().includes(q) ||
                (m.department?.toLowerCase().includes(q)) ||
                (m.primaryLwc?.toLowerCase().includes(q))
            )
        }

        // Discrete filters
        if (filters.role) list = list.filter(m => m.role === filters.role)
        if (filters.department) list = list.filter(m => m.department === filters.department)
        if (filters.lwc) list = list.filter(m => m.primaryLwc === filters.lwc)

        // Sort
        const col = ALL_COLUMNS.find(c => c.key === sortKey)
        if (col?.sortable) {
            list = sortMembers(list, col, sortDir)
        }

        return list
    }, [members, search, sortKey, sortDir, filters, pendingChanges])

    /* ---- Inline field change handler ---- */
    const handleFieldChange = useCallback((badge: string, field: string, value: string) => {
        setPendingChanges(prev => mergePending(prev, badge, field, value))
        setSaveResult(null)

        // Also update the selected member in the aside if it's the same badge
        if (selectedBadge === badge) {
            const member = members.find(m => m.badge === badge)
            if (member) {
                const patched = { ...member } as Record<string, any>
                // Apply ALL pending for this badge + the new change
                const existing = pendingChanges.get(badge) ?? {}
                const allChanges = { ...existing, [field]: value }
                for (const [f, v] of Object.entries(allChanges)) {
                    if (f === "yearsExperience") patched[f] = v === "" ? null : Number(v)
                    else if (f === "skills") {
                        try {
                            const arr: string[] = JSON.parse(v)
                            const skillsObj: Record<string, number> = {}
                            for (const sk of arr) skillsObj[sk] = (member.skills as Record<string, number>)?.[sk] ?? 1
                            patched.skills = skillsObj
                        } catch { /* keep original */ }
                    } else {
                        patched[f] = v || null
                    }
                }
                onSelectMember(patched as TeamMember)
            }
        }
    }, [members, pendingChanges, selectedBadge, onSelectMember])

    /* ---- Save all pending changes ---- */
    const handleSaveAll = useCallback(async () => {
        if (pendingChanges.size === 0) return
        setSaving(true)
        setSaveResult(null)
        let ok = 0
        let failed = 0

        for (const [badge, fields] of pendingChanges.entries()) {
            try {
                // Build the PATCH payload — convert numeric/skills fields
                const payload: Record<string, any> = {}
                for (const [field, value] of Object.entries(fields)) {
                    if (field === "yearsExperience") {
                        payload[field] = value === "" ? null : Number(value)
                    } else if (field === "skills") {
                        try {
                            const arr: string[] = JSON.parse(value)
                            const member = members.find(m => m.badge === badge)
                            const skillsObj: Record<string, number> = {}
                            for (const sk of arr) skillsObj[sk] = (member?.skills as Record<string, number>)?.[sk] ?? 1
                            payload.skills = skillsObj
                        } catch { payload.skills = {} }
                    } else {
                        payload[field] = value || null
                    }
                }

                const res = await fetch(`/api/users/${badge}/profile`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                })
                if (res.ok) {
                    ok++
                    // Update local member state
                    const { profile } = await res.json()
                    if (profile) {
                        setMembers(prev => prev.map(m => m.badge === badge ? { ...m, ...profile } : m))
                        // Update selected member in aside
                        if (selectedBadge === badge) {
                            const updated = members.find(m => m.badge === badge)
                            if (updated) onSelectMember({ ...updated, ...profile })
                        }
                    }
                } else {
                    failed++
                }
            } catch {
                failed++
            }
        }

        setPendingChanges(new Map())
        setSaving(false)
        setSaveResult({ ok, failed })
        // Clear the result after a few seconds
        setTimeout(() => setSaveResult(null), 4000)
    }, [pendingChanges, members, selectedBadge, onSelectMember])

    /* ---- Discard pending changes ---- */
    const handleDiscardAll = useCallback(() => {
        setPendingChanges(new Map())
        setSaveResult(null)
    }, [])

    const handleShiftChange = (tabId: string) => {
        // Warn if pending changes exist (changes would be lost)
        if (hasPending(pendingChanges)) {
            if (!confirm("You have unsaved changes. Switch shift and discard them?")) return
        }
        setActiveShift(tabId)
        setSearch("")
        setFocusIndex(-1)
        setFilters(EMPTY_FILTERS)
        setPendingChanges(new Map())
        setSaveResult(null)
        onSelectMember(null)
        closeAside()
    }

    const handleRowClick = (member: TeamMember, index: number) => {
        if (selectedBadge === member.badge && isAsideOpen) {
            onSelectMember(null)
            setFocusIndex(-1)
            closeAside()
            return
        }
        onSelectMember(member)
        setFocusIndex(index)
        openAside()
    }

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(d => d === "asc" ? "desc" : "asc")
        } else {
            setSortKey(key)
            setSortDir("asc")
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (filteredMembers.length === 0) return

        if (e.key === "ArrowDown") {
            e.preventDefault()
            setFocusIndex(i => Math.min(i + 1, filteredMembers.length - 1))
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setFocusIndex(i => Math.max(i - 1, 0))
        } else if (e.key === "Enter" && focusIndex >= 0 && focusIndex < filteredMembers.length) {
            e.preventDefault()
            handleRowClick(filteredMembers[focusIndex], focusIndex)
        } else if (e.key === "Escape") {
            e.preventDefault()
            setFocusIndex(-1)
            onSelectMember(null)
            closeAside()
        }
    }

    // Scroll focused row into view
    useEffect(() => {
        if (focusIndex < 0 || !scrollRef.current) return
        const rows = scrollRef.current.querySelectorAll("[data-user-row]")
        rows[focusIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }, [focusIndex])

    const toggleColumn = (key: string) => {
        setVisibleColumnKeys(prev => {
            const next = new Set(prev)
            if (next.has(key)) {
                if (next.size > 2) next.delete(key)
            } else {
                next.add(key)
            }
            return next
        })
    }

    const canEdit = !!performerBadge

    return (
        <div
            className="flex flex-col gap-4 outline-none h-full"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
            ref={containerRef}
        >
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">Team Members</h2>
                </div>
                <Badge variant="outline" className="text-xs tabular-nums">
                    {loading ? "..." : filteredMembers.length}
                    {(search || activeFilterCount > 0) && !loading ? ` of ${members.length}` : ""}
                    {" "}member{(loading ? 0 : filteredMembers.length) !== 1 ? "s" : ""}
                </Badge>
            </div>

            <div className="flex justify-between items-center text-sm text-muted-foreground gap-4">
                {/* Shift tabs + search + column toggle */}
                <div className="flex flex-wrap flex-row sm:items-center shrink-0 gap-2">
                    <AnimatedTabs
                        tabs={SHIFT_TABS}
                        activeTab={activeShift}
                        onChange={handleShiftChange}
                        variant="segment"
                        layoutId="users-shift-tabs"
                    />
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search name, badge, role, LWC..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setFocusIndex(-1) }}
                            className="h-8 pl-8 text-xs"
                        />
                    </div>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1.5"
                            >
                                <Filter className="h-3.5 w-3.5" />
                                Columns
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5 tabular-nums">
                                    {visibleColumnKeys.size}/{ALL_COLUMNS.length}
                                </Badge>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-48 p-2 space-y-1">
                            <p className="text-[11px] font-semibold text-muted-foreground px-1 pb-1">Visible Columns</p>
                            <Separator />
                            {ALL_COLUMNS.map(col => (
                                <Label
                                    key={col.key}
                                    className={cn(
                                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer transition-colors",
                                        "hover:bg-muted/50",
                                        visibleColumnKeys.has(col.key) && "bg-muted/30",
                                    )}
                                >
                                    <Checkbox
                                        checked={visibleColumnKeys.has(col.key)}
                                        onCheckedChange={() => toggleColumn(col.key)}
                                        className="h-3.5 w-3.5"
                                    />
                                    {col.label}
                                </Label>
                            ))}
                        </PopoverContent>
                    </Popover>
                </div>
                {/* Discrete filters */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {filterOptions.roles.length > 1 && (
                        <Select
                            value={filters.role ?? "__all__"}
                            onValueChange={v => setFilters(f => ({ ...f, role: v === "__all__" ? null : v }))}
                        >
                            <SelectTrigger className="h-7 w-auto min-w-[110px] text-xs gap-1">
                                <SelectValue placeholder="All Roles" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All Roles</SelectItem>
                                {filterOptions.roles.map(r => (
                                    <SelectItem key={r} value={r}>{normalize(r)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {filterOptions.departments.length > 1 && (
                        <Select
                            value={filters.department ?? "__all__"}
                            onValueChange={v => setFilters(f => ({ ...f, department: v === "__all__" ? null : v }))}
                        >
                            <SelectTrigger className="h-7 w-auto min-w-[130px] text-xs gap-1">
                                <SelectValue placeholder="All Departments" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All Departments</SelectItem>
                                {filterOptions.departments.map(d => (
                                    <SelectItem key={d} value={d}>{normalize(d)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {filterOptions.lwcs.length > 1 && (
                        <Select
                            value={filters.lwc ?? "__all__"}
                            onValueChange={v => setFilters(f => ({ ...f, lwc: v === "__all__" ? null : v }))}
                        >
                            <SelectTrigger className="h-7 w-auto min-w-[110px] text-xs gap-1">
                                <SelectValue placeholder="All LWCs" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All LWCs</SelectItem>
                                {filterOptions.lwcs.map(l => (
                                    <SelectItem key={l} value={l}>{normalize(l)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {activeFilterCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-muted-foreground"
                            onClick={() => setFilters(EMPTY_FILTERS)}
                        >
                            <X className="h-3 w-3" />
                            Clear filters
                        </Button>
                    )}
                </div>
            </div>

            {/* Pending changes action bar */}
            <AnimatePresence>
                {(hasPending(pendingChanges) || saveResult) && (
                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={shouldReduceMotion ? undefined : { opacity: 0, height: 0 }}
                        transition={SAVE_SPRING}
                        className="shrink-0 overflow-hidden"
                    >
                        <div className={cn(
                            "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
                            saveResult
                                ? saveResult.failed > 0
                                    ? "border-destructive/30 bg-destructive/5"
                                    : "border-emerald-500/30 bg-emerald-500/5"
                                : "border-primary/30 bg-primary/5",
                        )}>
                            <div className="flex items-center gap-2 text-xs">
                                {saveResult ? (
                                    saveResult.failed > 0 ? (
                                        <>
                                            <X className="h-3.5 w-3.5 text-destructive" />
                                            <span>{saveResult.ok} saved, {saveResult.failed} failed</span>
                                        </>
                                    ) : (
                                        <>
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={SAVE_SPRING}
                                            >
                                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                            </motion.div>
                                            <span className="text-emerald-700 dark:text-emerald-400">
                                                {saveResult.ok} member{saveResult.ok !== 1 ? "s" : ""} saved successfully
                                            </span>
                                        </>
                                    )
                                ) : (
                                    <>
                                        <Pencil className="h-3.5 w-3.5 text-primary" />
                                        <span>
                                            <strong className="tabular-nums">{totalFieldChanges}</strong> unsaved change{totalFieldChanges !== 1 ? "s" : ""} across{" "}
                                            <strong className="tabular-nums">{pendingCount}</strong> member{pendingCount !== 1 ? "s" : ""}
                                        </span>
                                    </>
                                )}
                            </div>
                            {hasPending(pendingChanges) && (
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs gap-1"
                                        onClick={handleDiscardAll}
                                        disabled={saving}
                                    >
                                        <X className="h-3 w-3" />
                                        Discard
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="h-7 text-xs gap-1"
                                        onClick={handleSaveAll}
                                        disabled={saving}
                                    >
                                        {saving ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Save className="h-3 w-3" />
                                        )}
                                        {saving ? "Saving..." : "Save Changes"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Scrollable table */}
            <div ref={scrollRef} className="rounded-lg border overflow-auto flex-1 min-h-0">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                            {visibleColumns.map(col => (
                                <TableHead
                                    key={col.key}
                                    className={cn(
                                        "transition-colors",
                                        col.sortable && "cursor-pointer select-none hover:bg-muted/50"
                                    )}
                                    onClick={() => col.sortable && handleSort(col.key)}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.label}
                                        {col.sortable && <SortIcon column={col.key} sortKey={sortKey} sortDir={sortDir} />}
                                    </div>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <SkeletonRows colCount={visibleColumns.length} />
                        ) : filteredMembers.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={visibleColumns.length}
                                    className="h-24 text-center text-sm text-muted-foreground"
                                >
                                    {search || activeFilterCount > 0
                                        ? "No members match your filters."
                                        : `No team members found for ${activeShift} shift`}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredMembers.map((member, index) => {
                                const isFocused = focusIndex === index
                                const isSelected = selectedBadge === member.badge
                                const memberPending = pendingChanges.get(member.badge)

                                return (
                                    <motion.tr
                                        key={member.badge}
                                        data-slot="table-row"
                                        data-user-row
                                        className={cn(
                                            "border-b transition-colors cursor-pointer",
                                            "hover:bg-muted/50",
                                            isSelected && "bg-muted",
                                            isFocused && !isSelected && "bg-accent/50",
                                            memberPending && "bg-primary/[0.02]",
                                        )}
                                        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            ...ROW_SPRING,
                                            delay: shouldReduceMotion ? 0 : Math.min(index, 15) * 0.03,
                                        }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={() => handleRowClick(member, index)}
                                    >
                                        {visibleColumns.map(col => (
                                            <TableCell
                                                key={col.key}
                                                className={col.key === "fullName" ? "font-medium" : ""}
                                                onClick={canEdit && col.renderEditable ? e => e.stopPropagation() : undefined}
                                            >
                                                {canEdit && col.renderEditable
                                                    ? col.renderEditable(member, handleFieldChange, !!(memberPending?.[col.key]))
                                                    : col.render(member)}
                                            </TableCell>
                                        ))}
                                    </motion.tr>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
