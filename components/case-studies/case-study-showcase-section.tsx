"use client";

import {
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
	type MutableRefObject,
	type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	FileText,
	GalleryVerticalEnd,
	Search,
	SlidersHorizontal,
} from "lucide-react";

import type { CaseStudyRecord, Industry, Product, Region } from "@/lib/case-studies/case-studies";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type CaseStudyFilters = {
	products: Product[];
	regions: Region[];
	industries: Industry[];
	query: string;
};

type CaseStudyShowcaseLayout = "rail" | "grid-auto";

type RelatedRow = {
	label: string;
	items: CaseStudyRecord[];
};

type FilterOptionSets = {
	products: Product[];
	regions: Region[];
	industries: Industry[];
};

export interface CaseStudyShowcaseSectionProps {
	caseStudies: CaseStudyRecord[];
	featuredCaseStudies?: CaseStudyRecord[];
	defaultFilters?: Partial<CaseStudyFilters>;
	layout?: CaseStudyShowcaseLayout;
	title?: string;
	description?: string;
}

const EASE_OUT_QUINT = [0.23, 1, 0.32, 1] as const;

function normalizeDocumentUrl(caseStudy: CaseStudyRecord) {
	return caseStudy.pdfUrl ?? caseStudy.sourceUrl ?? caseStudy.url;
}

function buildSummary(caseStudy: CaseStudyRecord) {
	return (
		caseStudy.summary ??
		caseStudy.description ??
		`Explore how ${caseStudy.name} connects to ${caseStudy.products.join(", ") || "the product line"} across ${caseStudy.industries.join(", ") || "multiple industries"}.`
	);
}

function collectFilterOptions(caseStudies: CaseStudyRecord[]): FilterOptionSets {
	return {
		products: Array.from(new Set(caseStudies.flatMap((caseStudy) => caseStudy.products))).sort(),
		regions: Array.from(new Set(caseStudies.flatMap((caseStudy) => caseStudy.regions))).sort(),
		industries: Array.from(new Set(caseStudies.flatMap((caseStudy) => caseStudy.industries))).sort(),
	};
}

