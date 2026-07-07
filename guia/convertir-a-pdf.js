const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const mdPath = path.join(__dirname, "crear-script-velocidad-normal.md");
const pdfPath = path.join(__dirname, "crear-script-velocidad-normal.pdf");
const md = fs.readFileSync(mdPath, "utf8");

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function mdToHtml(source) {
  const lines = source.split(/\r?\n/);
  let html = "";
  let inCode = false;
  let inTable = false;
  let listType = null;

  const closeList = () => {
    if (listType) {
      html += listType === "ul" ? "</ul>" : "</ol>";
      listType = null;
    }
  };

  const closeTable = () => {
    if (inTable) {
      html += "</tbody></table>";
      inTable = false;
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (!inCode) {
        closeList();
        closeTable();
        inCode = true;
        html += "<pre><code>";
      } else {
        inCode = false;
        html += "</code></pre>";
      }
      continue;
    }

    if (inCode) {
      html += escapeHtml(line) + "\n";
      continue;
    }

    if (line.startsWith("|")) {
      closeList();
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
      if (!inTable) {
        html += "<table><tbody>";
        inTable = true;
      }
      html +=
        "<tr>" +
        cells.map((c) => `<td>${inlineFormat(c)}</td>`).join("") +
        "</tr>";
      continue;
    }
    closeTable();

    if (/^---+$/.test(line.trim())) {
      closeList();
      html += "<hr>";
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html += `<h${level}>${inlineFormat(heading[2])}</h${level}>`;
      continue;
    }

    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      if (listType !== "ul") {
        closeList();
        html += "<ul>";
        listType = "ul";
      }
      html += `<li>${inlineFormat(ul[1])}</li>`;
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (listType !== "ol") {
        closeList();
        html += "<ol>";
        listType = "ol";
      }
      html += `<li>${inlineFormat(ol[1])}</li>`;
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    closeList();
    html += `<p>${inlineFormat(line)}</p>`;
  }

  closeList();
  closeTable();
  return html;
}

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Guía: crear script con velocidad normal</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; line-height: 1.55; color: #222; font-size: 11pt; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 8px; font-size: 22pt; }
    h2 { margin-top: 28px; color: #1a1a1a; font-size: 16pt; page-break-after: avoid; }
    h3 { margin-top: 20px; font-size: 13pt; page-break-after: avoid; }
    p, li { font-size: 11pt; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-size: 10pt; }
    pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 9.5pt; page-break-inside: avoid; }
    pre code { background: none; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; page-break-inside: avoid; }
    td, th { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 10pt; }
    hr { margin: 24px 0; border: none; border-top: 1px solid #ddd; }
    ul, ol { margin: 8px 0 16px; }
  </style>
</head>
<body>
${mdToHtml(md)}
</body>
</html>`;

(async () => {
  const browser = await puppeteer.launch({
    executablePath:
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    margin: { top: "20mm", bottom: "20mm", left: "18mm", right: "18mm" },
    printBackground: true,
  });
  await browser.close();
  console.log("PDF creado:", pdfPath);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
