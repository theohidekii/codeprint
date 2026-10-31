const steps = [
  {
    title: "Tokenize",
    body: "Split the snippet into keywords, names, strings and symbols, the way a compiler reads it.",
  },
  {
    title: "Normalize",
    body: "Drop comments and whitespace, and swap every name for a placeholder, so renamed copies look identical.",
  },
  {
    title: "Fingerprint",
    body: "Hash short runs of tokens and keep the most telling ones. Matching prints mean matching code.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-heading"
      className="border-border border-t py-14 md:py-24"
    >
      <h2 id="how-heading" className="text-h2 font-black">
        How Trace sees through renaming
      </h2>
      <ol className="mt-10 grid gap-10 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title}>
            <span aria-hidden className="text-accent font-mono text-sm">
              {i + 1}
            </span>
            <h3 className="text-h3 mt-2 font-bold">{step.title}</h3>
            <p className="text-muted mt-2 max-w-[28em]">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