function toggleValue<T extends string>(values: T[], value: T) {
	return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function matchesCaseStudyFilters(caseStudy: CaseStudyRecord, filters: CaseStudyFilters) {
	const normalizedQuery = filters.query.trim().toLowerCase();
	const matchesQuery =
		normalizedQuery.length === 0 ||
		caseStudy.name.toLowerCase().includes(normalizedQuery) ||
		buildSummary(caseStudy).toLowerCase().includes(normalizedQuery);

	const matchesProducts =
		filters.products.length === 0 || filters.products.some((product) => caseStudy.products.includes(product));
	const matchesRegions =
		filters.regions.length === 0 || filters.regions.some((region) => caseStudy.regions.includes(region));
	const matchesIndustries =
		filters.industries.length === 0 || filters.industries.some((industry) => caseStudy.industries.includes(industry));

	return matchesQuery && matchesProducts && matchesRegions && matchesIndustries;
}

function getCaseStudyFilterScore(caseStudy: CaseStudyRecord, filters: CaseStudyFilters) {
	let score = 0;

	score += filters.products.filter((product) => caseStudy.products.includes(product)).length * 4;
	score += filters.industries.filter((industry) => caseStudy.industries.includes(industry)).length * 3;
	score += filters.regions.filter((region) => caseStudy.regions.includes(region)).length * 2;

	if (filters.query.trim().length > 0) {
		const query = filters.query.trim().toLowerCase();
		if (caseStudy.name.toLowerCase().includes(query)) {
			score += 5;
		}
		if (buildSummary(caseStudy).toLowerCase().includes(query)) {
			score += 2;
		}
	}

	if (caseStudy.featured) {
		score += 1;
	}

	return score;
}

function sortCaseStudiesForDisplay(caseStudies: CaseStudyRecord[], filters: CaseStudyFilters) {
	return [...caseStudies].sort((left, right) => {
		const scoreDelta = getCaseStudyFilterScore(right, filters) - getCaseStudyFilterScore(left, filters);
		if (scoreDelta !== 0) {
			return scoreDelta;
		}
		return left.name.localeCompare(right.name);
	});
}

function buildRelatedRows(caseStudies: CaseStudyRecord[], activeCaseStudy: CaseStudyRecord): RelatedRow[] {
	const remaining = caseStudies
		.filter((caseStudy) => caseStudy.id !== activeCaseStudy.id)
		.sort((left, right) => left.name.localeCompare(right.name));
	const usedIds = new Set<string>();

	const createRow = (label: string, predicate: (caseStudy: CaseStudyRecord) => boolean): RelatedRow | null => {
		const items = remaining
			.filter((caseStudy) => !usedIds.has(caseStudy.id))
			.filter(predicate)
			.slice(0, 12);

		if (items.length === 0) {
			return null;
		}

		for (const item of items) {
			usedIds.add(item.id);
		}

		return { label, items };
	};

	return [
		createRow("Same product", (caseStudy) => caseStudy.products.some((product) => activeCaseStudy.products.includes(product))),
		createRow("Same industry", (caseStudy) => caseStudy.industries.some((industry) => activeCaseStudy.industries.includes(industry))),
		createRow("Same region", (caseStudy) => caseStudy.regions.some((region) => activeCaseStudy.regions.includes(region))),
	].filter((row): row is RelatedRow => Boolean(row));
}

function scrollRail(railRef: MutableRefObject<HTMLDivElement | null>, direction: "prev" | "next") {
	const rail = railRef.current;
	if (!rail) {
		return;
	}

	const amount = rail.clientWidth * 0.85;
	rail.scrollBy({
		left: direction === "next" ? amount : -amount,
		behavior: "smooth",
	});
}

function handleRailKeyboardNavigation(event: KeyboardEvent<HTMLElement>) {
	const card = event.currentTarget.closest("[data-case-study-card]") as HTMLElement | null;
	if (!card) {
		return;
	}

	if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
		event.preventDefault();
		const sibling =
			event.key === "ArrowRight"
				? (card.parentElement?.nextElementSibling?.querySelector("[data-case-study-card]") as HTMLElement | null)
				: (card.parentElement?.previousElementSibling?.querySelector("[data-case-study-card]") as HTMLElement | null);
		sibling?.focus();
	}
}

function CaseStudyArtwork({ caseStudy }: { caseStudy: CaseStudyRecord }) {
	const imageUrl = caseStudy.thumbnailImageUrl ?? caseStudy.imageUrl;

	if (imageUrl) {
		return <img src={imageUrl} alt={caseStudy.name} className="h-full w-full object-cover" />;
	}

	return (
		<div className="flex h-full w-full flex-col justify-between bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.22),transparent_38%),linear-gradient(145deg,rgba(15,23,42,0.94),rgba(51,65,85,0.96))] p-4 text-white">
			<div className="flex items-center justify-between gap-3">
				<span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/80">
					Case Study
				</span>
				<GalleryVerticalEnd className="h-4 w-4 text-white/70" />
			</div>
			<div className="space-y-3">
				{caseStudy.logoImageUrl ? (
					<img
						src={caseStudy.logoImageUrl}
						alt={`${caseStudy.name} logo`}
						className="h-10 max-w-[8rem] object-contain object-left"
					/>
				) : null}
				<div className="text-lg font-semibold leading-tight">{caseStudy.name}</div>
				<p className="text-sm leading-6 text-white/70">
					Add `thumbnailImageUrl`, `logoImageUrl`, or `summary` in `case-studies.ts` to enrich this card.
				</p>
			</div>
		</div>
	);
}

function TaxonomyBadges({
	label,
	values,
	color,
}: {
	label: string;
	values: string[];
	color: "blue" | "emerald" | "amber";
}) {
	if (values.length === 0) {
		return null;
	}

	return (
		<div className="space-y-2">
			<div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
			<div className="flex flex-wrap gap-2">
				{values.map((value) => (
					<Badge key={`${label}-${value}`} variant="dot" color={color} className="rounded-full bg-background/80">
						{value}
					</Badge>
				))}
			</div>
		</div>
	);
}

