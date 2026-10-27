/** Small, escaped text formatter for model-authored interview content. No raw HTML. */
function escape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function inline(value: string) {
  return escape(value).replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
}
function signature(value: string): string {
  if (value.length < 76) return value;
  const match = value.match(/^((?:def\s+)?\w+)\((.*)\)(.*)$/);
  if (!match) return value;
  const parameters: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < match[2]!.length; i++) {
    const char = match[2]![i]!;
    if ("[({".includes(char)) depth++;
    if ("])}".includes(char)) depth--;
    if (char === "," && depth === 0) { parameters.push(match[2]!.slice(start, i).trim()); start = i + 1; }
  }
  parameters.push(match[2]!.slice(start).trim());
  return `${match[1]}(\n${parameters.map(parameter => "    " + parameter).join(",\n")}\n)${match[3]}`;
}
function prose(value: string): string {
  // Older packs sometimes put every worked example on one line.
  const lines = value.replace(/(?<![,\s(])\s+(?=\d+\)\s)/g, "\n").split(/\r?\n/);
  const output: string[] = [];
  let items: string[] = [], ordered = false;
  const flush = () => { if (items.length) output.push(`<${ordered ? "ol" : "ul"}>${items.map(item => `<li>${inline(item)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`); items = []; };
  for (const line of lines) {
    const text = line.trim();
    if (!text) { flush(); continue; }
    const match = text.match(/^(?:(\d+)[.)]|[-*])\s+(.+)$/);
    if (match) {
      const nextOrdered = Boolean(match[1]);
      if (items.length && ordered !== nextOrdered) flush();
      ordered = nextOrdered; items.push(match[2]!);
    } else {
      flush();
      const example = text.match(/^([A-Za-z_]\w*\(.*\))\s*->\s*(.+)$/);
      const labeled = text.match(/^Example (\d+):\s*(.+?)\s*->\s*(.+)$/);
      output.push(example ? `<p class="worked-example"><code>${escape(example[1]!)}</code><span>→ <code>${escape(example[2]!)}</code></span></p>` : labeled ? `<p class="worked-example"><strong>Example ${labeled[1]}</strong><br><code>${escape(labeled[2]!)}</code><span>→ <code>${escape(labeled[3]!)}</code></span></p>` : `<p>${inline(text)}</p>`);
    }
  }
  flush(); return output.join("");
}
export function practiceText(value: string): string {
  const fence = /```(?:[\w+-]+)?\s*\n([\s\S]*?)```/g;
  let output = "", cursor = 0;
  for (const match of value.matchAll(fence)) {
    output += prose(value.slice(cursor, match.index)) + `<pre><code>${escape(match[1]!.trimEnd())}</code></pre>`;
    cursor = match.index! + match[0].length;
  }
  return output + prose(value.slice(cursor));
}
export function practiceArtifact(artifact: { format: "text" | "table" | "code"; content: string }): string {
  if (artifact.format === "code") {
    const content = artifact.content.replace(/^```[^\n]*\n|\n```$/g, "");
    const problem = content.match(/^((?:def\s+)?[A-Za-z_]\w*\([^\n]+\)[^\n]*)\n\s*\.\.\.\s*\n\n(Example \d+:[\s\S]+)$/);
    if (problem) return `<pre><code>${escape(signature(problem[1]!))}</code></pre>${practiceText(problem[2]!)}`;
    // Some earlier generated artifacts mix a one-line signature with prose rules.
    const mixed = content.match(/^((?:def\s+)?[A-Za-z_]\w*\([^\n]+\)[^\n]*)\n+(?=(?:Return|Raise|Inputs?|Ignore|Require|Clip|All)\b)([\s\S]+)$/);
    return mixed ? `<pre><code>${escape(signature(mixed[1]!))}</code></pre>${practiceText(mixed[2]!)}` : `<pre><code>${escape(content.includes("\n") ? content : signature(content))}</code></pre>`;
  }
  if (artifact.format === "table") {
    const rows = artifact.content.trim().split(/\r?\n/);
    if (rows.length >= 2 && rows[0]!.includes("|") && /^\s*\|?[\s:|-]+\|?\s*$/.test(rows[1]!)) {
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map(cell => inline(cell.trim()));
      return `<div class="data-table"><table><thead><tr>${cells(rows[0]!).map(cell => `<th scope="col">${cell}</th>`).join("")}</tr></thead><tbody>${rows.slice(2).filter(Boolean).map(row => `<tr>${cells(row).map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }
  }
  return practiceText(artifact.content);
}
