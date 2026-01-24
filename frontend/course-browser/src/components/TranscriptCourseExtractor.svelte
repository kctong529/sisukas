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
  <label class="picker">
    <span>Upload transcript PDF</span>
    <input type="file" accept="application/pdf" on:change={onFileChange} />
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
    gap: 0.75rem;
  }

  .picker {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 12px;
  }

  .picker input[type="file"] {
    max-width: 100%;
  }

  .status {
    margin: 0;
  }

  .error {
    margin: 0;
    color: #b00020;
    white-space: pre-wrap;
  }

  .hint {
    margin: 0;
    opacity: 0.75;
  }

  .table-wrap {
    overflow: auto;
    border: 1px solid #e6e6e6;
    border-radius: 12px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
  }

  th, td {
    padding: 0.6rem 0.7rem;
    border-bottom: 1px solid #eee;
    text-align: left;
    vertical-align: top;
  }

  thead th {
    position: sticky;
    top: 0;
    background: white;
    border-bottom: 1px solid #ddd;
    z-index: 1;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    white-space: nowrap;
  }

  .num {
    text-align: right;
  }
</style>