function FilterChip({
	label,
	active,
	onClick,
	ariaLabel,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
	ariaLabel: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			aria-label={ariaLabel}
			className={cn(
				"rounded-full border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
				active
					? "border-primary bg-primary text-primary-foreground"
					: "border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
			)}
		>
			{label}
		</button>
	);
}

function RailControls({
	label,
	railRef,
	className,
}: {
	label: string;
	railRef: MutableRefObject<HTMLDivElement | null>;
	className?: string;
}) {
	return (
		<div className={cn("hidden items-center gap-2 md:flex", className)}>
			<Button
				type="button"
				variant="outline"
				size="icon-sm"
				className="rounded-full"
				aria-label={`Scroll ${label} backward`}
				onClick={() => scrollRail(railRef, "prev")}
			>
				<ChevronLeft className="h-4 w-4" />
			</Button>
			<Button
				type="button"
				variant="outline"
				size="icon-sm"
				className="rounded-full"
				aria-label={`Scroll ${label} forward`}
				onClick={() => scrollRail(railRef, "next")}
			>
				<ChevronRight className="h-4 w-4" />
			</Button>
		</div>
	);
}

function RelatedCaseStudyCard({
	caseStudy,
	onSelect,
	prefersReducedMotion,
}: {
	caseStudy: CaseStudyRecord;
	onSelect: (caseStudy: CaseStudyRecord) => void;
	prefersReducedMotion: boolean;
}) {
	return (
		<button
			type="button"
			onClick={() => onSelect(caseStudy)}
			className={cn(
				"w-[15rem] shrink-0 snap-start rounded-[1.5rem] border border-border/70 bg-background p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
				prefersReducedMotion ? "" : "transition-colors hover:border-primary/40 hover:bg-muted/35",
			)}
			aria-label={`Open related case study ${caseStudy.name}`}
		>
			<div className="space-y-3">
				<div className="aspect-[16/10] overflow-hidden rounded-[1.25rem] border border-border/60 bg-muted/50">
					<CaseStudyArtwork caseStudy={caseStudy} />
				</div>
				<div className="space-y-2">
					<p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">{caseStudy.name}</p>
					<div className="flex flex-wrap gap-2">
						{caseStudy.products.slice(0, 2).map((product) => (
							<Badge key={`${caseStudy.id}-${product}`} variant="dot" color="blue" className="rounded-full">
								{product}
							</Badge>
						))}
					</div>
				</div>
			</div>
		</button>
	);
}

function RelatedCaseStudyRow({
	row,
	onSelect,
	prefersReducedMotion,
}: {
	row: RelatedRow;
	onSelect: (caseStudy: CaseStudyRecord) => void;
	prefersReducedMotion: boolean;
}) {
	const railRef = useRef<HTMLDivElement | null>(null);

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h4 className="text-sm font-semibold text-foreground">{row.label}</h4>
					<p className="text-xs text-muted-foreground">{row.items.length} studies</p>
				</div>
				<RailControls label={`${row.label.toLowerCase()} studies`} railRef={railRef} />
			</div>
			<div
				ref={railRef}
				className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				aria-label={`${row.label} case studies`}
			>
				<div aria-hidden className="w-px shrink-0" />
				{row.items.map((caseStudy) => (
					<RelatedCaseStudyCard
						key={`${row.label}-${caseStudy.id}`}
						caseStudy={caseStudy}
						onSelect={onSelect}
						prefersReducedMotion={prefersReducedMotion}
					/>
				))}
				<div aria-hidden className="w-4 shrink-0" />
			</div>
		</div>
	);
}

function PreviewFallback({
	caseStudy,
	state,
}: {
	caseStudy: CaseStudyRecord;
	state: "loading" | "ready" | "fallback";
}) {
	if (state === "ready") {
		return null;
	}

	const sourceUrl = caseStudy.sourceUrl ?? caseStudy.url;

	return (
		<div className="absolute inset-0 flex items-center justify-center bg-background/80 p-6 text-center backdrop-blur-sm">
			<div className="max-w-md space-y-3">
				<p className="text-sm font-medium text-foreground">
					{state === "loading" ? "Loading case study preview..." : "Preview is unavailable in this embedded view."}
				</p>
				<p className="text-sm leading-6 text-muted-foreground">
					{state === "loading"
						? "Some source documents take a moment to appear."
						: "Open the original source in a separate tab to review the document directly."}
				</p>
				<Button asChild className="rounded-full">
					<a href={sourceUrl} target="_blank" rel="noreferrer">
						Open source
						<ExternalLink className="ml-1 h-3.5 w-3.5" />
					</a>
				</Button>
			</div>
		</div>
	);
}

