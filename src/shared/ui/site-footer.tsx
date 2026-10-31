export function SiteFooter() {
  return (
    <footer className="border-border text-muted mx-auto mt-auto w-full max-w-[1180px] border-t px-4 py-8 text-sm sm:px-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row">
        <p>Codeprint is an open-source portfolio project.</p>
        <a
          href="https://github.com/theohidekii/codeprint"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-text underline-offset-4 hover:underline"
        >
          Source on GitHub
        </a>
      </div>
    </footer>
  );
}
