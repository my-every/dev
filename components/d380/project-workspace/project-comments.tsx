"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  CornerDownRight,
  Filter,
  MessageCircle,
  MoreHorizontal,
  Send,
  ShieldCheck,
  StickyNote,
  ThumbsUp,
  Pin,
  Flag,
} from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectCommentCategory =
  | "GENERAL"
  | "BLOCKER"
  | "HANDOFF"
  | "QA_NOTE"

export type ProjectCommentStageRef =
  | "READY_TO_LAY"
  | "BUILD_UP"
  | "READY_TO_WIRE"
  | "WIRING"
  | "READY_FOR_VISUAL"
  | "WIRING_IPV"
  | "READY_TO_HANG"
  | "BOX_BUILD"
  | "CROSS_WIRE"
  | "CROSS_WIRE_IPV"
  | "READY_TO_TEST"
  | "TEST_1ST_PASS"
  | "POWER_CHECK"
  | "READY_FOR_BIQ"
  | "BIQ"
  | "FINISHED_BIQ"
  | null

export interface ProjectCommentAuthor {
  badge: string
  name: string
  initials: string
  role: string
  shift: "1ST" | "2ND" | "3RD"
  lwc?: string
}

export interface ProjectCommentRecord {
  id: string
  author: ProjectCommentAuthor
  content: string
  category: ProjectCommentCategory
  stageRef: ProjectCommentStageRef
  sheetRef?: string
  timestamp: string
  isoTimestamp: string
  thumbsUp: number
  isThumbedUp?: boolean
  isPinned?: boolean
  isFlagged?: boolean
  replies?: ProjectCommentRecord[]
}