function CaseStudyPreviewDialog({
	caseStudies,
	activeCaseStudy,
	open,
	onOpenChange,
	onSelect,
}: {
	caseStudies: CaseStudyRecord[];
	activeCaseStudy: CaseStudyRecord | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect: (caseStudy: CaseStudyRecord) => void;
}) {
	const prefersReducedMotion = useReducedMotion() ?? false;
	const [previewState, setPreviewState] = useState<"loading" | "ready" | "fallback">("loading");

	const relatedRows = useMemo(
		() => (activeCaseStudy ? buildRelatedRows(caseStudies, activeCaseStudy) : []),
		[activeCaseStudy, caseStudies],
	);

	useEffect(() => {
		if (!open || !activeCaseStudy) {
			return;
		}

		setPreviewState("loading");
		const timeout = window.setTimeout(() => {
			setPreviewState((state) => (state === "ready" ? state : "fallback"));
		}, 4000);

		return () => window.clearTimeout(timeout);
	}, [activeCaseStudy, open]);

	if (!activeCaseStudy) {
		return null;
	}

	const documentUrl = normalizeDocumentUrl(activeCaseStudy);
	const sourceUrl = activeCaseStudy.sourceUrl ?? activeCaseStudy.url;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				size="lg"
				mobileSheet
				className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[min(96vw,78rem)] flex-col gap-0 overflow-hidden border-0 p-0 sm:h-[min(92vh,58rem)] sm:rounded-[2rem] sm:border"
			>
				<div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,42%)]">
					<div className="min-h-0 overflow-y-auto border-b border-border/70 lg:border-b-0 lg:border-r">
						<div className="space-y-6 p-4 sm:p-6">
							<div className="space-y-4">
								<DialogHeader className="mb-0 pr-10">
									<DialogTitle className="text-xl sm:text-2xl">{activeCaseStudy.name}</DialogTitle>
									<DialogDescription className="text-sm leading-6">
										Preview the case study inline, then continue browsing related installations without losing your current filters.
									</DialogDescription>
								</DialogHeader>
								<div className="grid gap-3 sm:grid-cols-3">
									<TaxonomyBadges label="Products" values={activeCaseStudy.products} color="blue" />
									<TaxonomyBadges label="Regions" values={activeCaseStudy.regions} color="emerald" />
									<TaxonomyBadges label="Industries" values={activeCaseStudy.industries} color="amber" />
								</div>
								<Button asChild variant="outline" size="sm" className="rounded-full">
									<a href={sourceUrl} target="_blank" rel="noreferrer">
										Open source
										<ExternalLink className="ml-1 h-3.5 w-3.5" />
									</a>
								</Button>
							</div>

							<div className="rounded-[1.5rem] border border-border/70 bg-muted/20 p-4 sm:p-5">
								<p className="text-sm leading-7 text-muted-foreground">{buildSummary(activeCaseStudy)}</p>
							</div>

							<div className="space-y-5 rounded-[1.5rem] border border-border/70 bg-muted/20 p-4 sm:p-5">
								<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
									<FileText className="h-4 w-4" />
									More like this
								</div>
								{relatedRows.length > 0 ? (
									<div className="space-y-5">
										{relatedRows.map((row) => (
											<RelatedCaseStudyRow
												key={`${activeCaseStudy.id}-${row.label}`}
												row={row}
												onSelect={onSelect}
												prefersReducedMotion={prefersReducedMotion}
											/>
										))}
									</div>
								) : (
									<p className="text-sm text-muted-foreground">
										No related case studies were found for the active filters yet.
									</p>
								)}
							</div>
						</div>
					</div>

					<div className="min-h-0 overflow-y-auto bg-muted/10">
						<div className="h-full p-4 sm:p-6">
							<div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted/20">
								<div className="border-b border-border/70 px-4 py-3 text-sm text-muted-foreground">
									Document preview
								</div>
								<div className="relative min-h-[55dvh] bg-white lg:min-h-[calc(min(92vh,58rem)-7rem)]">
									<iframe
										title={`${activeCaseStudy.name} case study`}
										src={documentUrl}
										onLoad={() => setPreviewState("ready")}
										className="h-[55dvh] min-h-[55dvh] w-full bg-white lg:h-[calc(min(92vh,58rem)-7rem)] lg:min-h-[calc(min(92vh,58rem)-7rem)]"
									/>
									<PreviewFallback caseStudy={activeCaseStudy} state={previewState} />
								</div>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function CaseStudyCard({
	caseStudy,
	onPreview,
	prefersReducedMotion,
}: {
	caseStudy: CaseStudyRecord;
	onPreview: (caseStudy: CaseStudyRecord) => void;
	prefersReducedMotion: boolean;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [isFocused, setIsFocused] = useState(false);
	const cardRef = useRef<HTMLDivElement | null>(null);
	const isDetailVisible = isOpen || isHovered || isFocused;

	useEffect(() => {
		if (!isDetailVisible || !cardRef.current) {
			return;
		}

		cardRef.current.scrollIntoView({
			behavior: prefersReducedMotion ? "auto" : "smooth",
			block: "nearest",
			inline: "center",
		});
	}, [isDetailVisible, prefersReducedMotion]);

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<motion.div
				ref={cardRef}
				layout
				data-case-study-card
				tabIndex={0}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				onFocus={() => setIsFocused(true)}
				onBlur={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
						setIsFocused(false);
					}
				}}
				onKeyDown={(event) => {
					handleRailKeyboardNavigation(event);
					if ((event.key === "Enter" || event.key === " ") && event.currentTarget === event.target) {
						event.preventDefault();
						setIsOpen((current) => !current);
					}
				}}
				role="button"
				aria-expanded={isOpen}
				aria-label={`${caseStudy.name} card${isDetailVisible ? ", expanded" : ""}`}
				animate={{
					width: isDetailVisible ? "min(72rem, calc(85vw + 18rem))" : "min(85vw, 30rem)",
				}}
				transition={
					prefersReducedMotion
						? { duration: 0 }
						: { duration: 0.28, ease: EASE_OUT_QUINT }
				}
			>
				<Card
					className={cn(
						"h-full overflow-hidden rounded-[2rem] border-border/70 bg-card/95 p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
						prefersReducedMotion ? "" : "transition-transform duration-200 hover:-translate-y-0.5",
					)}
				>
				<motion.div
					layout
					className={cn("grid h-full gap-0", isDetailVisible ? "md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]" : "grid-cols-1")}
					transition={
						prefersReducedMotion
							? { duration: 0 }
							: { duration: 0.28, ease: EASE_OUT_QUINT }
					}
				>
					<div className={cn(
						"relative overflow-hidden",
						isDetailVisible ? "aspect-[4/3] border-b border-border/70 md:aspect-auto md:min-h-full md:border-b-0 md:border-r" : "aspect-[16/10] min-h-[23rem]"
					)}>
						<CaseStudyArtwork caseStudy={caseStudy} />
						<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5 text-white">
							<div className="space-y-3">
								<div className="flex flex-wrap gap-2">
									{caseStudy.featured ? (
										<Badge className="rounded-full bg-white text-slate-950">Featured</Badge>
									) : null}
									{caseStudy.products.slice(0, 2).map((product) => (
										<Badge
											key={`${caseStudy.id}-overlay-${product}`}
											variant="outline"
											className="rounded-full border-white/20 bg-white/10 text-white"
										>
											{product}
										</Badge>
									))}
								</div>
								<div className="space-y-2">
									<h3 className="text-2xl font-semibold tracking-tight">{caseStudy.name}</h3>
									<p className="line-clamp-2 text-sm leading-6 text-white/75">{buildSummary(caseStudy)}</p>
								</div>
								<div className="flex flex-wrap gap-3 pt-1">
									<Button
										type="button"
										className="rounded-full bg-white text-slate-950 hover:bg-white/90"
										onClick={() => onPreview(caseStudy)}
										aria-label={`Open case study preview for ${caseStudy.name}`}
									>
										Open case study
									</Button>
									<CollapsibleTrigger asChild>
										<Button
											type="button"
											variant="outline"
											className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
											aria-label={`${isOpen ? "Hide" : "Expand"} details for ${caseStudy.name}`}
										>
											<span>{isOpen ? "Hide details" : "View details"}</span>
											<ChevronDown
												className={cn(
													"ml-1 h-4 w-4",
													prefersReducedMotion ? "" : "transition-transform",
													isOpen && "rotate-180",
												)}
											/>
										</Button>
									</CollapsibleTrigger>
								</div>
							</div>
						</div>
					</div>

					<AnimatePresence mode="popLayout" initial={false}>
						{isDetailVisible ? (
							<motion.div
								key="case-study-detail-panel"
								layout
								animate={
									prefersReducedMotion
										? { width: "100%", opacity: 1 }
										: { width: "100%", opacity: 1, filter: "blur(0px)" }
								}
								exit={
									prefersReducedMotion
										? { width: 0, opacity: 0 }
										: { width: 0, opacity: 0, filter: "blur(4px)" }
								}
								initial={
									prefersReducedMotion
										? { width: 0, opacity: 0 }
										: { width: 0, opacity: 0, filter: "blur(4px)" }
								}
								className="overflow-hidden"
								transition={
									prefersReducedMotion
										? { duration: 0 }
										: { duration: 0.25, ease: EASE_OUT_QUINT }
								}
							>
								<motion.div
									animate={
										prefersReducedMotion
											? { opacity: 1, x: 0 }
											: { opacity: 1, x: 0, filter: "blur(0px)" }
									}
									exit={
										prefersReducedMotion
											? { opacity: 0, x: 12 }
											: { opacity: 0, x: 12, filter: "blur(4px)" }
									}
									initial={
										prefersReducedMotion
											? { opacity: 0, x: 12 }
											: { opacity: 0, x: 12, filter: "blur(4px)" }
									}
									transition={
										prefersReducedMotion
											? { duration: 0 }
											: { delay: 0.08, duration: 0.2, ease: EASE_OUT_QUINT }
									}
									className="flex h-full flex-col gap-4 p-5 sm:p-6"
								>
									<div className="grid gap-3 sm:grid-cols-3">
										<TaxonomyBadges label="Products" values={caseStudy.products} color="blue" />
										<TaxonomyBadges label="Regions" values={caseStudy.regions} color="emerald" />
										<TaxonomyBadges label="Industries" values={caseStudy.industries} color="amber" />
									</div>

									<CollapsibleContent forceMount className="overflow-hidden data-[state=closed]:hidden data-[state=open]:block">
										<div className="grid gap-4 rounded-[1.5rem] border border-border/70 bg-muted/30 p-4 text-sm sm:grid-cols-3">
											<div className="space-y-2">
												<div className="font-medium text-foreground">Preview source</div>
												<p className="leading-6 text-muted-foreground">
													{caseStudy.pdfUrl ? "Direct PDF available" : "External source preview"}
												</p>
											</div>
											<div className="space-y-2">
												<div className="font-medium text-foreground">Related coverage</div>
												<p className="leading-6 text-muted-foreground">
													{caseStudy.products.length + caseStudy.regions.length + caseStudy.industries.length} linked taxonomy tags
												</p>
											</div>
											<div className="space-y-2">
												<div className="font-medium text-foreground">Open behavior</div>
												<p className="leading-6 text-muted-foreground">
													Inline preview with external fallback link always available
												</p>
											</div>
										</div>
									</CollapsibleContent>

									{!isOpen ? (
										<div className="rounded-[1.5rem] border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
											Hover or focus this card to peek at its taxonomy, or click “View details” to keep the full right panel open.
										</div>
									) : null}
								</motion.div>
							</motion.div>
						) : null}
					</AnimatePresence>

					{!isDetailVisible ? (
						<div className="pointer-events-none hidden md:block" aria-hidden />
					) : null}
				</motion.div>
				</Card>
			</motion.div>
		</Collapsible>
	);
}

