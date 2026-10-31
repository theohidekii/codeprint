// @vitest-environment node
import { ESLint } from "eslint";

const eslint = new ESLint();
const DOMAIN_FILE = "src/features/example/domain/rule.ts";

async function restrictedImportErrors(source: string): Promise<number> {
  const [result] = await eslint.lintText(source, { filePath: DOMAIN_FILE });
  return result!.messages.filter((m) => m.ruleId === "no-restricted-imports")
    .length;
}

// Loading the ESLint config and TypeScript parser is slow the first time; do it once up front.
beforeAll(() => eslint.lintText("", { filePath: DOMAIN_FILE }), 30_000);

describe("domain purity lint rule", () => {
  it.each([
    'import { useState } from "react";',
    'import { createRoot } from "react-dom/client";',
    'import { jsx } from "react/jsx-runtime";',
    'import { notFound } from "next/navigation";',
    'import { env } from "@/env";',
    'import { Button } from "../ui";',
    'import { Hero } from "../ui/hero";',
    'import { search } from "../providers";',
    'import { github } from "../providers/github";',
    'import Page from "../../../app/page";',
    'import Page from "@/app/page";',
  ])("rejects %s in domain code", async (source) => {
    expect(await restrictedImportErrors(source)).toBe(1);
  });

  it("allows pure imports such as sibling domain modules and zod", async () => {
    expect(
      await restrictedImportErrors(
        'import { z } from "zod";\nimport { a } from "./tokenize";',
      ),
    ).toBe(0);
  });

  it("does not restrict code outside domain folders", async () => {
    const [result] = await eslint.lintText(
      'import { useState } from "react";',
      {
        filePath: "src/features/example/ui/view.tsx",
      },
    );
    expect(
      result!.messages.filter((m) => m.ruleId === "no-restricted-imports"),
    ).toHaveLength(0);
  });
});
