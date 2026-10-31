import { LANGUAGE_SPECS } from "../domain/languages";
import { LANGUAGES, type Language } from "../domain/types";

export type LanguageChoice = Language | "auto";

interface LanguageSelectProps {
  value: LanguageChoice;
  detected: Language;
  onChange: (value: LanguageChoice) => void;
}

export function LanguageSelect({
  value,
  detected,
  onChange,
}: LanguageSelectProps) {
  return (
    <label className="text-muted flex items-center gap-3 text-sm font-medium">
      Language
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as LanguageChoice)}
        className="border-border bg-surface text-text hover:bg-surface-raised h-10 rounded-md border px-3 text-sm"
      >
        <option value="auto">
          Auto-detect ({LANGUAGE_SPECS[detected].label})
        </option>
        {LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {LANGUAGE_SPECS[language].label}
          </option>
        ))}
      </select>
    </label>
  );
}