function FilterGroup<T extends string>({
	label,
	values,
	selected,
	onToggle,
}: {
	label: string;
	values: T[];
	selected: T[];
	onToggle: (value: T) => void;
}) {
	if (values.length === 0) {
		return null;
	}

	return (
		<div className="space-y-3">
			<div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
			<div className="flex flex-wrap gap-2">
				{values.map((value) => (
					<FilterChip
						key={`${label}-${value}`}
						label={value}
						active={selected.includes(value)}
						onClick={() => onToggle(value)}
						ariaLabel={`Filter case studies by ${label.toLowerCase()} ${value}`}
					/>
				))}
			</div>
		</div>
	);
}

function EmptyState({ onReset }: { onReset: () => void }) {
	return (
		<div className="rounded-[2rem] border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
			<div className="space-y-3">
				<h3 className="text-lg font-semibold text-foreground">No case studies match these filters</h3>
				<p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">
					Try clearing one or more filters, or use a broader search term to bring more results back into the rail.
				</p>
				<Button type="button" variant="outline" className="rounded-full" onClick={onReset}>
					Clear filters
				</Button>
			</div>
		</div>
	);
}

function RailShell({
	label,
	railRef,
	children,
	layout,
}: {
	label: string;
	railRef: MutableRefObject<HTMLDivElement | null>;
	children: ReactNode;
	layout: CaseStudyShowcaseLayout;
}) {
	if (layout === "grid-auto") {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-end">
					<RailControls label={label} railRef={railRef} />
				</div>
				<div
					ref={railRef}
					className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:grid xl:grid-cols-2 xl:overflow-visible"
					aria-label={label}
				>
					{children}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-end">
				<RailControls label={label} railRef={railRef} />
			</div>
			<div
				ref={railRef}
				className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				aria-label={label}
			>
				{children}
			</div>
		</div>
	);
}

