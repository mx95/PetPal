/**
 * Build tracker-tcp-server/docs/API_REFERENCE.pdf from API_REFERENCE.md.
 * Uses system Chrome/Edge when available (avoids downloading Chromium).
 */
const fs = require("fs");
const path = require("path");
const { mdToPdf } = require("md-to-pdf");

const docsDir = path.join(__dirname, "..", "docs");
const input = path.join(docsDir, "API_REFERENCE.md");
const output = path.join(docsDir, "API_REFERENCE.pdf");
const stylesheet = path.join(docsDir, "api-reference-pdf.css");

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function main() {
  if (!fs.existsSync(input)) {
    console.error("Missing:", input);
    process.exit(1);
  }

  const executablePath = findBrowserExecutable();
  const pdfConfig = {
    dest: output,
    pdf_options: {
      format: "A4",
      margin: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },
      printBackground: true
    },
    stylesheet: fs.existsSync(stylesheet) ? stylesheet : undefined,
    launch_options: executablePath
      ? { executablePath, args: ["--no-sandbox", "--disable-setuid-sandbox"] }
      : { args: ["--no-sandbox", "--disable-setuid-sandbox"] }
  };

  if (executablePath) {
    console.log("Using browser:", executablePath);
  } else {
    console.log("No system browser found — md-to-pdf will use bundled Chromium (first run may download it).");
  }

  await mdToPdf({ path: input }, pdfConfig);
  console.log("Wrote", output);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
