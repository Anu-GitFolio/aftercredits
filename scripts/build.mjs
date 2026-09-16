import { build, transform } from "esbuild";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
await mkdir("dist/server", { recursive: true });
await cp("public", "dist/client", {
  recursive: true,
  filter: (p) => !p.includes("__qa"),
});
await build({
  entryPoints: ["server/index.js"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outfile: "dist/server/index.js",
  minify: true,
});
await build({
  entryPoints: ["public/app.js"],
  bundle: true,
  format: "esm",
  target: "es2022",
  outfile: "dist/client/app.js",
  minify: true,
});
await writeFile(
  "dist/client/style.css",
  (
    await transform(await readFile("public/style.css", "utf8"), {
      loader: "css",
      minify: true,
    })
  ).code,
);
console.log("Built browser assets and Worker.");
