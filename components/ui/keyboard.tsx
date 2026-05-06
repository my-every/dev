"use client";
const KeyboardUI = () => {
  return (
    <div className="w-[800px] max-w-4xl mx-auto px-2 sm:px-4">
      <div className="w-full flex flex-col gap-1 sm:gap-2 md:gap-3 select-none">
        {/* Row 1 */}
        <div className="flex w-full gap-0.5 sm:gap-1 md:gap-2 h-8 sm:h-10 md:h-12">
          {[
            "`",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "0",
            "-",
            "=",
          ].map((k) => (
            <div
              key={k}
              className="flex-1 bg-white rounded sm:rounded-md md:rounded-lg shadow-sm flex items-center justify-center text-neutral-900 text-xs sm:text-sm md:text-xl font-normal hover:bg-neutral-50 transition-colors cursor-default min-w-0"
            >
              <span className="truncate">{k}</span>
            </div>
          ))}
          <div className="flex-[1.6] bg-neutral-200/80 rounded sm:rounded-md md:rounded-lg flex items-center justify-end pr-1 sm:pr-2 md:pr-4 text-neutral-900 text-xs sm:text-sm md:text-lg font-normal hover:bg-neutral-300/80 transition-colors cursor-default">
            <span className="truncate">del</span>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex w-full gap-0.5 sm:gap-1 md:gap-2 h-8 sm:h-10 md:h-12">
          <div className="flex-[1.6] bg-neutral-200/80 rounded sm:rounded-md md:rounded-lg flex items-center justify-start pl-1 sm:pl-2 md:pl-4 text-neutral-900 text-xs sm:text-sm md:text-lg font-normal hover:bg-neutral-300/80 transition-colors cursor-default">
            <span className="truncate">tab</span>
          </div>
          {[
            "Q",
            "W",
            "E",
            "R",
            "T",
            "Y",
            "U",
            "I",
            "O",
            "P",
            "[",
            "]",
            "\\",
          ].map((k) => (
            <div
              key={k}
              className="flex-1 bg-white rounded sm:rounded-md md:rounded-lg shadow-sm flex items-center justify-center text-neutral-900 text-xs sm:text-sm md:text-xl font-normal hover:bg-neutral-50 transition-colors cursor-default min-w-0"
            >
              <span className="truncate">{k}</span>
            </div>
          ))}
        </div>

        {/* Row 3 */}
        <div className="flex w-full gap-0.5 sm:gap-1 md:gap-2 h-8 sm:h-10 md:h-12">
          <div className="flex-[1.9] bg-neutral-200/80 rounded sm:rounded-md md:rounded-lg flex items-center justify-start pl-1 sm:pl-2 md:pl-4 text-neutral-900 text-xs sm:text-sm md:text-lg font-normal hover:bg-neutral-300/80 transition-colors cursor-default">
            <span className="truncate">caps</span>
          </div>
          {["A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'"].map((k) => (
            <div
              key={k}
              className="flex-1 bg-white rounded sm:rounded-md md:rounded-lg shadow-sm flex items-center justify-center text-neutral-900 text-xs sm:text-sm md:text-xl font-normal hover:bg-neutral-50 transition-colors cursor-default min-w-0"
            >
              <span className="truncate">{k}</span>
            </div>
          ))}
          <div className="flex-[2.3] bg-[#348feb] rounded sm:rounded-md md:rounded-lg flex items-end justify-end pr-1 sm:pr-2 md:pr-4 pb-1 sm:pb-2 md:pb-3 text-neutral-900 text-xs sm:text-sm md:text-lg font-normal relative hover:bg-[#2682de] transition-colors cursor-default">
            <div className="absolute top-1 right-1 w-1 h-1 sm:w-1.5 sm:h-1.5 bg-white rounded-full opacity-90" />
            <span className="truncate">return</span>
          </div>
        </div>

        {/* Row 4 */}
        <div className="flex w-full gap-0.5 sm:gap-1 md:gap-2 h-8 sm:h-10 md:h-12">
          <div className="flex-[2.5] bg-neutral-200/80 rounded sm:rounded-md md:rounded-lg flex items-center justify-start pl-1 sm:pl-2 md:pl-4 text-neutral-900 text-xs sm:text-sm md:text-lg font-normal hover:bg-neutral-300/80 transition-colors cursor-default">
            <span className="truncate">shift</span>
          </div>
          {["Z", "X", "C", "V", "B", "N", "M", ",", ".", "/"].map((k) => (
            <div
              key={k}
              className="flex-1 bg-white rounded sm:rounded-md md:rounded-lg shadow-sm flex items-center justify-center text-neutral-900 text-xs sm:text-sm md:text-xl font-normal hover:bg-neutral-50 transition-colors cursor-default min-w-0"
            >
              <span className="truncate">{k}</span>
            </div>
          ))}
          <div className="flex-[2.5] bg-neutral-200/80 rounded sm:rounded-md md:rounded-lg flex items-center justify-end pr-1 sm:pr-2 md:pr-4 text-neutral-900 text-xs sm:text-sm md:text-lg font-normal hover:bg-neutral-300/80 transition-colors cursor-default">
            <span className="truncate">shift</span>
          </div>
        </div>

        {/* Row 5 */}
        <div className="flex w-full gap-0.5 sm:gap-1 md:gap-2 h-8 sm:h-10 md:h-12">
          {["ctrl", "opt", "hpOS"].map((k) => (
            <div
              key={k}
              className="flex-[1.25] bg-neutral-200/80 rounded sm:rounded-md md:rounded-lg flex items-center justify-start pl-1 sm:pl-2 md:pl-4 pr-2 text-neutral-900 text-xs sm:text-sm md:text-lg font-normal hover:bg-neutral-300/80 transition-colors cursor-default"
            >
              <span className="truncate">{k}</span>
            </div>
          ))}
          <div className="flex-[6.5] bg-white rounded sm:rounded-md md:rounded-lg shadow-sm hover:bg-neutral-50 transition-colors cursor-default" />
          {["hpOS", "opt", "ctrl"].map((k) => (
            <div
              key={k}
              className="flex-[1.25] bg-neutral-200/80 rounded sm:rounded-md md:rounded-lg flex items-center justify-start pl-1 sm:pl-2 md:pl-4 pr-2 text-neutral-900 text-xs sm:text-sm md:text-lg font-normal hover:bg-neutral-300/80 transition-colors cursor-default"
            >
              <span className="truncate">{k}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KeyboardUI;