export function CaseStudyShowcaseSection({
	caseStudies,
	featuredCaseStudies,
	defaultFilters,
	layout = "rail",
	title = "Case studies",
	description = "A reusable mobile-first library of expandable case study cards with inline document preview, faceted filtering, and snap-scrolling discovery.",
}: CaseStudyShowcaseSectionProps) {
	const prefersReducedMotion = useReducedMotion() ?? false;
	const railRef = useRef<HTMLDivElement | null>(null);
	const [activeCaseStudy, setActiveCaseStudy] = useState<CaseStudyRecord | null>(featuredCaseStudies?.[0] ?? caseStudies[0] ?? null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [filters, setFilters] = useState<CaseStudyFilters>({
		products: defaultFilters?.products ?? [],
		regions: defaultFilters?.regions ?? [],
		industries: defaultFilters?.industries ?? [],
		query: defaultFilters?.query ?? "",
	});

	const deferredQuery = useDeferredValue(filters.query);
	const filterOptions = useMemo(() => collectFilterOptions(caseStudies), [caseStudies]);
	const effectiveFilters = useMemo(() => ({ ...filters, query: deferredQuery }), [deferredQuery, filters]);
	const filteredCaseStudies = useMemo(
		() => sortCaseStudiesForDisplay(
			caseStudies.filter((caseStudy) => matchesCaseStudyFilters(caseStudy, effectiveFilters)),
			effectiveFilters,
		),
		[caseStudies, effectiveFilters],
	);
	const hasActiveFilters =
		filters.products.length > 0 ||
		filters.regions.length > 0 ||
		filters.industries.length > 0 ||
		filters.query.trim().length > 0;
	const displayCaseStudies = hasActiveFilters ? filteredCaseStudies : featuredCaseStudies?.length ? featuredCaseStudies : caseStudies;
	const modalCaseStudies = hasActiveFilters ? filteredCaseStudies : caseStudies;

	useEffect(() => {
		if (!activeCaseStudy && displayCaseStudies.length > 0) {
			setActiveCaseStudy(displayCaseStudies[0]);
		}
	}, [activeCaseStudy, displayCaseStudies]);

	if (caseStudies.length === 0) {
		return null;
	}

	const resultLabel = hasActiveFilters
		? `${filteredCaseStudies.length} matching ${filteredCaseStudies.length === 1 ? "study" : "studies"}`
		: `${displayCaseStudies.length} featured ${displayCaseStudies.length === 1 ? "study" : "studies"}`;

	const resetFilters = () => {
		setFilters({
			products: [],
			regions: [],
			industries: [],
			query: "",
		});
	};

	const handlePreview = (caseStudy: CaseStudyRecord) => {
		setActiveCaseStudy(caseStudy);
		setIsDialogOpen(true);
	};

	return (
		<>
			<section className="space-y-5">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div className="max-w-3xl space-y-2">
						<Badge variant="outline" className="rounded-full border-primary/25 bg-background/80 px-3 py-1">
							Showcase
						</Badge>
						<div className="space-y-2">
							<h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2>
							<p className="text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
						</div>
					</div>
					<p className="text-sm text-muted-foreground">
						Images, summaries, and PDF links can be added directly in `case-studies.ts`.
					</p>
				</div>

				<div className="rounded-[2rem] border border-border/70 bg-card/90 p-4 sm:p-5">
					<div className="grid gap-4">
						<div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_auto] lg:items-end">
							<div className="space-y-3">
								<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
									<SlidersHorizontal className="h-4 w-4" />
									Filters
								</div>
								<div className="relative">
									<Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										value={filters.query}
										onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
										placeholder="Search case study names"
										aria-label="Search case study names"
										className="rounded-full pl-11"
									/>
								</div>
							</div>
							<div className="flex flex-wrap items-center gap-3 lg:justify-end">
								<Badge variant="outline" className="rounded-full border-border/70 bg-background/80 px-3 py-1.5">
									{resultLabel}
								</Badge>
								{hasActiveFilters ? (
									<Button type="button" variant="outline" className="rounded-full" onClick={resetFilters}>
										Clear filters
									</Button>
								) : null}
							</div>
						</div>

						<div className="grid gap-4">
							<FilterGroup
								label="Products"
								values={filterOptions.products}
								selected={filters.products}
								onToggle={(value) => setFilters((current) => ({ ...current, products: toggleValue(current.products, value) }))}
							/>
							<FilterGroup
								label="Regions"
								values={filterOptions.regions}
								selected={filters.regions}
								onToggle={(value) => setFilters((current) => ({ ...current, regions: toggleValue(current.regions, value) }))}
							/>
							<FilterGroup
								label="Industries"
								values={filterOptions.industries}
								selected={filters.industries}
								onToggle={(value) => setFilters((current) => ({ ...current, industries: toggleValue(current.industries, value) }))}
							/>
						</div>
					</div>
				</div>

				{displayCaseStudies.length === 0 ? (
					<EmptyState onReset={resetFilters} />
				) : (
					<RailShell label="Case study results" railRef={railRef} layout={layout}>
						<div aria-hidden className="w-px shrink-0 xl:hidden" />
						<AnimatePresence initial={false} mode="popLayout">
							{displayCaseStudies.map((caseStudy, index) => (
								<motion.div
									key={caseStudy.id}
									layout
									initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
									animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
									exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -18, scale: 0.98 }}
									transition={
										prefersReducedMotion
											? { duration: 0 }
											: { duration: 0.24, delay: index * 0.02, ease: EASE_OUT_QUINT }
									}
									className={cn(
										"w-[85vw] shrink-0 snap-start sm:w-[26rem] xl:w-[30rem]",
										layout === "grid-auto" && "xl:w-auto xl:shrink xl:snap-none",
									)}
								>
									<CaseStudyCard
										caseStudy={caseStudy}
										onPreview={handlePreview}
										prefersReducedMotion={prefersReducedMotion}
									/>
								</motion.div>
							))}
						</AnimatePresence>
						<div aria-hidden className="w-5 shrink-0 xl:hidden" />
					</RailShell>
				)}
			</section>

			<CaseStudyPreviewDialog
				caseStudies={modalCaseStudies}
				activeCaseStudy={activeCaseStudy}
				open={isDialogOpen}
				onOpenChange={setIsDialogOpen}
				onSelect={setActiveCaseStudy}
			/>
		</>
	);
}
