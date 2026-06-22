import Link from "next/link"
import { cn } from "@/lib/utils"

interface Tab {
  label: string
  href: string
}

export function SectionTabs({ tabs, active }: { tabs: Tab[]; active: string }) {
  return (
    <div className="flex border-b border-border px-6">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "relative px-4 py-2.5 text-[13px] font-medium transition-colors",
            tab.href === active
              ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:rounded-t after:bg-primary"
              : "text-muted-foreground hover:text-primary/70"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
