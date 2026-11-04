import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { splitSource } from "@/lib/api";

export default function MarkdownMessage({ content }: { content: string }) {
  const parsed = splitSource(content);

  return (
    <div className="space-y-2 wrap-break-word">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h3 className="text-base font-semibold">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="text-base font-semibold">{children}</h3>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold">{children}</h3>
          ),
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5">{children}</ol>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) =>
            className ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em]">
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-sm text-slate-100">
              {children}
            </pre>
          ),
        }}
      >
        {parsed.answer || ""}
      </Markdown>
      {parsed.source && (
        <p className="text-sm text-teal-700">Source: {parsed.source}</p>
      )}
    </div>
  );
}
