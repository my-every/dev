"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import { CalendarIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Rectangle,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  parseFilterDateString,
  toFilterDateString,
} from "@/components/projects/project-schedule-slots-filters";
import {
  buildMetrics,
  buildOverviewBarData,
  getLwcTabLabel,
  getOverviewStatCards,
  LWC_TABS,
} from "@/components/projects/project-schedule-slots-metrics";
import type {
  LwcMetricSet,
  LwcTabValue,
} from "@/components/projects/project-schedule-slots-types";

interface ProjectScheduleDateRangeFilterProps {
  dueDateFrom: string;
  dueDateTo: string;
  onChangeDueDateFrom: (value: string) => void;
  onChangeDueDateTo: (value: string) => void;
}

export function ProjectScheduleDateRangeFilter({
  dueDateFrom,
  dueDateTo,
  onChangeDueDateFrom,
  onChangeDueDateTo,
}: ProjectScheduleDateRangeFilterProps) {
  const fromDate = parseFilterDateString(dueDateFrom);
  const toDate = parseFilterDateString(dueDateTo);

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-9 w-41 justify-start text-left text-xs font-normal",
              !fromDate && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {fromDate ? format(fromDate, "MMM d, yyyy") : "From date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={fromDate}
            onSelect={(value) => onChangeDueDateFrom(toFilterDateString(value))}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-9 w-41 justify-start text-left text-xs font-normal",
              !toDate && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {toDate ? format(toDate, "MMM d, yyyy") : "To date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={toDate}
            onSelect={(value) => onChangeDueDateTo(toFilterDateString(value))}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface ProjectScheduleOverviewBarChartSwitcherProps {
  activeLwcTab: LwcTabValue;
  onLwcTabChange: (tab: LwcTabValue) => void;
  metricsByLwc: Record<string, LwcMetricSet>;
  dateRangeLabel: string;
}

export function ProjectScheduleOverviewBarChartSwitcher({
  activeLwcTab,
  onLwcTabChange,
  metricsByLwc,
  dateRangeLabel,
}: ProjectScheduleOverviewBarChartSwitcherProps) {
  const activeMetrics = metricsByLwc[activeLwcTab] ?? buildMetrics([]);
  void activeMetrics;
  const statCards = useMemo(
    () => getOverviewStatCards(activeLwcTab, metricsByLwc),
    [activeLwcTab, metricsByLwc],
  );
  const chartData = useMemo(
    () => buildOverviewBarData(activeLwcTab, metricsByLwc),
    [activeLwcTab, metricsByLwc],
  );

  return (
    <div className="space-y-3">
      <Tabs
        value={activeLwcTab}
        onValueChange={(value) => onLwcTabChange(value as LwcTabValue)}
        className="gap-2"
      >
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/40 p-1.5">
          {LWC_TABS.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="h-8 rounded-lg px-3 text-xs"
            >
              {getLwcTabLabel(tab)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border bg-muted/20 p-2 sm:p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-muted-foreground">
              Queue Overview: {getLwcTabLabel(activeLwcTab)} | {dateRangeLabel}
            </div>
            <Badge variant="outline" className="text-[10px]">
              {activeLwcTab === "ALL" ? "Projects by LWC" : `${getLwcTabLabel(activeLwcTab)} Metrics`}
            </Badge>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <pattern
                    id="chart-hover-stripes"
                    patternUnits="userSpaceOnUse"
                    width="8"
                    height="8"
                    patternTransform="rotate(45)"
                  >
                    <rect width="8" height="8" fill="hsl(var(--muted) / 0.3)" />
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="8"
                      stroke="hsl(var(--muted-foreground) / 0.22)"
                      strokeWidth="3"
                    />
                  </pattern>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <RechartsTooltip
                  cursor={
                    <Rectangle
                      fill="url(#chart-hover-stripes)"
                      radius={12}
                      className="rounded-xl"
                    />
                  }
                  formatter={(value: number | string) => [Number(value).toLocaleString(), "Value"]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-2">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-lg border bg-muted/30 p-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {card.label}
              </div>
              <div className={cn("text-3xl font-bold tabular-nums", card.valueClassName)}>
                {card.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
