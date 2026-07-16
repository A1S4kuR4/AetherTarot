/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const sourceDir = path.resolve(
  __dirname,
  "../../../node_modules/@chinese-fonts/syst/dist/SourceHanSerifCN",
);
const targetDir = path.resolve(__dirname, "../public/fonts/aether-serif");

function main() {
  if (!fs.existsSync(sourceDir)) {
    console.error(
      "Source Han Serif package not found. Run: npm install -D @chinese-fonts/syst",
    );
    process.exit(1);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const cssSource = path.join(sourceDir, "result.css");
  const cssTarget = path.join(targetDir, "aether-serif.css");

  if (!fs.existsSync(cssSource)) {
    console.error("result.css not found in", sourceDir);
    process.exit(1);
  }

  let css = fs.readFileSync(cssSource, "utf-8");

  // Replace font-family name so it matches our @font-face reference.
  css = css.replace(
    /font-family:"Source Han Serif CN VF"/g,
    'font-family:"AetherSerif"',
  );

  // The package CSS uses relative URLs like url("./xxx.woff2").
  // When served from /fonts/aether-serif/aether-serif.css, these resolve
  // to /fonts/aether-serif/xxx.woff2, which is correct.

  fs.writeFileSync(cssTarget, css);

  // Copy all woff2 files.
  const files = fs.readdirSync(sourceDir);
  let copied = 0;
  for (const file of files) {
    if (file.endsWith(".woff2")) {
      fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
      copied += 1;
    }
  }

  // Write metadata.
  const packageJsonPath = path.resolve(
    __dirname,
    "../../../node_modules/@chinese-fonts/syst/package.json",
  );
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const metadata = {
    source: "@chinese-fonts/syst",
    version: packageJson.version,
    license: packageJson.license,
    originalFont: "Source Han Serif CN VF",
    originalLicense: "SIL Open Font License 1.1",
    copiedFiles: copied,
  };
  fs.writeFileSync(
    path.join(targetDir, "aether-serif.meta.json"),
    JSON.stringify(metadata, null, 2),
  );

  console.log(`Copied ${copied} font files to ${targetDir}`);
  console.log(`CSS written to ${cssTarget}`);

  // Build the share-card-only embed CSS.
  const buildEmbedPath = path.resolve(__dirname, "./build-share-font-embed.js");
  require(buildEmbedPath);
}

main();
