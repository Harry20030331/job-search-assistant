import { expect, test } from "vitest";
import { practiceArtifact, practiceText } from "./practiceText.js";

test("model text formats examples and inline code without executing HTML", () => {
  const content = practiceText('Use `start < end`.\n\n1) empty -> [] 2) invalid -> ValueError\n<img src=x onerror="bad()">');
  expect(content).toContain("<code>start &lt; end</code>");
  expect(content).toContain("<ol><li>empty -&gt; []</li><li>invalid -&gt; ValueError</li></ol>");
  expect(content).not.toContain("<img"); expect(content).toContain("&lt;img");
});
test("code and tables get semantic formatting while prose wraps normally", () => {
  expect(practiceText('```python\nif a < b:\n    return []\n```')).toContain('<pre><code>if a &lt; b:');
  const table = practiceArtifact({ format: "table", content: "| Group | Count |\n| --- | --- |\n| Control | 100 |" });
  expect(table).toContain('<th scope="col">Group</th>'); expect(table).toContain("<td>100</td>");
  expect(practiceArtifact({ format: "text", content: "A short paragraph." })).toBe("<p>A short paragraph.</p>");
  const mixed = practiceArtifact({ format: "code", content: "available(start: int, end: int) -> list\n\nReturn maximal gaps. Raise ValueError for invalid windows." });
  expect(mixed).toContain("</code></pre><p>Return maximal gaps.");
  expect(practiceText("available(0, 5) -> []")).toContain('<span>→ <code>[]</code></span>');
  const longSignature = practiceArtifact({ format: "code", content: "available_intervals(start: int, end: int, busy: list[tuple[int, int]]) -> list[tuple[int, int]]\n\nReturn maximal gaps." });
  expect(longSignature).toContain("available_intervals(\n    start: int,\n    end: int,\n    busy: list[tuple[int, int]]\n)");
  const contract = practiceArtifact({ format: "code", content: "def free_time(start: int, end: int) -> int:\n    ...\n\nExample 1: start=0, end=5 -> 5\n\nRules: require start < end." });
  expect(contract).toContain("</code></pre><p class=\"worked-example\"");
  expect(contract).toContain("<p>Rules: require start &lt; end.</p>");
});
