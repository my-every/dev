"use client";

import { useState, type CSSProperties } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BoxSideConfig } from "@/boxSide";

// JB70 assignments from layout-unit-box-panel-reference.json
const JB70_ASSIGNMENTS = [
  { name: "PLC", side: "topBackSide", swsType: "UNDECIDED" },
  { name: "CONTROL A", side: "leftBackSide", swsType: "UNDECIDED" },
  { name: "CONTROL B", side: "rightBackSide", swsType: "UNDECIDED" },
  { name: "TURBINE PANEL B", side: "rightBackSide", swsType: "PANEL" },
  { name: "FIRE SYS DOOR PANEL", side: "leftDoor", swsType: "PANEL" },
  { name: "PANEL A", side: "leftBackSide", swsType: "PANEL" },
  { name: "PANEL B", side: "rightBackSide", swsType: "PANEL" },
  { name: "PLC PANEL", side: "topBackSide", swsType: "PANEL" },
  { name: "VIBRATION PANEL", side: "leftSide", swsType: "PANEL" },
];

const SIDE_ORDER = [
  "leftDoor",
  "topBackSide",
  "rightDoor",
  "leftSide",
  "leftBackSide",
  "rightBackSide",
  "rightSide",
] as const;

type BoxSideKey = (typeof SIDE_ORDER)[number];

type SideZone = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const SIDE_ZONES: Record<BoxSideKey, SideZone> = {
  leftDoor: { left: 24, top: 20, width: 22, height: 16 },
  topBackSide: { left: 47, top: 20, width: 22, height: 16 },
  rightDoor: { left: 70, top: 20, width: 22, height: 16 },
  leftSide: { left: 24, top: 38, width: 22, height: 18 },
  leftBackSide: { left: 47, top: 38, width: 22, height: 18 },
  rightBackSide: { left: 70, top: 38, width: 22, height: 18 },
  rightSide: { left: 70, top: 58, width: 22, height: 16 },
};

const SIDE_SURFACE_TRANSFORMS: Record<BoxSideKey, CSSProperties> = {
  leftDoor: {
    transform: "perspective(900px) rotateY(-22deg) rotateX(8deg)",
    transformOrigin: "right center",
  },
  topBackSide: {
    transform: "perspective(900px) rotateX(38deg)",
    transformOrigin: "center bottom",
  },
  rightDoor: {
    transform: "perspective(900px) rotateY(22deg) rotateX(8deg)",
    transformOrigin: "left center",
  },
  leftSide: {
    transform: "perspective(900px) rotateY(-30deg) rotateX(10deg)",
    transformOrigin: "right center",
  },
  leftBackSide: {
    transform: "perspective(900px) rotateX(22deg)",
    transformOrigin: "center top",
  },
  rightBackSide: {
    transform: "perspective(900px) rotateX(22deg) rotateY(10deg)",
    transformOrigin: "left top",
  },
  rightSide: {
    transform: "perspective(900px) rotateY(30deg) rotateX(10deg)",
    transformOrigin: "left center",
  },
};

const SIDE_CARD_TRANSFORMS: Record<BoxSideKey, CSSProperties> = {
  leftDoor: { transform: "rotateY(-12deg)" },
  topBackSide: { transform: "rotateX(14deg)" },
  rightDoor: { transform: "rotateY(12deg)" },
  leftSide: { transform: "rotateY(-16deg) rotateX(6deg)" },
  leftBackSide: { transform: "rotateX(10deg)" },
  rightBackSide: { transform: "rotateY(10deg) rotateX(8deg)" },
  rightSide: { transform: "rotateY(16deg) rotateX(6deg)" },
};

const JB70_SVG_VIEWBOX_WIDTH = 733;
const JB70_SVG_VIEWBOX_HEIGHT = 877;

function SimpleJb70Svg() {
  return (
    <svg
      className="w-full h-auto"
      viewBox="0 0 733 877"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden="true"
    >
      <rect height="877" width="733" fill="#0f172a" fillOpacity="0.12" />
      <rect
        height="576"
        width="190"
        fill="#f8fafc"
        transform="translate(175 164)"
      />
      <rect
        height="576"
        width="190"
        fill="#f8fafc"
        transform="translate(366 164)"
      />
      <rect
        height="61"
        width="387"
        fill="#e2e8f0"
        transform="translate(173 101)"
      />
      <path
        d="M171 743.977L144 780.999L144 79.5963L171 101.109L171 743.977Z"
        fill="#cbd5e1"
      />
      <path
        d="M559 744.999L585.999 782V81L559 102.5L559 744.999Z"
        fill="#cbd5e1"
      />
      <path
        d="M25 846.123L143.244 787L143.244 80.6373L25 41.0007L25 846.123Z"
        fill="#94a3b8"
      />
      <path
        d="M706.244 850.234L588 787V80L706.244 23V850.234Z"
        fill="#94a3b8"
      />
    </svg>
  );
}

