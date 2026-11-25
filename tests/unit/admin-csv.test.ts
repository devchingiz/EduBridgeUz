import { describe, expect, it } from "vitest";

import { csvRowsToObjects, parseCsv, toCsv } from "@/lib/admin/csv";

describe("administration CSV helpers", () => {
  it("parses quoted commas, escaped quotes, CRLF, and a BOM", () => {
    const rows = parseCsv(
      '\uFEFFname,note\r\n"Oxford, UK","Says ""hello"""\r\n\r\n',
    );

    expect(rows).toEqual([
      ["name", "note"],
      ["Oxford, UK", 'Says "hello"'],
    ]);
  });

  it("keeps plain values in quoted fields verbatim", () => {
    expect(parseCsv('" spaced ",plain')).toEqual([[" spaced ", "plain"]]);
  });

  it("rejects an unterminated quoted field", () => {
    expect(() => parseCsv('name,note\n"Oxford')).toThrow(
      "unterminated quoted value",
    );
  });

  it("neutralises spreadsheet formulas and escapes output cells", () => {
    expect(
      toCsv([
        ["name", "note"],
        ["=HYPERLINK()", 'Say "hello", again'],
      ]),
    ).toBe('name,note\r\n\'=HYPERLINK(),"Say ""hello"", again"\r\n');
  });

  it("maps header rows to trimmed objects", () => {
    expect(
      csvRowsToObjects([
        [" name ", " country ", ""],
        [" Oxford ", " GB ", "ignored"],
      ]),
    ).toEqual([{ name: "Oxford", country: "GB" }]);
  });
});
