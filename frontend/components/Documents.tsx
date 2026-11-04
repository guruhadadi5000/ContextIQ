"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, FileText, Upload, X } from "lucide-react";
import MarkdownMessage from "@/components/MarkdownMessage";
import SuggestedQuestions from "@/components/SuggestedQuestions";
import {
  apiBase,
  readSession,
  StoredMessage,
  streamChat,
  uploadError,
  writeSession,
} from "@/lib/api";

interface Answer {
  id: string;
  question: string;
  answer: string;
  source?: string;
}

interface UploadedFile {
  name: string;
  characters: number;
}

const accepted = ".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const suggestions = [
  "Summarise this document",
  "What are the main points?",
  "What should I remember from this?",
];

export default function Documents({
  onSessionId,
}: {
  onSessionId?: (sessionId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sessionId, setSessionId] = useState("");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [question, setQuestion] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const stored = readSession("document");
    if (!stored) {
      setIsRestoring(false);
      return;
    }

    setSessionId(stored);
    onSessionId?.(stored);
    let cancelled = false;

    const restore = async () => {
      try {
        const [conversationResponse, documentResponse] = await Promise.all([
          fetch(`${apiBase}/conversation/${stored}`),
          fetch(`${apiBase}/document/${stored}`),
        ]);
        if (cancelled) return;

        if (!conversationResponse.ok) {
          throw new Error("The saved conversation could not be loaded.");
        }
        const data = await conversationResponse.json();
        const messages = (data.messages ?? []) as StoredMessage[];
        const restored: Answer[] = [];
        messages.forEach((message, index) => {
          if (message.role !== "user") return;
          const reply = messages[index + 1];
          restored.push({
            id: `${stored}-${index}`,
            question: message.content,
            answer: reply?.role === "assistant" ? reply.content : "",
          });
        });
        setAnswers(restored);

        if (documentResponse.ok) {
          const data = await documentResponse.json();
          setFile({ name: data.filename, characters: data.characters });
        }
      } catch (restoreError) {
        if (!cancelled) {
          setError(
            restoreError instanceof Error
              ? restoreError.message
              : "The saved conversation could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, [onSessionId]);

  const upload = async (selected: File) => {
    const validation = uploadError(selected);
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    setIsUploading(true);
    try {
      const body = new FormData();
      body.append("file", selected);
      if (sessionId) body.append("session_id", sessionId);

      const response = await fetch(`${apiBase}/document`, {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = typeof data.detail === "string" ? data.detail : "";
        throw new Error(detail || "Upload failed");
      }
      writeSession("document", data.session_id);
      setSessionId(data.session_id);
      onSessionId?.(data.session_id);
      setFile({ name: data.filename, characters: data.characters });
      setAnswers([]);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = async () => {
    setError("");
    if (sessionId) {
      const response = await fetch(`${apiBase}/document/${sessionId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError("The document could not be removed.");
        return;
      }
    }
    setFile(null);
    setAnswers([]);
  };

  const ask = async (text?: string) => {
    const currentQuestion = (text ?? question).trim();
    if (!file || !currentQuestion || isAsking) return;
    const answerId = Date.now().toString();
    setQuestion("");
    setIsAsking(true);
    setError("");
    setAnswers((current) => [
      ...current,
      { id: answerId, question: currentQuestion, answer: "" },
    ]);
    let streamed = "";
    try {
      const nextSessionId = await streamChat(
        currentQuestion,
        sessionId,
        (content) => {
          streamed = content;
          setAnswers((current) =>
            current.map((item) =>
              item.id === answerId ? { ...item, answer: content } : item,
            ),
          );
        },
      );
      if (!sessionId) {
        writeSession("document", nextSessionId);
        setSessionId(nextSessionId);
        onSessionId?.(nextSessionId);
      }
    } catch (askError) {
      setError(
        askError instanceof Error
          ? askError.message
          : "The question could not be answered",
      );
      if (!streamed) {
        setAnswers((current) => current.filter((item) => item.id !== answerId));
        setQuestion(currentQuestion);
      }
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        <p className="text-xs font-semibold tracking-[0.16em] text-slate-500">
          DOCUMENT INTELLIGENCE
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          Ask your documents
        </h1>
        <p className="mt-2 text-slate-500">
          Upload a file and explore it with AI.
        </p>

        {isRestoring && (
          <p className="mt-6 text-sm text-slate-500" role="status">
            Loading conversation...
          </p>
        )}

        {!isRestoring && !file && (
          <button
            type="button"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              const dropped = event.dataTransfer.files[0];
              if (dropped) upload(dropped);
            }}
            className={`mt-6 flex w-full flex-col items-center rounded-2xl border border-dashed px-6 py-10 disabled:opacity-70 sm:py-12 ${
              dragOver
                ? "border-teal-600 bg-teal-50"
                : "border-slate-300 bg-white"
            }`}
          >
            <Upload className="h-8 w-8 text-teal-700" />
            <p className="mt-3 font-medium text-slate-800">
              {isUploading ? "Reading your file..." : "Drop your file here"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              PDF, DOCX or TXT, up to 4 MB. Extracted text must stay under
              60,000 characters.
            </p>
            <span className="mt-4 rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white">
              Choose file
            </span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accepted}
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) upload(selected);
            event.target.value = "";
          }}
        />

        {file && (
          <div className="mt-6 flex flex-col gap-3 rounded-xl bg-teal-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-teal-700" />
              <div>
                <p className="font-medium text-slate-800">{file.name}</p>
                <p className="text-sm text-slate-500">
                  Ready for questions · {file.characters.toLocaleString()}{" "}
                  characters
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={removeFile}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm text-slate-600 hover:bg-white"
            >
              <X className="h-4 w-4" />
              Remove
            </button>
          </div>
        )}

        {file && answers.length === 0 && !isAsking && (
          <SuggestedQuestions
            questions={suggestions}
            onSelect={ask}
            align="start"
          />
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 space-y-3">
          {answers.map((item) => (
            <article key={item.id} className="rounded-xl bg-white px-4 py-4 shadow-sm sm:px-5">
              <h2 className="font-medium text-slate-900">{item.question}</h2>
              <div className="mt-3 text-slate-700">
                {item.answer ? (
                  <MarkdownMessage content={item.answer} />
                ) : (
                  <p className="text-sm text-slate-500" role="status">
                    Reading the document...
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      <form
        className="border-t border-slate-200 bg-white px-4 py-4 sm:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          ask();
        }}
      >
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={file ? "Ask a question..." : "Upload a document first"}
            disabled={!file || isAsking}
            className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-teal-700 disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={!file || !question.trim() || isAsking}
            aria-label="Ask"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-700 text-white disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
