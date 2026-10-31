export function SiteFooter() {
  return (
    <footer className="mx-auto mt-auto w-full max-w-[1180px] px-4 sm:px-6">
      <div className="border-border text-muted flex flex-col justify-between gap-2 border-t py-8 text-sm sm:flex-row">
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
