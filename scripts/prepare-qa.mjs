import { copyFile, mkdir } from "node:fs/promises";
await mkdir("public/__qa", { recursive: true });
await copyFile("node_modules/axe-core/axe.min.js", "public/__qa/axe.min.js");
console.log(
  "Browser audit ready. Start the local server, then open /__qa/index.html.",
);
