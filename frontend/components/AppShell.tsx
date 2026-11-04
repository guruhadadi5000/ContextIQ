"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock3,
  FileText,
  Menu,
  MessageSquare,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

const nav: {
  href: string;
  label: string;
  icon: typeof MessageSquare;
}[] = [
  { href: "/chat", label: "Meet My Digital Self", icon: MessageSquare },
  { href: "/", label: "Document Intelligence", icon: FileText },
  { href: "/history", label: "Chat History", icon: Clock3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function currentPath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = currentPath(usePathname());
  const [menuOpen, setMenuOpen] = useState(false);
  const current = nav.find((item) => item.href === pathname);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-900">
      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-20 bg-slate-900/40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 flex-col bg-[#0c2340] text-slate-200 transition-transform md:static md:w-60 md:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5 text-white">
          <Link
            href="/"
            className="flex items-center gap-2"
            onClick={() => setMenuOpen(false)}
          >
            <Sparkles className="h-5 w-5 text-teal-300" />
            <span className="text-lg font-semibold">ContextIQ AI</span>
          </Link>
          <button
            type="button"
            className="rounded-lg p-1 md:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${
                  active ? "bg-white/10 text-white" : "hover:bg-white/5"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-teal-300" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center gap-3 border-b border-slate-200 bg-[#0c2340] px-4 sm:px-6">
          <button
            type="button"
            className="rounded-lg p-1 text-white md:hidden"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-medium text-white md:hidden">
            {current?.label}
          </span>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
