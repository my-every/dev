"use client"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { Briefcase, Calendar, Hash, MapPin, Shield, User, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLayoutUI } from "@/components/layout/layout-context"

const SPRING = {
    type: "spring" as const,
    stiffness: 300,
    damping: 26,
    mass: 0.8,
}

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

export interface TeamMember {
    badge: string
    fullName: string
    preferredName?: string | null
    initials?: string | null
    role: string
    shift?: string | null
    primaryLwc?: string | null
    email?: string | null
    phone?: string | null
    bio?: string | null
    department?: string | null
    title?: string | null
    location?: string | null
    hireDate?: string | null
    yearsExperience?: number | null
    skills?: Record<string, number> | null
    lastLoginAt?: string | null
    createdAt?: string | null
    updatedAt?: string | null
}

interface UserDetailAsideProps {
    member: TeamMember | null
    onClose: () => void
}

function SkillBar({ label, level }: { label: string; level: number }) {
    const maxLevel = 4
    return (
        <div className="flex items-center gap-2">
            <span className="w-28 text-xs text-muted-foreground truncate">{SKILL_LABELS[label] ?? label}</span>
            <div className="flex gap-0.5 flex-1">
                {Array.from({ length: maxLevel }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "h-1.5 flex-1 rounded-full",
                            i < level ? "bg-brand" : "bg-muted"
                        )}
                    />
                ))}
            </div>
        </div>
    )
}

export function UserDetailAside({ member, onClose }: UserDetailAsideProps) {
    const { closeAside } = useLayoutUI()

    const handleClose = () => {
        onClose()
        closeAside()
    }

    if (!member) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Select a user to view details
            </div>
        )
    }

    const displayName = member.preferredName || member.fullName
    const initials = member.initials || member.fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

    return (
        <motion.div
            key={member.badge}
            className="space-y-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING}
        >
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand font-semibold text-sm">
                        {initials}
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold leading-tight">{displayName}</h3>
                        {displayName !== member.fullName && (
                            <p className="text-xs text-muted-foreground">{member.fullName}</p>
                        )}
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClose}>
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{member.role}</Badge>
                {member.shift && <Badge variant="secondary">{member.shift} shift</Badge>}
            </div>

            <Separator />

            {/* Core info */}
            <div className="space-y-2.5">
                <InfoRow icon={Hash} label="Badge" value={member.badge} />
                {member.shift && <InfoRow icon={Briefcase} label="Shift" value={member.shift} />}
                {member.primaryLwc && <InfoRow icon={MapPin} label="LWC" value={member.primaryLwc} />}
                {member.hireDate && <InfoRow icon={Calendar} label="Hire Date" value={member.hireDate} />}
                {member.yearsExperience != null && <InfoRow icon={Calendar} label="Experience" value={`${member.yearsExperience.toFixed(1)} years`} />}
                {member.role && <InfoRow icon={Shield} label="Role" value={member.role} />}
            </div>

            {/* Skills */}
            {member.skills && Object.keys(member.skills).length > 0 && (
                <>
                    <Separator />
                    <div>
                        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            Skills
                        </h4>
                        <div className="space-y-1.5">
                            {Object.entries(member.skills).map(([skill, level]) => (
                                <SkillBar key={skill} label={skill} level={level as number} />
                            ))}
                        </div>
                    </div>
                </>
            )}
        </motion.div>
    )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-medium truncate">{value}</span>
        </div>
    )
}
