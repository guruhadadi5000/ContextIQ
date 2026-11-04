export default function SuggestedQuestions({
  questions,
  onSelect,
  disabled = false,
  align = "center",
}: {
  questions: string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
  align?: "center" | "start";
}) {
  return (
    <div
      className={`mt-4 flex flex-wrap gap-2 ${
        align === "center" ? "justify-center" : "justify-start"
      }`}
    >
      {questions.map((question) => (
        <button
          key={question}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(question)}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-teal-700 hover:text-teal-800 disabled:opacity-50"
        >
          {question}
        </button>
      ))}
    </div>
  );
}
