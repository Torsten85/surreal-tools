import fs from "node:fs/promises";
const pkgJson = await Bun.file("./package.json").json();

const external = Array.from(
  new Set([
    ...Object.keys(pkgJson.dependencies || {}),
    ...Object.keys(pkgJson.devDependencies || {}),
    ...Object.keys(pkgJson.peerDependencies || {}),
  ])
);

const outdir = "dist";

try {
  await fs.rm(outdir, {
    recursive: true,
  });
} catch {
  // do nothing
}

const result = await Bun.build({
  entrypoints: ["src/cli.ts", "src/index.ts"],
  outdir,
  splitting: true,
  target: "node",
  sourcemap: "linked",
  external,
});

result.logs.forEach((log) => console.info(log));
