export default function SettingsPage() {
  return (
    <section className="h-full overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-4 max-w-xl text-cyan-500">
        Settings are an upcoming feature. At the moment, this is just a
        placeholder. One document is kept per conversation. ContextIQ sends the
        extracted text with each question, so very large files are declined
        instead of being cut off. Uploads are limited to 4 MB and 60,000
        characters of text. Replies arrive as they are written and render with
        headings, lists, and code.
      </p>
    </section>
  );
}
