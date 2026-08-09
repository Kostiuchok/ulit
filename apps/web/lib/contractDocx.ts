import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

const SECTION_HEADING_RE = /^\d+\.\s+[А-ЯЇЄІ']/;

export async function buildContractDocxBlob(fullText: string): Promise<Blob> {
  const lines = fullText.split("\n");
  const [titleLine, ...rest] = lines;

  const paragraphs = rest.map((line) => {
    if (line.trim() === "") return new Paragraph({ text: "" });
    return new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: line, bold: SECTION_HEADING_RE.test(line.trim()) })],
    });
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: titleLine, heading: HeadingLevel.TITLE }),
          ...paragraphs,
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
