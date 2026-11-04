"use client";

import { useEffect, useState } from "react";
import {
  Clock3,
  FileText,
  Menu,
  MessageSquare,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import Chat from "@/components/Chat";
import Documents from "@/components/Documents";

type View = "chat" | "documents" | "history" | "settings";

const nav: { id: View; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Meet My Digital Self", icon: MessageSquare },
  { id: "documents", label: "Document Intelligence", icon: FileText },
  { id: "history", label: "Chat History", icon: Clock3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function AppShell() {
  const [view, setView] = useState<View>("documents");
  const [menuOpen, setMenuOpen] = useState(false);
  const [documentSessionId, setDocumentSessionId] = useState("");
  const [chatSessionId, setChatSessionId] = useState("");
  const current = nav.find((item) => item.id === view);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const openView = (next: View) => {
    setView(next);
    setMenuOpen(false);
  };

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
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-300" />
            <span className="text-lg font-semibold">ContextIQ AI</span>
          </div>
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
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openView(item.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${
                  active ? "bg-white/10 text-white" : "hover:bg-white/5"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-teal-300" : ""}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-[#0c2340] px-4 py-3 sm:px-6">
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
          <span className="ml-auto rounded-full border border-white/20 px-3 py-1 text-sm text-white">
            Workspace
          </span>
        </header>
        <main className="min-h-0 flex-1">
          <div className={view === "chat" ? "h-full" : "hidden"}>
            <Chat onActivity={setChatSessionId} />
          </div>
          <div className={view === "documents" ? "h-full" : "hidden"}>
            <Documents onSessionId={setDocumentSessionId} />
          </div>
          {view === "history" && (
            <section className="h-full overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
              <h1 className="text-2xl font-semibold">History</h1>
              <p className="mt-2 text-slate-500">
                Conversations saved in this browser.
              </p>
              <ul className="mt-6 space-y-3">
                {chatSessionId && (
                  <li className="rounded-xl bg-white px-4 py-3">
                    Chat · {chatSessionId}
                  </li>
                )}
                {documentSessionId && (
                  <li className="rounded-xl bg-white px-4 py-3">
                    Document · {documentSessionId}
                  </li>
                )}
                {!chatSessionId && !documentSessionId && (
                  <li className="text-slate-500">No conversations yet.</li>
                )}
              </ul>
            </section>
          )}
          {view === "settings" && (
            <section className="h-full overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
              <h1 className="text-2xl font-semibold">Settings</h1>
              <p className="mt-4 max-w-xl text-slate-600">
                One document is kept per conversation. ContextIQ sends the
                extracted text with each question, so very large files are
                declined instead of being cut off. Uploads are limited to 4 MB
                and 60,000 characters of text. Replies arrive as they are
                written and render with headings, lists, and code.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
