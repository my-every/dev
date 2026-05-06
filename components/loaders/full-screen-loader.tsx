"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const statusMessages = [
  "Importing prioritized projects…",
  "Reading schedule data…",
  "Scanning project folders…",
  "Matching layouts and wire lists…",
  "Loading shift roster…",
  "Restoring assignment progress…",
  "Building project board…",
];

interface FullScreenLoaderProps {
  className?: string;
  messages?: string[];
  messageInterval?: number;
  labels?: string[];
  title?: string;
  description?: string;
  isExiting?: boolean;
  onExitComplete?: () => void;
}

const defaultLabels = [
  "Projects",
  "Schedules",
  "Folders",
  "Layouts",
  "Shifts",
  "Progress",
  "Boards",
  "Tasks",
  "Teams",
  "Data",
];

export function FullScreenLoader({
  className,
  messages = statusMessages,
  messageInterval = 2000,
  labels = defaultLabels,
  title,
  description,
  isExiting = false,
  onExitComplete,
}: FullScreenLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
  const timer = setTimeout(() => setHasEntered(true), 100);
  return () => clearTimeout(timer);
  }, []);
  
  // Trigger onExitComplete after exit animations finish
  useEffect(() => {
    if (isExiting && onExitComplete) {
      // Total exit animation time: 1.3s (1.2s morphing backdrop + 0.1s buffer)
      const timer = setTimeout(() => {
        onExitComplete();
      }, 1300);
      return () => clearTimeout(timer);
    }
  }, [isExiting, onExitComplete]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, messageInterval);

    return () => clearInterval(interval);
  }, [messages.length, messageInterval]);

  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      });
    }
  }, []);

  useEffect(() => {
    updateDimensions();
    const resizeObserver = new ResizeObserver(() =>
      requestAnimationFrame(updateDimensions)
    );
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [updateDimensions]);

  // Topics positioned closer to center (less spacing)
  const topicPositions = [
    { x: 25, y: 28 },
    { x: 75, y: 24 },
    { x: 20, y: 50 },
    { x: 80, y: 50 },
    { x: 25, y: 72 },
    { x: 75, y: 76 },
    { x: 38, y: 18 },
    { x: 62, y: 16 },
    { x: 35, y: 84 },
    { x: 65, y: 82 },
  ];

  const topics = topicPositions.map((position, index) => ({
    id: String(index + 1),
    position,
    color: "#EDBA3A",
    label: labels[index] || `Item ${index + 1}`,
  }));

  const getPathData = useCallback(
    (position: { x: number; y: number }) => {
      if (!dimensions.width || !dimensions.height) return "";

      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const x = (position.x / 100) * dimensions.width;
      const y = (position.y / 100) * dimensions.height;

      const controlX =
        position.x < 50 ? x + (centerX - x) * 0.6 : x - (x - centerX) * 0.6;

      return `M ${x} ${y} Q ${controlX} ${y} ${centerX} ${centerY}`;
    },
    [dimensions]
  );

  const generateParticles = useCallback(
    (topic: { id: string; position: { x: number; y: number }; color: string; label: string }, index: number) => {
      const pathData = getPathData(topic.position);
      const eggWidth = 16;
      const eggHeight = 10;

      return (
        <motion.g key={`particle-${topic.id}`}>
          <motion.path
            d={`M -${eggWidth / 2} 0 
             a ${eggWidth / 2} ${eggHeight / 2} 0 1 0 ${eggWidth} 0 
             a ${eggWidth / 2} ${eggHeight / 2} 0 1 0 -${eggWidth} 0`}
            fill={topic.color}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: [0, 0.8, 0],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              repeatDelay: 1 + index * 0.3,
              times: [0, 0.5, 1],
            }}
          >
            <animateMotion
              dur={`${3 + index * 0.2}s`}
              repeatCount="indefinite"
              path={pathData}
              rotate="auto"
              calcMode="spline"
              keyPoints="0;1"
              keyTimes="0;1"
              keySplines="0.42 0 0.58 1"
            />
          </motion.path>
        </motion.g>
      );
    },
    [getPathData]
  );

  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {!isExiting ? (
        <motion.div
          ref={containerRef}
          className={cn(
            "min-h-screen w-full bg-[#020617] relative flex items-center justify-center overflow-hidden",
            className
          )}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          {/* Dark Radial Glow Background */}
          <div
            className="absolute inset-0 z-0"
            style={{
              backgroundImage: `radial-gradient(circle 500px at 50% 50%, #3e3e3e, transparent)`,
            }}
          />

          {/* Radial Flow SVG */}
          {dimensions.width > 0 && (
            <svg
              className="absolute inset-0 w-full h-full z-10"
              viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            >
              <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Path lines from edges to center with staggered entry */}
              {topics.map((topic, index) => {
                const x = (topic.position.x / 100) * dimensions.width;
                const y = (topic.position.y / 100) * dimensions.height;
                const isLeftSide = topic.position.x < 50;
                
                return (
                  <motion.g 
                    key={`path-group-${topic.id}`}
                    initial={{ opacity: 0, pathLength: 0 }}
                    animate={hasEntered ? { opacity: 1, pathLength: 1 } : {}}
                    transition={{ 
                      duration: 0.6, 
                      delay: index * 0.1,
                      ease: "easeOut"
                    }}
                  >
                    <motion.path
                      d={getPathData(topic.position)}
                      stroke={topic.color}
                      strokeWidth="1"
                      strokeOpacity={0.3}
                      fill="none"
                      initial={{ pathLength: 0 }}
                      animate={hasEntered ? { pathLength: 1 } : {}}
                      transition={{ 
                        duration: 0.8, 
                        delay: index * 0.1,
                        ease: "easeOut"
                      }}
                    />
                    {/* Badge label at the end of each line */}
                    <motion.g
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={hasEntered ? { opacity: 1, scale: 1 } : {}}
                      transition={{ 
                        duration: 0.5, 
                        delay: index * 0.1 + 0.3,
                        ease: [0.34, 1.56, 0.64, 1]
                      }}
                    >
                      <rect
                        x={isLeftSide ? x - 80 : x + 8}
                        y={y - 14}
                        width="72"
                        height="28"
                        rx="14"
                        fill="#EDBA3A"
                      />
                      <text
                        x={isLeftSide ? x - 44 : x + 44}
                        y={y + 5}
                        fill="black"
                        fontSize="13"
                        fontWeight="700"
                        fontFamily="system-ui, sans-serif"
                        textAnchor="middle"
                      >
                        {topic.label}
                      </text>
                    </motion.g>
                  </motion.g>
                );
              })}

              {/* Animated particles flowing to center */}
              {topics.map((topic, index) => generateParticles(topic, index))}
            </svg>
          )}

          {/* Centered Content */}
          <div className="relative z-20 flex flex-col items-center gap-8">
            {/* Pulsing glow ring around logo */}
            <div className="relative">
              <motion.div
                className="absolute inset-0 rounded-[20%]"
                style={{
                  background: "#EDBA3A",
                  opacity: 0.2,
                }}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.2, 0.1, 0.2],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="absolute -inset-4 rounded-[20%]"
                style={{
                  border: "4px solid #EDBA3A",
                  opacity: 0.2,
                }}
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.2, 0.05, 0.2],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.3,
                }}
              />
              {/* D380 Logo with bounce/pulse animation */}
              <motion.div 
                className="w-24 h-24 md:w-32 md:h-32 relative"
                animate={{
                  scale: [1, 1.04, 1],
                  y: [0, -3, 0],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <D380Text className="w-full h-full drop-shadow-2xl" />
              </motion.div>
            </div>

            <div className="flex max-w-xl flex-col items-center gap-3 px-4 text-center">
              {title ? (
                <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  {title}
                </h1>
              ) : null}
              {description ? (
                <p className="max-w-lg text-sm text-slate-400 md:text-base">
                  {description}
                </p>
              ) : null}

              {/* Status Message */}
              <div className="h-6 flex items-center justify-center">
                <p
                  key={messageIndex}
                  className="text-sm md:text-base text-slate-300 animate-fade-in text-center px-4"
                >
                  {messages[messageIndex]}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar - positioned at bottom center, loads once to 100% synced with exit */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20">
            <div className="flex items-center box-border p-[5px] w-[200px] h-[30px] bg-[#212121] shadow-[inset_-2px_2px_4px_#0c0c0c] rounded-[15px]">
              {/* Loading bar - 8 seconds to fill, matching the demo exit timer */}
              <div 
                className="progress-bar-fill relative flex justify-center flex-col h-[20px] overflow-hidden rounded-[10px] bg-gradient-to-t from-[#c99a10] to-[#EDBA3A]"
              >
                {/* Striped overlay */}
                <div className="absolute flex items-center gap-[18px] animate-stripe-slide">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-[10px] h-[45px] opacity-30 rotate-45 bg-gradient-to-tr from-white to-transparent"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Inline Styles for Custom Animations */}
          <style jsx>{`
            @keyframes fade-in {
              0% {
                opacity: 0;
                transform: translateY(4px);
              }
              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }

            .animate-fade-in {
              animation: fade-in 0.4s ease-out forwards;
            }

            @keyframes path-draw {
              0%, 100% {
                stroke-dashoffset: 1000;
                fill-opacity: 0.7;
              }
              50% {
                stroke-dashoffset: 0;
                fill-opacity: 1;
              }
            }

            .animate-path-draw {
              animation: path-draw 3s ease-in-out infinite;
            }

            .animate-path-draw-delayed-1 {
              animation: path-draw 3s ease-in-out infinite;
              animation-delay: 0.15s;
            }

            .animate-path-draw-delayed-2 {
              animation: path-draw 3s ease-in-out infinite;
              animation-delay: 0.3s;
            }

            .animate-path-draw-delayed-3 {
              animation: path-draw 3s ease-in-out infinite;
              animation-delay: 0.45s;
            }

            .animate-path-draw-delayed-4 {
              animation: path-draw 3s ease-in-out infinite;
              animation-delay: 0.6s;
            }

            @keyframes loading-bar-once {
              0% {
                width: 0%;
              }
              95% {
                width: 100%;
              }
              100% {
                width: 100%;
              }
            }

            .progress-bar-fill {
              width: 0%;
              animation: loading-bar-once 8s ease-out forwards;
            }

            @keyframes stripe-slide {
              0% {
                transform: translateX(-20px);
              }
              100% {
                transform: translateX(0px);
              }
            }

            .animate-stripe-slide {
              animation: stripe-slide 0.5s linear infinite;
            }
          `}</style>
        </motion.div>
      ) : (
        <motion.div
          ref={containerRef}
          className={cn(
            "min-h-screen w-full bg-[#020617] relative flex items-center justify-center overflow-hidden",
            className
          )}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut", delay: 1 }}
        >
          {/* Dark Radial Glow Background morphing */}
          <motion.div
            className="absolute inset-0 z-0"
            initial={{
              backgroundImage: `radial-gradient(circle 500px at 50% 50%, #3e3e3e, transparent)`,
            }}
            animate={{
              backgroundImage: `radial-gradient(circle 100px at 50% 50%, #EDBA3A, transparent)`,
            }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />

          {/* Radial Flow SVG - lines merging to center */}
          {dimensions.width > 0 && (
            <svg
              className="absolute inset-0 w-full h-full z-10"
              viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            >
              {/* Path lines merging to center */}
              {topics.map((topic, index) => {
                const x = (topic.position.x / 100) * dimensions.width;
                const y = (topic.position.y / 100) * dimensions.height;
                const isLeftSide = topic.position.x < 50;
                
                return (
                  <motion.g 
                    key={`path-group-exit-${topic.id}`}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ 
                      duration: 0.5, 
                      delay: (topics.length - index - 1) * 0.05,
                      ease: "easeIn"
                    }}
                  >
                    <motion.path
                      d={getPathData(topic.position)}
                      stroke={topic.color}
                      strokeWidth="1"
                      strokeOpacity={0.3}
                      fill="none"
                      initial={{ pathLength: 1 }}
                      animate={{ pathLength: 0 }}
                      transition={{ 
                        duration: 0.6, 
                        delay: (topics.length - index - 1) * 0.05,
                        ease: "easeIn"
                      }}
                    />
                    {/* Badge label moving to center */}
                    <motion.g
                      initial={{ 
                        x: 0, 
                        y: 0,
                        opacity: 1, 
                        scale: 1 
                      }}
                      animate={{ 
                        x: centerX - (isLeftSide ? x - 44 : x + 44),
                        y: centerY - y,
                        opacity: 0, 
                        scale: 0.3 
                      }}
                      transition={{ 
                        duration: 0.6, 
                        delay: (topics.length - index - 1) * 0.05,
                        ease: "easeIn"
                      }}
                    >
                      <rect
                        x={isLeftSide ? x - 80 : x + 8}
                        y={y - 14}
                        width="72"
                        height="28"
                        rx="14"
                        fill="#EDBA3A"
                      />
                      <text
                        x={isLeftSide ? x - 44 : x + 44}
                        y={y + 5}
                        fill="black"
                        fontSize="13"
                        fontWeight="700"
                        fontFamily="system-ui, sans-serif"
                        textAnchor="middle"
                      >
                        {topic.label}
                      </text>
                    </motion.g>
                  </motion.g>
                );
              })}
            </svg>
          )}

          {/* Centered Content expanding */}
          <div className="relative z-20 flex flex-col items-center gap-8">
            {/* Morphing backdrop glow */}
            <motion.div
              className="absolute rounded-[20%]"
              style={{
                background: "#EDBA3A",
                width: 128,
                height: 128,
              }}
              initial={{ scale: 1, opacity: 0.2 }}
              animate={{ 
                scale: 20, 
                opacity: 0.3,
                borderRadius: "0%"
              }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
            />
            
            {/* D380 Logo */}
            <motion.div 
              className="w-24 h-24 md:w-32 md:h-32 relative"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeInOut", delay: 0.5 }}
            >
              <D380Text className="w-full h-full drop-shadow-2xl" />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function D380Text({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1000 1000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Yellow rounded background */}
      <rect width="1000" height="1000" rx="150" fill="#EDBA3A" />
      
      {/* D - with stroke animation */}
      <path
        d="M160.401 400.245L160.749 400.238C206.272 399.568 252.403 400.56 297.857 400.221C322.575 400.475 361.996 406.686 360.773 439.241C360.217 454.03 351.474 473.386 346.43 487.693C341.957 500.383 336.641 517.756 330.612 529.171C326.381 537.078 320.983 544.301 314.601 550.597C288.455 576.884 250.62 588.363 214.45 590.354C203.394 590.962 190.19 590.662 179.002 590.65L125 590.636L175.552 449.156L233.33 449.14C221.736 482.174 209.814 515.092 197.564 547.888C221.296 547.956 252.263 550.664 269.535 531.016C272.236 527.924 274.468 524.451 276.161 520.708C277.009 518.851 278.772 514.555 279.219 512.678C283.317 495.484 299.814 465.756 298.753 449.281C293.631 441.147 284.641 440.371 275.635 440.021C265.528 439.629 255.206 439.926 245.067 439.922L180.695 439.987C176.106 429.083 166.172 411.249 160.401 400.245Z"
        fill="black"
        stroke="black"
        strokeWidth="2"
        className="animate-path-draw"
        style={{
          strokeDasharray: 1000,
          strokeDashoffset: 0,
        }}
      />
      
      {/* 3 - outer */}
      <path
        d="M576.857 418.087C582.589 417.319 605.113 417.784 612.252 417.798C630.13 418.362 649.366 416.782 667.063 418.449C691.206 421.517 696.463 432.231 688.592 453.898C678.634 481.324 677.64 487.426 647.759 493.46C671.57 498.088 669.432 506.318 663.231 526.497C653.792 557.246 641.858 565.979 609.382 569.474C602.95 570.35 578.645 570.579 571.65 569.917C548.564 567.731 479.846 580.89 494.084 538.43C503.186 511.275 506.449 497.722 536.655 493.595C531.729 492.483 525.253 491.163 521.32 487.991C518.857 486.01 517.326 483.09 517.107 479.934C516.613 473.645 519.689 469.336 521.258 463.733C529.716 433.49 544.113 420.921 576.857 418.087Z"
        fill="black"
        stroke="black"
        strokeWidth="2"
        className="animate-path-draw-delayed-1"
        style={{
          strokeDasharray: 800,
          strokeDashoffset: 0,
        }}
      />
      {/* 3 - inner bottom */}
      <path
        d="M564.817 508.084C578.207 508.01 591.81 507.822 605.2 507.992C613.158 508.093 617.922 509.978 614.671 518.784C610.645 529.689 611.427 534.139 599.018 537.337C590.541 537.644 551.452 539.991 547.938 533.199C547.351 528.829 552.446 517.288 554.515 513.027C558.078 510.27 560.547 509.262 564.817 508.084Z"
        fill="#EDBA3A"
      />
      {/* 3 - inner top */}
      <path
        d="M587.009 450.575C596.461 450.324 606.082 450.532 615.552 450.416C620.891 450.35 632.781 449.492 636.007 454.32C636.551 459.035 631.868 469.629 629.662 474.069C626.23 476.594 624.035 477.33 620.028 478.589C607.082 478.683 584.227 479.78 572.45 477.353C567.355 476.304 570.068 453.181 587.009 450.575Z"
        fill="#EDBA3A"
      />
      
      {/* 8 - outer */}
      <path
        d="M376.224 417.841L449.843 417.794C456.683 417.793 463.691 417.862 470.659 417.796C493.946 417.579 526.859 417.443 514.132 450.681C503.311 478.939 505.805 485.917 472.999 493.398C497.872 498.121 492.883 511.597 485.426 529.552C483.435 534.337 482.352 539.563 479.858 544.326C463.997 574.615 420.276 569.929 391.428 569.902L318.142 569.827C314.241 569.837 310.237 569.735 306.327 569.683C319.293 561.84 331.388 550.867 338.892 537.587C353.293 537.312 421.768 539.413 428.776 535.34C434.743 531.872 438.018 521.748 439.289 515.281C439.735 513.011 439.347 512.117 438.175 510.297C432.35 506.48 389.109 508.028 379.494 508.06C383.229 500.224 387.658 487.316 390.871 478.736C402.693 478.583 440.332 480.555 448.862 476.87C455.512 473.998 456.993 467.597 459.343 461.365C460.377 458.624 461.457 456.341 460.175 453.522C453.892 449.157 431.99 450.504 423.751 450.512L371.845 450.529C376.64 439.878 376.302 429.186 376.224 417.841Z"
        fill="black"
        stroke="black"
        strokeWidth="2"
        className="animate-path-draw-delayed-2"
        style={{
          strokeDasharray: 900,
          strokeDashoffset: 0,
        }}
      />
      
      {/* 0 - outer */}
      <path
        d="M752.925 418.076C760.407 417.194 786.838 417.79 795.327 417.784L827.634 417.782C890.128 417.824 879.169 439.618 860.072 487.57C844.031 527.862 845.731 563.006 794.095 569.129C783.643 570.414 771.06 569.838 760.364 569.895C741.26 569.71 721.906 570.326 702.827 569.664C691.737 569.28 675.271 566.191 671.101 554.282C669.87 550.88 669.457 544.331 670.633 540.933C681.622 509.511 692.4 477.852 703.989 446.649C711.003 427.759 734.633 419.751 752.925 418.076Z"
        fill="black"
        stroke="black"
        strokeWidth="2"
        className="animate-path-draw-delayed-3"
        style={{
          strokeDasharray: 700,
          strokeDashoffset: 0,
        }}
      />
      {/* 0 - inner */}
      <path
        d="M764.127 450.59C779.23 450.544 800.672 449.269 815.719 452.109C818.825 453.316 819.126 457.559 818.25 459.956C809.642 483.616 801.866 507.923 792.101 531.082C790.595 534.653 784.662 536.522 781.28 537.341C772.235 537.477 734.421 539.336 728.332 535.904C726.988 535.143 726.194 534.021 725.925 532.468C725.663 530.959 725.863 529.358 726.275 527.896C728.626 519.597 749.818 460.25 752.856 456.291C755.844 452.395 759.545 451.383 764.127 450.59Z"
        fill="#EDBA3A"
      />
      
      {/* Bottom Bar */}
      <path
        d="M284.941 581.262L824.827 581.28C822.289 587.421 819.544 593.628 816.913 599.743C802.566 600.234 786.25 599.869 771.753 599.879L228.002 599.778C246.343 596.612 268.325 589.681 284.941 581.262Z"
        fill="black"
        stroke="black"
        strokeWidth="2"
        className="animate-path-draw-delayed-4"
        style={{
          strokeDasharray: 600,
          strokeDashoffset: 0,
        }}
      />
    </svg>
  );
}

export default FullScreenLoader;