export interface ProjectCommentsProps {
  projectId: string
  projectName: string
  sheetFilter?: string        // narrow to a single sheet
  stageFilter?: ProjectCommentStageRef
  currentUser?: ProjectCommentAuthor
  initialComments?: ProjectCommentRecord[]
  onCommentPost?: (comment: ProjectCommentRecord) => void
  onReplyPost?: (parentId: string, reply: ProjectCommentRecord) => void
  className?: string
  variant?: "full" | "compact" | "sidebar"
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  ProjectCommentCategory,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  GENERAL: {
    label: "General",
    icon: MessageCircle,
    color: "text-muted-foreground",
    bg: "bg-muted/60",
  },
  BLOCKER: {
    label: "Blocker",
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
  },
  HANDOFF: {
    label: "Handoff",
    icon: ArrowRightLeft,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  QA_NOTE: {
    label: "QA Note",
    icon: ShieldCheck,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/40",
  },
}

const SHIFT_LABEL: Record<string, string> = {
  "1ST": "1st Shift",
  "2ND": "2nd Shift",
  "3RD": "3rd Shift",
}

const MOCK_USER: ProjectCommentAuthor = {
  badge: "U000",
  name: "You",
  initials: "YO",
  role: "Assembler",
  shift: "1ST",
  lwc: "NEW/FLEX",
}

const MOCK_COMMENTS: ProjectCommentRecord[] = [
  {
    id: "c1",
    author: {
      badge: "T042",
      name: "Marcus Webb",
      initials: "MW",
      role: "Team Lead",
      shift: "1ST",
      lwc: "ONSKID",
    },
    content:
      "PNL-A sheet is ready for IPV1. All rails torqued and terminal blocks labelled. Flagging the KA0130 position — it's tight against the left duct. Verified and signed off.",
    category: "HANDOFF",
    stageRef: "IPV1",
    sheetRef: "PNL-A",
    timestamp: "2h ago",
    isoTimestamp: "2026-03-28T10:00:00Z",
    thumbsUp: 3,
    isThumbedUp: false,
    isPinned: true,
    isFlagged: false,
    replies: [
      {
        id: "c1-r1",
        author: {
          badge: "Q011",
          name: "Dana Reyes",
          initials: "DR",
          role: "QA",
          shift: "1ST",
          lwc: "ONSKID",
        },
        content:
          "Confirmed. KA0130 clearance is within spec — 4mm min observed. IPV1 pass logged.",
        category: "QA_NOTE",
        stageRef: "IPV1",
        sheetRef: "PNL-A",
        timestamp: "1h ago",
        isoTimestamp: "2026-03-28T11:00:00Z",
        thumbsUp: 1,
        isThumbedUp: false,
        replies: [],
      },
    ],
  },
  {
    id: "c2",
    author: {
      badge: "B088",
      name: "Jordan Kim",
      initials: "JK",
      role: "Assembler",
      shift: "1ST",
      lwc: "OFFSKID",
    },
    content:
      "Wiring table #2 is tied up until the PROP-88 wire list revision clears. Holding DOOR sheet wiring until confirmed.",
    category: "BLOCKER",
    stageRef: "WIRING",
    sheetRef: "DOOR",
    timestamp: "3h ago",
    isoTimestamp: "2026-03-28T09:00:00Z",
    thumbsUp: 5,
    isThumbedUp: true,
    isPinned: false,
    isFlagged: true,
    replies: [],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// CategoryBadge
// ─────────────────────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: ProjectCommentCategory }) {
  const meta = CATEGORY_META[category]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
        meta.bg,
        meta.color
      )}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden />
      {meta.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthorAvatar
// ─────────────────────────────────────────────────────────────────────────────

function AuthorAvatar({
  author,
  size = "md",
}: {
  author: ProjectCommentAuthor
  size?: "sm" | "md"
}) {
  const shiftColor: Record<string, string> = {
    "1ST": "bg-blue-600",
    "2ND": "bg-amber-600",
    "3RD": "bg-purple-600",
  }
  return (
    <Avatar
      className={cn(
        "border-2 border-background shrink-0",
        size === "sm" ? "h-7 w-7" : "h-9 w-9"
      )}
    >
      <AvatarFallback
        className={cn(
          "text-white font-semibold",
          size === "sm" ? "text-[10px]" : "text-xs",
          shiftColor[author.shift] ?? "bg-muted-foreground"
        )}
      >
        {author.initials}
      </AvatarFallback>
    </Avatar>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CommentInput
// ─────────────────────────────────────────────────────────────────────────────

function CommentInput({
  currentUser,
  placeholder = "Add a comment…",
  defaultCategory = "GENERAL",
  onSubmit,
  onCancel,
  autoFocus = false,
  isReply = false,
  className,
}: {
  currentUser: ProjectCommentAuthor
  placeholder?: string
  defaultCategory?: ProjectCommentCategory
  onSubmit: (content: string, category: ProjectCommentCategory) => void
  onCancel?: () => void
  autoFocus?: boolean
  isReply?: boolean
  className?: string
}) {
  const [content, setContent] = useState("")
  const [category, setCategory] = useState<ProjectCommentCategory>(defaultCategory)
  const [isFocused, setIsFocused] = useState(autoFocus)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputId = useId()

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  const handleSubmit = () => {
    if (!content.trim()) return
    onSubmit(content.trim(), category)
    setContent("")
    setCategory("GENERAL")
    setIsFocused(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === "Escape" && onCancel) {
      e.preventDefault()
      onCancel()
    }
  }

  const CatIcon = CATEGORY_META[category].icon

  return (
    <div
      className={cn(
        "rounded-xl border bg-background transition-all duration-200",
        isFocused
          ? "border-primary/40 ring-2 ring-primary/10 shadow-md"
          : "border-border/50",
        className
      )}
      role="form"
      aria-label="New comment"
    >
      <div className="flex gap-3 p-3">
        <AuthorAvatar author={currentUser} />
        <div className="flex-1 min-w-0">
          <label htmlFor={inputId} className="sr-only">
            {placeholder}
          </label>
          <Textarea
            id={inputId}
            ref={textareaRef}
            placeholder={placeholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            rows={isReply ? 2 : 3}
            className="border-none bg-transparent p-0 resize-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-border/30 bg-muted/20 rounded-b-xl gap-2">
        {/* Category selector — hidden for replies */}
        {!isReply && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className={cn(
                  "h-7 gap-1.5 text-xs font-medium px-2",
                  CATEGORY_META[category].color
                )}
                aria-label="Select comment category"
              >
                <CatIcon className="h-3 w-3" aria-hidden />
                {CATEGORY_META[category].label}
                <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {(Object.keys(CATEGORY_META) as ProjectCommentCategory[]).map((cat) => {
                const m = CATEGORY_META[cat]
                const Icon = m.icon
                return (
                  <DropdownMenuItem
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={cn("gap-2 text-xs", m.color)}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {m.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={onCancel}
              className="h-7 text-xs px-2"
            >
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            type="submit"
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="h-7 gap-1.5 text-xs px-3"
          >
            {isReply ? "Reply" : "Post"}
            <Send className="h-3 w-3" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CommentItem
// ─────────────────────────────────────────────────────────────────────────────

function CommentItem({
  comment,
  currentUser,
  isReply = false,
  activeReplyId,
  setActiveReplyId,
  onAddReply,
  onThumbsUp,
  onPin,
  onFlag,
  variant,
}: {
  comment: ProjectCommentRecord
  currentUser: ProjectCommentAuthor
  isReply?: boolean
  activeReplyId: string | null
  setActiveReplyId: (id: string | null) => void
  onAddReply: (parentId: string, content: string, category: ProjectCommentCategory) => void
  onThumbsUp: (id: string) => void
  onPin: (id: string) => void
  onFlag: (id: string) => void
  variant: "full" | "compact" | "sidebar"
}) {
  const [expanded, setExpanded] = useState(true)
  const isReplying = activeReplyId === comment.id
  const replyRef = useRef<HTMLDivElement>(null)
  const replyCount = comment.replies?.length ?? 0
  const isCompact = variant === "compact" || variant === "sidebar"

  useEffect(() => {
    if (isReplying && replyRef.current) {
      const ta = replyRef.current.querySelector("textarea")
      if (ta) setTimeout(() => ta.focus(), 80)
    }
  }, [isReplying])

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        "group relative",
        isReply && "ml-9 pl-3 border-l-2 border-border/40",
        comment.isPinned && !isReply && "ring-1 ring-primary/20 rounded-xl p-3 bg-primary/[0.02]",
        comment.isFlagged && !isReply && "ring-1 ring-amber-400/30 rounded-xl p-3 bg-amber-50/30 dark:bg-amber-950/10"
      )}
      id={`comment-${comment.id}`}
      aria-label={`Comment by ${comment.author.name}`}
    >
      <div className="flex gap-3">
        <AuthorAvatar author={comment.author} size={isReply ? "sm" : "md"} />

        <div className="flex-1 min-w-0 space-y-1">
          {/* Header */}
          <header className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-sm font-semibold leading-none">
                {comment.author.name}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                #{comment.author.badge}
              </span>
              {!isCompact && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                  {comment.author.role} · {SHIFT_LABEL[comment.author.shift]}
                </span>
              )}
              <time
                className="text-xs text-muted-foreground"
                dateTime={comment.isoTimestamp}
              >
                {comment.timestamp}
              </time>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {comment.isPinned && (
                <Pin className="h-3 w-3 text-primary" aria-label="Pinned" />
              )}
              {comment.isFlagged && (
                <Flag className="h-3 w-3 text-amber-500" aria-label="Flagged" />
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                    aria-label="Comment options"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => onPin(comment.id)} className="text-xs gap-2">
                    <Pin className="h-3.5 w-3.5" aria-hidden />
                    {comment.isPinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onFlag(comment.id)} className="text-xs gap-2">
                    <Flag className="h-3.5 w-3.5" aria-hidden />
                    {comment.isFlagged ? "Unflag" : "Flag"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-xs gap-2 text-destructive focus:text-destructive">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Category + sheet/stage refs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={comment.category} />
            {comment.sheetRef && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {comment.sheetRef}
              </span>
            )}
            {comment.stageRef && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
                {comment.stageRef.replace("_", " ")}
              </span>
            )}
          </div>

          {/* Body */}
          <p className="text-sm text-foreground/90 leading-relaxed">
            {comment.content}
          </p>

          {/* Actions */}
          <nav className="flex items-center gap-3 pt-0.5" aria-label="Comment actions">
            <button
              type="button"
              onClick={() => onThumbsUp(comment.id)}
              className={cn(
                "flex items-center gap-1 text-xs font-medium transition-colors rounded focus:outline-none focus:ring-1 focus:ring-primary",
                comment.isThumbedUp
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={comment.isThumbedUp}
              aria-label={`${comment.isThumbedUp ? "Remove thumbs up" : "Thumbs up"} (${comment.thumbsUp})`}
            >
              <ThumbsUp
                className={cn("h-3.5 w-3.5", comment.isThumbedUp && "fill-current")}
                aria-hidden
              />
              <span aria-live="polite">{comment.thumbsUp}</span>
            </button>

            {!isReply && (
              <button
                type="button"
                onClick={() => setActiveReplyId(isReplying ? null : comment.id)}
                className={cn(
                  "flex items-center gap-1 text-xs font-medium transition-colors rounded focus:outline-none focus:ring-1 focus:ring-primary",
                  isReplying
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-expanded={isReplying}
                aria-label={isReplying ? "Cancel reply" : `Reply to ${comment.author.name}`}
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                Reply
              </button>
            )}
          </nav>

          {/* Inline reply input */}
          <AnimatePresence>
            {isReplying && (
              <motion.div
                ref={replyRef}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-3 overflow-hidden"
                id={`reply-input-${comment.id}`}
              >
                <CommentInput
                  currentUser={currentUser}
                  placeholder={`Reply to ${comment.author.name}…`}
                  autoFocus
                  isReply
                  onSubmit={(content, cat) => onAddReply(comment.id, content, cat)}
                  onCancel={() => setActiveReplyId(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nested replies */}
      {replyCount > 0 && (
        <div className="mt-3 space-y-3" aria-label={`${replyCount} ${replyCount === 1 ? "reply" : "replies"}`}>
          <AnimatePresence>
            {expanded &&
              comment.replies!.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUser={currentUser}
                  isReply
                  activeReplyId={activeReplyId}
                  setActiveReplyId={setActiveReplyId}
                  onAddReply={onAddReply}
                  onThumbsUp={onThumbsUp}
                  onPin={onPin}
                  onFlag={onFlag}
                  variant={variant}
                />
              ))}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="ml-10 flex items-center gap-1 text-xs font-medium text-primary hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded"
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                <div className="h-px w-3 bg-primary/50 mr-0.5" aria-hidden />
                Hide replies
              </>
            ) : (
              <>
                <CornerDownRight className="h-3 w-3" aria-hidden />
                Show {replyCount} {replyCount === 1 ? "reply" : "replies"}
              </>
            )}
          </button>
        </div>
      )}
    </motion.article>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ProjectComments (main export)
// ─────────────────────────────────────────────────────────────────────────────

export function ProjectComments({
  projectId,
  projectName,
  sheetFilter,
  stageFilter,
  currentUser = MOCK_USER,
  initialComments = MOCK_COMMENTS,
  onCommentPost,
  onReplyPost,
  className,
  variant = "full",
}: ProjectCommentsProps) {
  const [comments, setComments] = useState<ProjectCommentRecord[]>(initialComments)
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const [filterCategory, setFilterCategory] = useState<ProjectCommentCategory | "ALL">("ALL")
  const [sortMode, setSortMode] = useState<"NEWEST" | "TOP">("NEWEST")

  const announce = (msg: string) => {
    setAnnouncement(msg)
    setTimeout(() => setAnnouncement(""), 1200)
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  const addReplyToTree = (
    nodes: ProjectCommentRecord[],
    parentId: string,
    reply: ProjectCommentRecord
  ): ProjectCommentRecord[] =>
    nodes.map((c) => {
      if (c.id === parentId) return { ...c, replies: [...(c.replies ?? []), reply] }
      if (c.replies?.length) return { ...c, replies: addReplyToTree(c.replies, parentId, reply) }
      return c
    })

  const mutateNode = (
    nodes: ProjectCommentRecord[],
    id: string,
    fn: (c: ProjectCommentRecord) => ProjectCommentRecord
  ): ProjectCommentRecord[] =>
    nodes.map((c) => {
      if (c.id === id) return fn(c)
      if (c.replies?.length) return { ...c, replies: mutateNode(c.replies, id, fn) }
      return c
    })

  const handlePost = (content: string, category: ProjectCommentCategory) => {
    const record: ProjectCommentRecord = {
      id: `c-${Date.now()}`,
      author: currentUser,
      content,
      category,
      stageRef: stageFilter ?? null,
      sheetRef: sheetFilter,
      timestamp: "Just now",
      isoTimestamp: new Date().toISOString(),
      thumbsUp: 0,
      isThumbedUp: false,
      isPinned: false,
      isFlagged: false,
      replies: [],
    }
    setComments((prev) => [record, ...prev])
    onCommentPost?.(record)
    announce("Comment posted")
  }

  const handleReply = (parentId: string, content: string, category: ProjectCommentCategory) => {
    const reply: ProjectCommentRecord = {
      id: `r-${Date.now()}`,
      author: currentUser,
      content,
      category,
      stageRef: null,
      timestamp: "Just now",
      isoTimestamp: new Date().toISOString(),
      thumbsUp: 0,
      isThumbedUp: false,
      replies: [],
    }
    setComments((prev) => addReplyToTree(prev, parentId, reply))
    setActiveReplyId(null)
    onReplyPost?.(parentId, reply)
    announce("Reply posted")
  }

  const handleThumbsUp = (id: string) =>
    setComments((prev) =>
      mutateNode(prev, id, (c) => ({
        ...c,
        isThumbedUp: !c.isThumbedUp,
        thumbsUp: c.isThumbedUp ? c.thumbsUp - 1 : c.thumbsUp + 1,
      }))
    )

  const handlePin = (id: string) =>
    setComments((prev) =>
      mutateNode(prev, id, (c) => ({ ...c, isPinned: !c.isPinned }))
    )

  const handleFlag = (id: string) =>
    setComments((prev) =>
      mutateNode(prev, id, (c) => ({ ...c, isFlagged: !c.isFlagged }))
    )

  // ── Filter + sort ────────────────────────────────────────────────────────

  const visible = comments
    .filter((c) => filterCategory === "ALL" || c.category === filterCategory)
    .filter((c) => !sheetFilter || c.sheetRef === sheetFilter)
    .filter((c) => !stageFilter || c.stageRef === stageFilter)
    .sort((a, b) => {
      if (sortMode === "TOP") return b.thumbsUp - a.thumbsUp
      return b.isoTimestamp.localeCompare(a.isoTimestamp)
    })

  const isCompact = variant === "compact" || variant === "sidebar"

  return (
    <section
      className={cn("flex flex-col gap-5", className)}
      aria-label={`Comments for ${projectName}`}
    >
      {/* SR announcements */}
      <div role="status" aria-live="polite" aria-atomic className="sr-only">
        {announcement}
      </div>

      {/* Header */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold" id={`${projectId}-comments-heading`}>
            Comments
          </h2>
          <Badge variant="secondary" className="text-[10px] font-mono h-5 px-1.5">
            {visible.length}
          </Badge>
          {sheetFilter && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              {sheetFilter}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Category filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" type="button">
                <Filter className="h-3 w-3" aria-hidden />
                {filterCategory === "ALL" ? "All" : CATEGORY_META[filterCategory].label}
                <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                onClick={() => setFilterCategory("ALL")}
                className="text-xs"
              >
                All categories
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {(Object.keys(CATEGORY_META) as ProjectCommentCategory[]).map((cat) => {
                const m = CATEGORY_META[cat]
                const Icon = m.icon
                return (
                  <DropdownMenuItem
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={cn("text-xs gap-2", m.color)}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {m.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <Button
            variant={sortMode === "NEWEST" ? "secondary" : "ghost"}
            size="sm"
            type="button"
            onClick={() => setSortMode("NEWEST")}
            className="h-7 text-xs px-2"
            aria-pressed={sortMode === "NEWEST"}
          >
            Newest
          </Button>
          <Button
            variant={sortMode === "TOP" ? "secondary" : "ghost"}
            size="sm"
            type="button"
            onClick={() => setSortMode("TOP")}
            className="h-7 text-xs px-2"
            aria-pressed={sortMode === "TOP"}
          >
            <ThumbsUp className="h-3 w-3 mr-1" aria-hidden />
            Top
          </Button>
        </div>
      </header>

      {/* Input */}
      <CommentInput
        currentUser={currentUser}
        placeholder={
          sheetFilter
            ? `Comment on ${sheetFilter}…`
            : `Comment on ${projectName}…`
        }
        onSubmit={handlePost}
      />

      {/* List */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" aria-hidden />
          <p className="text-sm text-muted-foreground">No comments yet.</p>
          <p className="text-xs text-muted-foreground/60">
            Be the first to post a note, blocker, or handoff.
          </p>
        </div>
      ) : (
        <div
          className="space-y-5"
          role="list"
          aria-labelledby={`${projectId}-comments-heading`}
        >
          <AnimatePresence mode="popLayout">
            {visible.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUser={currentUser}
                activeReplyId={activeReplyId}
                setActiveReplyId={setActiveReplyId}
                onAddReply={handleReply}
                onThumbsUp={handleThumbsUp}
                onPin={handlePin}
                onFlag={handleFlag}
                variant={variant}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  )
}
