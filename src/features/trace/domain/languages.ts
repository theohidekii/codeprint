import type { Language } from "./types";

export interface LanguageSpec {
  label: string;
  keywords: ReadonlySet<string>;
  lineComments: readonly string[];
  blockComments: readonly (readonly [open: string, close: string])[];
  /** Quotes that open a string. Backticks and triple quotes may span lines. */
  stringQuotes: readonly string[];
}

const words = (list: string) => new Set(list.split(/\s+/).filter(Boolean));

const C_COMMENTS = {
  lineComments: ["//"],
  blockComments: [["/*", "*/"]],
} as const;

const JS_KEYWORDS = `async await break case catch class const continue debugger default delete do else export
  extends false finally for function if import in instanceof let new null of return static super switch this
  throw true try typeof undefined var void while with yield`;

const C_KEYWORDS = `auto break case char const continue default do double else enum extern float for goto if
  inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void
  volatile while NULL`;

export const LANGUAGE_SPECS: Record<Language, LanguageSpec> = {
  javascript: {
    label: "JavaScript",
    keywords: words(JS_KEYWORDS),
    ...C_COMMENTS,
    stringQuotes: ["'", '"', "`"],
  },
  typescript: {
    label: "TypeScript",
    keywords:
      words(`${JS_KEYWORDS} interface type enum implements namespace declare abstract private public
      protected readonly as is keyof any number string boolean never unknown satisfies`),
    ...C_COMMENTS,
    stringQuotes: ["'", '"', "`"],
  },
  python: {
    label: "Python",
    keywords:
      words(`and as assert async await break class continue def del elif else except False finally for
      from global if import in is lambda None nonlocal not or pass raise return True try while with yield`),
    lineComments: ["#"],
    blockComments: [],
    stringQuotes: ['"""', "'''", "'", '"'],
  },
  java: {
    label: "Java",
    keywords:
      words(`abstract assert boolean break byte case catch char class const continue default do double
      else enum extends final finally float for goto if implements import instanceof int interface long native
      new package private protected public record return short static strictfp super switch synchronized this
      throw throws transient try var void volatile while true false null`),
    ...C_COMMENTS,
    stringQuotes: ['"""', '"', "'"],
  },
  c: {
    label: "C",
    keywords: words(C_KEYWORDS),
    ...C_COMMENTS,
    stringQuotes: ['"', "'"],
  },
  cpp: {
    label: "C++",
    keywords:
      words(`${C_KEYWORDS} bool catch class const_cast constexpr delete dynamic_cast explicit false
      friend mutable namespace new noexcept nullptr operator override private protected public reinterpret_cast
      static_cast template this throw true try typename using virtual`),
    ...C_COMMENTS,
    stringQuotes: ['"', "'"],
  },
  csharp: {
    label: "C#",
    keywords:
      words(`abstract as async await base bool break byte case catch char checked class const continue
      decimal default delegate do double else enum event explicit extern false finally fixed float for foreach
      get goto if implicit in int interface internal is lock long namespace new null object operator out
      override params private protected public readonly ref return sbyte sealed set short sizeof stackalloc
      static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var
      virtual void volatile while`),
    ...C_COMMENTS,
    stringQuotes: ['"', "'"],
  },
  go: {
    label: "Go",
    keywords:
      words(`break case chan const continue default defer else fallthrough false for func go goto if
      import interface map nil package range return select struct switch true type var`),
    ...C_COMMENTS,
    stringQuotes: ['"', "'", "`"],
  },
  rust: {
    label: "Rust",
    keywords:
      words(`as async await break const continue crate dyn else enum extern false fn for if impl in let
      loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where
      while`),
    ...C_COMMENTS,
    // Single quotes are handled by the tokenizer: they open either a char literal or a lifetime.
    stringQuotes: ['"'],
  },
  php: {
    label: "PHP",
    keywords:
      words(`abstract and array as break callable case catch class clone const continue declare default
      do echo else elseif empty extends false final finally fn for foreach function global goto if implements
      include instanceof insteadof interface isset list match namespace new null or print private protected
      public readonly require return static switch throw trait true try unset use var while yield`),
    lineComments: ["//", "#"],
    blockComments: [["/*", "*/"]],
    stringQuotes: ['"', "'"],
  },
  ruby: {
    label: "Ruby",
    keywords:
      words(`alias and begin break case class def do else elsif end ensure false for if in module next
      nil not or redo rescue retry return self super then true undef unless until when while yield`),
    lineComments: ["#"],
    blockComments: [["=begin", "=end"]],
    stringQuotes: ['"', "'"],
  },
  generic: {
    label: "Other",
    keywords: words(
      "if else for while do return function def class const let var int switch case break",
    ),
    ...C_COMMENTS,
    stringQuotes: ['"', "'", "`"],
  },
};
