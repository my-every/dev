"use client";

import { useEffect, useState, useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "d380-theme-preference";

// Helper to apply theme to document
function applyTheme(theme: Theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      const initialTheme = stored || "light";
      setTheme(initialTheme);
      applyTheme(initialTheme);
    } catch {
      applyTheme("light");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // localStorage may be unavailable
    }
    applyTheme(newTheme);
  }, [theme]);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-9 w-9 p-0", className)}
        disabled
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-9 w-9 p-0 hover:bg-primary/10 transition-colors",
        className
      )}
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-primary" />
      ) : (
        <Moon className="h-4 w-4 text-primary" />
      )}
    </Button>
  );
}

// Compact pill toggle for floating toolbar - Solar Turbines Yellow styling
export function ThemeTogglePill({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      const initialTheme = stored || "light";
      setTheme(initialTheme);
      applyTheme(initialTheme);
    } catch {
      applyTheme("light");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // localStorage may be unavailable
    }
    applyTheme(newTheme);
  }, [theme]);

  if (!mounted) {
    return (
      <div className={cn("flex items-center rounded-full bg-secondary/50 p-0.5", className)}>
        <div className="h-7 w-7 rounded-full" />
        <div className="h-7 w-7 rounded-full" />
      </div>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative flex items-center rounded-full bg-secondary/80 p-0.5 transition-all duration-300 hover:bg-secondary border border-border/50",
        className
      )}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {/* Light mode button */}
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300",
          theme === "light" 
            ? "bg-primary text-primary-foreground shadow-md" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Sun className="h-4 w-4" />
      </div>
      {/* Dark mode button */}
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300",
          theme === "dark" 
            ? "bg-primary text-primary-foreground shadow-md" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Moon className="h-4 w-4" />
      </div>
    </button>
  );
}
