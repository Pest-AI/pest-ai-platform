import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("échappe les séparateurs et guillemets", () => {
    expect(csvCell('Guédé; "Nord"')).toBe('"Guédé; ""Nord"""');
  });
  it("neutralise les formules", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+221771234567")).toBe("'+221771234567");
  });
  it("ajoute le BOM et les fins de ligne Windows", () => {
    expect(toCsv(["a"], [[1]])).toBe("﻿a\r\n1\r\n");
  });
});
