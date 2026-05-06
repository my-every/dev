"use client";

import { CheckCircle2, Clock3 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export type ProjectExportIllustrationStatus = "ready" | "pending";

interface ProjectExportIllustrationProps {
  status?: ProjectExportIllustrationStatus;
}

const pageMotion = [
  {
    initial: { rotate: -4, x: -16, y: 2 },
    hover: { rotate: -10, x: -38, y: -44 },
    transition: { type: "spring" as const, stiffness: 180, damping: 22 },
    className: "z-10",
  },
  {
    initial: { rotate: 0, x: 0, y: 0 },
    hover: { rotate: 1, x: 2, y: -58 },
    transition: { type: "spring" as const, stiffness: 205, damping: 24 },
    className: "z-20",
  },
  {
    initial: { rotate: 4, x: 16, y: 1 },
    hover: { rotate: 9, x: 38, y: -46 },
    transition: { type: "spring" as const, stiffness: 185, damping: 21 },
    className: "z-10",
  },
];

function ProjectExportIllustration({ status = "pending" }: ProjectExportIllustrationProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="flex w-full items-center justify-center">
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative h-52 w-80"
      >
        <div className="absolute right-2 top-2 z-40">
          {status === "ready" ? (
            <motion.div
              initial={{ scale: 0.92, opacity: 0.85 }}
              animate={{ scale: [0.94, 1, 0.94], opacity: 1 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100/95 px-2 py-1 text-[11px] font-semibold text-emerald-800 shadow-sm"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ready
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0.9 }}
              animate={{ opacity: [0.75, 1, 0.75] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/95 px-2 py-1 text-[11px] font-semibold text-amber-800 shadow-sm"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
                className="inline-flex"
              >
                <Clock3 className="h-3.5 w-3.5" />
              </motion.span>
              Pending
            </motion.div>
          )}
        </div>

        <div className="absolute inset-x-0 top-8 bottom-4 flex justify-center">
          {pageMotion.map((page, index) => (
            <motion.div
              key={index}
              initial={page.initial}
              animate={isHovered ? page.hover : page.initial}
              transition={page.transition}
              className={`absolute top-2 h-fit w-32 rounded-xl shadow-md ${page.className}`}
            >
              <Page />
            </motion.div>
          ))}
        </div>

        <motion.div
          animate={{ rotateX: isHovered ? -28 : 0 }}
          transition={{ type: "spring", stiffness: 230, damping: 25 }}
          className="absolute bottom-1 left-4 right-4 z-30 h-36 origin-bottom rounded-2xl border border-[#e3ba4a] bg-gradient-to-b from-[#f8d86f] via-[#f1c759] to-[#e8b645] shadow-[0_10px_25px_-8px_rgba(112,84,15,0.45)]"
        >
          <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.45),transparent_55%)]" />
        </motion.div>

        <div className="absolute left-3 top-[54px] z-20 h-6 w-28 rounded-t-xl border border-[#e8c25d] border-b-0 bg-gradient-to-b from-[#ffe48b] to-[#f5cd61] shadow-sm" />
      </div>
    </div>
  );
}

const Page = () => (
  <div className="h-full w-full rounded-xl border border-[#d9d6e6] bg-gradient-to-b from-[#f1effa] to-[#e4e1f0] p-3 shadow-lg">
    <div className="flex flex-col gap-1.5">
      <div className="h-1 w-full rounded-full bg-[#cfcde0]" />
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex gap-1.5">
          <div className="h-1 flex-1 rounded-full bg-[#cfcde0]" />
          <div className="h-1 flex-1 rounded-full bg-[#cfcde0]" />
        </div>
      ))}
    </div>
  </div>
);

export default ProjectExportIllustration;
