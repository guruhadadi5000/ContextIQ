"use client";

import { useEffect, useState } from "react";
import { readSession } from "@/lib/api";

export default function HistoryPage() {
  const [chatSessionId, setChatSessionId] = useState("");
  const [documentSessionId, setDocumentSessionId] = useState("");

  useEffect(() => {
    setChatSessionId(readSession("chat"));
    setDocumentSessionId(readSession("document"));
  }, []);

  return (
    <section className="h-full overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-2xl font-semibold">History</h1>
      <p className="mt-2 text-cyan-500">
        Chat history is an upcoming feature. Conversations are saved for this
        browser, and a full history view will be added here. At the moment, you
        can see the last conversation you had in the chat or document section.
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
  );
}
