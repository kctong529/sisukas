<!-- src/components/TranscriptExtractor.svelte -->
<script lang="ts">
  import * as pdfjsLib from "pdfjs-dist";
  import { createEventDispatcher } from "svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";

  type Grade = "Pass" | "Fail" | "0" | "1" | "2" | "3" | "4" | "5";

  type CourseRow = {
    code: string;
    name: string;
    grade: Grade | string; // keep string for safety
    credits: number;
    lang: string;
    date: string;
  };

  const dispatch = createEventDispatcher<{ extracted: CourseRow[] }>();

  const worker = new Worker(new URL("../pdfjs-worker.ts", import.meta.url), {
    type: "module",
  });

  pdfjsLib.GlobalWorkerOptions.workerPort = worker;

  // PDF.js worker (Vite-safe)
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  let courses: CourseRow[] = [];
  let error = "";
  let loading = false;

  type TextItemLike = {
    str: string;
    transform: number[]; // [a,b,c,d,e,f]
  };

  type TextContentLike = {
    items: TextItemLike[];
  };

  function buildLinesFromTextContent(content: TextContentLike): string[] {
    const lines = new SvelteMap<number, Array<{ text: string; x: number }>>();

    for (const item of content.items) {
      const [, , , , x, y] = item.transform;
      const yKey = Math.round(y); // bucket Y to reduce float noise

      const arr = lines.get(yKey) ?? [];
      arr.push({ text: item.str, x });
      lines.set(yKey, arr);
    }

    return Array.from(lines.entries())
      .sort((a, b) => b[0] - a[0]) // top-to-bottom
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x) // left-to-right
          .map((it) => it.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);
  }

  async function extractTextFromPdf(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = (await page.getTextContent()) as unknown as TextContentLike;

      const lines = buildLinesFromTextContent(content);

      fullText += `\n\n--- Page ${pageNum} ---\n`;
      fullText += lines.join("\n");
    }

    return fullText;
  }

  function extractCoursesAndGrades(fullText: string): CourseRow[] {
    const pages = fullText
      .split(/--- Page \d+ ---/g)
      .map((p) => p.trim())
      .filter(Boolean);

    const out: CourseRow[] = [];

    const rowRe =
      /^(?<name>.+?)\s+\((?<code>[A-Z]{2,6}-[A-Z]{0,4}\d{3,5})\)\s+(?<credits>\d+(?:\.\d+)?)\s*cr\s+(?<lang>[a-z]{2})\s+(?<grade>[0-5]|Pass|Fail)\s+(?<date>\d{1,2}\s+[A-Za-z]{3}\s+\d{4})$/i;

    const tailNoCodeRe =
      /^(?<name>.+?)\s+(?<credits>\d+(?:\.\d+)?)\s*cr\s+(?<lang>[a-z]{2})\s+(?<grade>[0-5]|Pass|Fail)\s+(?<date>\d{1,2}\s+[A-Za-z]{3}\s+\d{4})$/i;

    const codeOnlyRe = /^\((?<code>[A-Z]{2,6}-[A-Z]{0,4}\d{3,5})\)$/i;
    const codeSuffixOnlyRe = /^(?<suffix>[A-Z]{0,4}\d{3,5})\)$/i;

    const isJunk = (line: string): boolean =>
      /TRANSCRIPT OF RECORDS/i.test(line) ||
      /^AALTO UNIVERSITY/i.test(line) ||
      /^\d+\s*\/\s*\d+/.test(line) ||
      /^GRADING SCALES/i.test(line) ||
      /Course name and code\s+Scope\s+Lang\s+Grade\s+Date/i.test(line) ||
      /^No completed credits$/i.test(line) ||
      /^Degrees$/i.test(line) ||
      /^Study modules$/i.test(line) ||
      /^Courses$/i.test(line) ||
      /^Partially completed courses$/i.test(line) ||
      /^Grade average/i.test(line) ||
      /^Total course credits/i.test(line) ||
      /^The degree includes/i.test(line) ||
      /^Language of study/i.test(line) ||
      /^Grading scale/i.test(line);

    for (let page of pages) {
      // Fix code spacing inside a line, e.g., "ELEC- C5310" or "MS- EV0021"
      page = page.replace(/([A-Z]{2,6}-)\s+([A-Z]{0,4}\d{3,5})/g, "$1$2");

      const lines = page
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .filter((l) => !isJunk(l));

      const fixed: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const next = lines[i + 1];

        // Pattern 1: "(ELEC- 5 cr en 3 2 Dec 2025" + "C5310)"
        const brokenCodeMatch = line.match(
          /\((?<prefix>[A-Z]{2,6}-)\s+(?<credits>\d+(?:\.\d+)?)\s*cr\s+(?<lang>[a-z]{2})\s+(?<grade>[0-5]|Pass|Fail)\s+(?<date>\d{1,2}\s+[A-Za-z]{3}\s+\d{4})$/i
        );
        const suffixMatch = next?.match(codeSuffixOnlyRe);

        if (brokenCodeMatch?.groups && suffixMatch?.groups) {
          const { prefix, credits, lang, grade, date } = brokenCodeMatch.groups as Record<
            string,
            string
          >;
          const { suffix } = suffixMatch.groups as Record<string, string>;

          line = line.replace(
            /\((?<prefix>[A-Z]{2,6}-)\s+(?<credits>\d+(?:\.\d+)?)\s*cr\s+(?<lang>[a-z]{2})\s+(?<grade>[0-5]|Pass|Fail)\s+(?<date>\d{1,2}\s+[A-Za-z]{3}\s+\d{4})$/i,
            `(${prefix}${suffix}) ${credits} cr ${lang} ${grade} ${date}`
          );

          fixed.push(line);
          i++;
          continue;
        }

        // Pattern 2: "<name> 5 cr en 5 20 Feb 2025" + "(TU-A1300)"
        const tailMatch = line.match(tailNoCodeRe);
        const codeOnlyMatch = next?.match(codeOnlyRe);

        if (tailMatch?.groups && codeOnlyMatch?.groups) {
          const g1 = tailMatch.groups as Record<string, string>;
          const g2 = codeOnlyMatch.groups as Record<string, string>;
          fixed.push(`${g1.name.trim()} (${g2.code}) ${g1.credits} cr ${g1.lang} ${g1.grade} ${g1.date}`);
          i++;
          continue;
        }

        fixed.push(line);
      }

      for (const line of fixed) {
        const m = line.match(rowRe);
        if (!m?.groups) continue;
        const g = m.groups as Record<string, string>;

        out.push({
          code: g.code.trim(),
          name: g.name.trim(),
          grade: g.grade.trim(),
          credits: Number(g.credits),
          lang: g.lang.trim(),
          date: g.date.trim(),
        });
      }
    }

    // De-dup
    const seen = new SvelteSet<string>();
    return out.filter((c) => {
      const key = `${c.code}|${c.date}|${c.grade}|${c.credits}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function onFileChange(e: Event) {
    error = "";
    courses = [];

    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    loading = true;
    try {
      const fullText = await extractTextFromPdf(file);
      courses = extractCoursesAndGrades(fullText);
      dispatch("extracted", courses);
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
      // allow re-uploading the same file
      input.value = "";
    }
  }
</script>

<div class="course-extractor">
  <label class="file-picker">
    <input
      class="file-input"
      type="file"
      accept="application/pdf"
      on:change={onFileChange}
    />
    <span class="btn btn-secondary">
      Choose PDF
    </span>
  </label>

  {#if loading}
    <p class="status">Reading…</p>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if courses.length}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Grade</th>
            <th>Course</th>
            <th class="num">Cr</th>
            <th>Lang</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {#each courses as c (c.code + c.date + c.grade + c.credits)}
            <tr>
              <td class="mono">{c.code}</td>
              <td class="mono">{c.grade}</td>
              <td>{c.name}</td>
              <td class="num mono">{c.credits}</td>
              <td class="mono">{c.lang}</td>
              <td class="mono">{c.date}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else if !loading && !error}
    <p class="hint">Choose a PDF to extract course rows.</p>
  {/if}
</div>

<style>
  .course-extractor {
    display: grid;
    gap: 10px;
  }

  .file-picker {
    display: inline-flex;
    align-items: center;
    position: relative;
  }

  .file-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  /* ensure the button looks clickable when hovering input */
  .file-picker:hover .btn {
    background: rgba(0, 0, 0, 0.04);
    border-color: rgba(0, 0, 0, 0.22);
  }

  /* ---- Status blocks ---- */
  .status,
  .hint,
  .error {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.35;
  }

  .status {
    color: #4b5563;
  }

  .hint {
    color: #6b7280;
    background: #f9fafb;
    border: 1px dashed #e5e7eb;
    border-radius: 12px;
    padding: 10px 12px;
  }

  .error {
    color: #991b1b;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 12px;
    padding: 10px 12px;
    white-space: pre-wrap;
  }

  /* ---- Table ---- */
  .table-wrap {
    overflow: auto;
    border: 1px solid #e6e6e6;
    border-radius: 12px;
    background: #fff;
  }

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.92rem;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 2;

    background: #f9fafb;
    color: #374151;
    font-weight: 700;

    border-bottom: 1px solid #e5e7eb;
  }

  th,
  td {
    padding: 10px 12px;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid #f1f5f9;
  }

  tbody tr:nth-child(2n) td {
    background: #fcfcfd;
  }

  tbody tr:hover td {
    background: #f7fbff;
  }

  /* column sizing (keeps modal readable) */
  thead th:nth-child(1),
  tbody td:nth-child(1) {
    width: 120px; /* Code */
  }

  thead th:nth-child(2),
  tbody td:nth-child(2) {
    width: 70px; /* Grade */
  }

  tbody td:nth-child(3) {
    white-space: normal;
  }

  thead th:nth-child(4),
  tbody td:nth-child(4) {
    width: 70px; /* Cr */
  }

  thead th:nth-child(5),
  tbody td:nth-child(5) {
    width: 70px; /* Lang */
  }

  thead th:nth-child(6),
  tbody td:nth-child(6) {
    width: 120px; /* Date */
    white-space: nowrap;
  }

  .mono {
    font-family: inherit;
    font-size: inherit;
    white-space: nowrap;
    color: inherit;
  }

  .num {
    text-align: right;
  }

  .btn {
    display: inline-block;
    padding: 0.6rem 1.25rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: 0.2s;
    text-decoration: none;
  }

  .btn-secondary {
    background: var(--card-bg);
    color: var(--text-main);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.5rem 0.8rem;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    border-color: var(--primary);
    background: #f1f5f9;
  }

  .btn-secondary:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

</style>
