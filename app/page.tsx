import Link from "next/link";

const projects = [
  {
    slug: "qrmaker",
    title: "QR Maker",
    description:
      "Generate QR codes for text, URLs, Wi-Fi, email, phone, and SMS. Customise colors, size, and error correction, then download PNG or SVG.",
    tags: ["Tool", "Utility"],
  },
  {
    slug: "openhouse",
    title: "KU Open House Slide",
    description:
      "Real-time presentation slides for KU Engineering Open House 2025. Controlled remotely via Pusher with intro/outro video transitions.",
    tags: ["Presentation", "Real-time"],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-20 max-w-3xl mx-auto">
      <header className="mb-16">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Lylatier</h1>
        <p className="text-[var(--muted)]">A collection of small projects.</p>
      </header>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-6">
          Projects
        </h2>
        <ul className="space-y-4">
          {projects.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/${p.slug}`}
                className="group block rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-5 transition-colors hover:border-[var(--foreground)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium mb-1 group-hover:underline underline-offset-2">
                      {p.title}
                    </h3>
                    <p className="text-sm text-[var(--muted)] leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                  <span className="text-[var(--muted)] mt-0.5 shrink-0">→</span>
                </div>
                <div className="flex gap-2 mt-3">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--muted)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
