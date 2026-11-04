"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import MarkdownMessage from "@/components/MarkdownMessage";
import SuggestedQuestions from "@/components/SuggestedQuestions";
import {
  apiBase,
  parseTimestamp,
  readSession,
  StoredMessage,
  streamChat,
  writeSession,
} from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const suggestions = [
  "What is your background?",
  "Which projects have you shipped?",
  "What technical skills do you use?",
];

export default function Chat({
  onActivity,
}: {
  onActivity?: (note: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const stored = readSession("chat");
    if (!stored) {
      setIsRestoring(false);
      return;
    }

    setSessionId(stored);
    onActivity?.(stored);
    let cancelled = false;

    const restore = async () => {
      try {
        const response = await fetch(`${apiBase}/conversation/${stored}`);
        if (!response.ok) throw new Error("The saved conversation could not be loaded.");
        const data = await response.json();
        if (cancelled) return;
        const restored = ((data.messages ?? []) as StoredMessage[])
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message, index) => ({
            id: `${stored}-${index}`,
            role: message.role as Message["role"],
            content: message.content,
            timestamp: parseTimestamp(message.timestamp),
          }));
        setMessages(restored);
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
  }, [onActivity]);

  const sendMessage = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };
    const assistantId = `${Date.now()}-reply`;

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      },
    ]);
    setInput("");
    setError("");
    setIsLoading(true);
    let streamed = "";

    try {
      const nextSessionId = await streamChat(message, sessionId, (content) => {
        streamed = content;
        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantId ? { ...item, content } : item,
          ),
        );
      });
      if (!sessionId) setSessionId(nextSessionId);
      writeSession("chat", nextSessionId);
      onActivity?.(nextSessionId);
    } catch (sendError) {
      const detail =
        sendError instanceof Error
          ? sendError.message
          : "The message could not be sent.";
      setError(detail);
      if (!streamed) {
        setMessages((prev) =>
          prev.filter((item) => item.id !== userMessage.id && item.id !== assistantId),
        );
        setInput(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-100">
      <div className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <h1 className="text-2xl font-semibold text-slate-900">Chat</h1>
        <p className="text-sm text-slate-500">
          Ask about experience, projects, and background.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {isRestoring && (
          <p className="mt-8 text-center text-sm text-gray-500" role="status">
            Loading conversation...
          </p>
        )}

        {!isRestoring && messages.length === 0 && (
          <div className="mt-8 text-center text-gray-500">
            <Bot className="mx-auto mb-3 h-12 w-12 text-gray-400" />
            <p>Hello, I&apos;m ContextIQ.</p>
            <p className="mt-2 text-sm">
              Ask about experience, projects, and background.
            </p>
            <SuggestedQuestions
              questions={suggestions}
              onSelect={sendMessage}
              disabled={isLoading}
            />
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <div className="shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700">
                  <Bot className="h-5 w-5 text-white" />
                </div>
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-lg p-3 sm:max-w-[70%] ${
                message.role === "user"
                  ? "bg-slate-700 text-white"
                  : "border border-gray-200 bg-white text-gray-800"
              }`}
            >
              {message.role === "assistant" ? (
                message.content ? (
                  <MarkdownMessage content={message.content} />
                ) : (
                  <div className="flex space-x-2" role="status" aria-label="Writing a reply">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 delay-100" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 delay-200" />
                  </div>
                )
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
              {message.content && (
                <p
                  className={`mt-1 text-xs ${
                    message.role === "user" ? "text-slate-300" : "text-gray-500"
                  }`}
                >
                  {message.timestamp.toLocaleTimeString()}
                </p>
              )}
            </div>

            {message.role === "user" && (
              <div className="shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-600">
                  <User className="h-5 w-5 text-white" />
                </div>
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 bg-white p-4">
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-600"
            disabled={isLoading || isRestoring}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading || isRestoring}
            aria-label="Send"
            className="rounded-lg bg-slate-700 px-4 py-2 text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