export default function BoxLayoutDemo() {
  const [assignments, setAssignments] = useState(JB70_ASSIGNMENTS);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, item: string) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetSide: BoxSideKey) => {
    e.preventDefault();
    if (!draggedItem) return;

    setAssignments((prev) =>
      prev.map((a) =>
        a.name === draggedItem ? { ...a, side: targetSide } : a,
      ),
    );
    setDraggedItem(null);
  };

  const getAssignmentsForSide = (side: BoxSideKey) =>
    assignments.filter((a) => a.side === side);

  const getSideColor = (side: string): string => {
    const colors: Record<string, string> = {
      leftDoor: "bg-blue-50 border-blue-200",
      topBackSide: "bg-purple-50 border-purple-200",
      rightDoor: "bg-green-50 border-green-200",
      leftSide: "bg-yellow-50 border-yellow-200",
      leftBackSide: "bg-pink-50 border-pink-200",
      rightBackSide: "bg-cyan-50 border-cyan-200",
      rightSide: "bg-orange-50 border-orange-200",
    };
    return colors[side] || "bg-gray-50 border-gray-200";
  };

  const AssignmentCard = ({
    assignment,
    side,
  }: {
    assignment: (typeof JB70_ASSIGNMENTS)[0];
    side: BoxSideKey;
  }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, assignment.name)}
      className="p-2 bg-white/95 border border-slate-300 rounded-md cursor-move hover:shadow-md transition-all duration-300"
      style={SIDE_CARD_TRANSFORMS[side]}
    >
      <div className="font-semibold text-xs text-slate-900 leading-tight">
        {assignment.name}
      </div>
      <Badge variant="outline" className="mt-1 text-[10px]">
        {assignment.swsType}
      </Badge>
    </div>
  );

  const SideDropZone = ({ side }: { side: BoxSideKey }) => {
    const sideItems = getAssignmentsForSide(side);
    const config = BoxSideConfig[side];
    const zone = SIDE_ZONES[side];

    return (
      <div
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, side)}
        className="absolute"
        style={{
          left: `${zone.left}%`,
          top: `${zone.top}%`,
          width: `${zone.width}%`,
          height: `${zone.height}%`,
        }}
      >
        <div
          className={`w-full h-full rounded-lg p-2 border-2 shadow-sm overflow-auto ${getSideColor(side)} bg-white/80 backdrop-blur-[1px] transition-transform duration-300`}
          style={SIDE_SURFACE_TRANSFORMS[side]}
        >
          <div className="font-semibold text-[11px] text-slate-700 mb-1">
            {config?.name || side}
          </div>
          <div className="space-y-1.5">
            {sideItems.length > 0 ? (
              sideItems.map((item) => (
                <AssignmentCard key={item.name} assignment={item} side={side} />
              ))
            ) : (
              <div className="text-[10px] text-slate-400 italic">
                Drag assignments here
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">JB70 Box Layout Demo</h1>
        <p className="text-slate-600 mb-6">
          Drag assignments between side overlays mapped directly onto the JB70
          SVG.
        </p>

        <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg">
          <div
            className="relative mx-auto"
            style={{
              width: "100%",
              maxWidth: `${JB70_SVG_VIEWBOX_WIDTH}px`,
              aspectRatio: `${JB70_SVG_VIEWBOX_WIDTH} / ${JB70_SVG_VIEWBOX_HEIGHT}`,
            }}
          >
            <SimpleJb70Svg />

            {/* Center label block to anchor orientation for quick testing */}
            <div className="absolute left-[47%] top-[58%] w-[22%] h-[16%] border border-dashed border-slate-400 rounded-lg bg-slate-50/70 flex items-center justify-center">
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-700">JB70</div>
                <div className="text-xs text-slate-500 mt-1">
                  {assignments.length} assignments
                </div>
              </div>
            </div>

            {SIDE_ORDER.map((side) => (
              <SideDropZone key={side} side={side} />
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {SIDE_ORDER.map((side) => {
            const config = BoxSideConfig[side];
            const count = getAssignmentsForSide(side).length;
            return (
              <Card key={side}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{config.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {count}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">assignments</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
