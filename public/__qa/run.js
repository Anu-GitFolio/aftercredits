const report = document.querySelector("#report");
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
document.querySelector("#run").onclick = async () => {
  document.querySelector("#run").disabled = true;
  const results = [],
    errors = [],
    widths = [320, 360, 390, 430, 768, 1024, 1440, 1920];
  const paths = [
    "/",
    "/explore",
    "/mood-arc",
    "/title/arrival",
    "/title/severance",
    "/collection",
    "/about",
    "/privacy",
  ];
  try {
    for (const path of paths) {
      const frame = document.createElement("iframe");
      frame.title = "Audit " + path;
      frame.style.height = "1000px";
      frame.style.border = "0";
      frame.style.width = "1440px";
      document.querySelector("#frames").append(frame);
      frame.src = path;
      report.textContent = "Loading " + path;
      await new Promise((r) => (frame.onload = r));
      report.textContent = "Waiting for app " + path;
      const doc = frame.contentDocument;
      for (let i = 0; i < 100 && !doc.querySelector("#header nav"); i++)
        await pause(100);
      if (!doc.querySelector("#header nav"))
        throw new Error("Page did not initialize: " + path);
      if (path === "/explore")
        for (let i = 0; i < 100 && doc.querySelector('[aria-busy="true"]'); i++)
          await pause(100);
      report.textContent = "Waiting for fonts " + path;
      await doc.fonts.ready;
      report.textContent = "Loading accessibility engine " + path;
      const script = doc.createElement("script");
      script.src = "/__qa/axe.min.js";
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () =>
          reject(new Error("Could not load accessibility engine"));
        doc.head.append(script);
      });
      for (const theme of ["dark", "light"])
        for (const width of widths) {
          doc.documentElement.dataset.theme = theme;
          frame.style.width = width + "px";
          await pause(40);
          const overflow =
            doc.documentElement.scrollWidth >
            doc.documentElement.clientWidth + 1;
          const issues = overflow
            ? [...doc.querySelectorAll("main *,header *,footer *")]
                .filter((e) => {
                  const b = e.getBoundingClientRect();
                  return (
                    b.width && b.right > doc.documentElement.clientWidth + 1
                  );
                })
                .slice(0, 8)
                .map((e) => e.className)
            : [];
          const row = { path, theme, width, overflow, issues };
          if (width === 390 || width === 1440) {
            const axe = await frame.contentWindow.axe.run(doc, {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21aa"],
              },
            });
            row.accessibility = axe.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.map((n) => ({
                target: n.target,
                summary: n.failureSummary,
              })),
            }));
          }
          results.push(row);
          report.textContent = JSON.stringify(
            {
              status: "running",
              completed: results.length,
              failures: results.filter(
                (r) => r.overflow || r.accessibility?.length,
              ),
            },
            null,
            2,
          );
        }
      frame.remove();
    }
  } catch (e) {
    errors.push(e.message);
  }
  report.textContent = JSON.stringify(
    {
      status: "complete",
      checks: results.length,
      accessibilityChecks: results.filter((r) => r.accessibility).length,
      failures: results.filter((r) => r.overflow || r.accessibility?.length),
      errors,
    },
    null,
    2,
  );
  document.querySelector("#run").disabled = false;
};
