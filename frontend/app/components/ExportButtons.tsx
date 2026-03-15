"use client";

import { useCallback } from "react";
import { FileDown, FileText } from "lucide-react";
import type { Artifact } from "../hooks/useChat";

interface ExportButtonsProps {
  markdownContent: string;
  artifacts?: Artifact[];
  disabled?: boolean;
}

function artifactToText(artifact: Artifact): string {
  const lines: string[] = [`### ${artifact.title}`];
  const d = artifact.data;

  switch (artifact.type) {
    case "competitive_landscape": {
      const items = Array.isArray(d) ? d : [];
      for (const c of items) {
        lines.push(
          `- **${c.name}** (${c.category || "N/A"}) — Funding: ${c.funding || "N/A"}, Strength: ${c.strength || "N/A"}`,
        );
        if (c.positioning) lines.push(`  Positioning: ${c.positioning}`);
        if (c.key_features?.length)
          lines.push(`  Features: ${c.key_features.join(", ")}`);
      }
      break;
    }
    case "trend_chart": {
      lines.push(`Trend direction: ${d.trend_direction || "N/A"}`);
      for (const s of d.signals || []) {
        lines.push(`- ${s.label}: ${s.value}/100 (${s.category || ""})`);
      }
      break;
    }
    case "pricing_table": {
      const items = Array.isArray(d) ? d : [];
      for (const p of items) {
        lines.push(
          `- **${p.name}**: ${p.model || ""} — From ${p.starting_price || "N/A"}, Enterprise: ${p.enterprise_price || "N/A"}, Free tier: ${p.free_tier ? "Yes" : "No"}`,
        );
      }
      break;
    }
    case "sentiment_scorecard": {
      const items = Array.isArray(d) ? d : [];
      for (const s of items) {
        lines.push(
          `- **${s.category}**: ${s.score}/10 (${s.sentiment}) — ${s.detail || ""}`,
        );
      }
      break;
    }
    case "messaging_matrix": {
      const items = Array.isArray(d) ? d : [];
      for (const m of items) {
        lines.push(`- **${m.name}**`);
        lines.push(`  Official: ${m.official_positioning || "N/A"}`);
        lines.push(`  Perception: ${m.user_perception || "N/A"}`);
        lines.push(`  Gap: ${m.gap || "N/A"}`);
      }
      break;
    }
    default:
      lines.push(JSON.stringify(d, null, 2));
  }
  return lines.join("\n");
}

export default function ExportButtons({
  markdownContent,
  artifacts = [],
  disabled,
}: ExportButtonsProps) {
  const buildFullContent = useCallback(() => {
    let content = markdownContent;
    if (artifacts.length > 0) {
      content += "\n\n---\n\n## Artifacts\n\n";
      for (const a of artifacts) {
        content += artifactToText(a) + "\n\n";
      }
    }
    return content;
  }, [markdownContent, artifacts]);

  const exportMarkdown = useCallback(() => {
    const content = buildFullContent();
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildFullContent]);

  const exportPDF = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    // Collect links for a clickable sources appendix
    const links: { text: string; url: string }[] = [];
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

    const fullContent = buildFullContent();
    const lines = fullContent.split("\n");

    const ensureSpace = (needed: number) => {
      if (y + needed > 275) {
        doc.addPage();
        y = 20;
      }
    };

    for (const line of lines) {
      // Extract links from this line
      let match: RegExpExecArray | null;
      const regex = new RegExp(linkRegex.source, "g");
      while ((match = regex.exec(line)) !== null) {
        links.push({ text: match[1], url: match[2] });
      }

      // Detect heading level
      const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
      const isHeading = !!headingMatch;
      const headingLevel = headingMatch ? headingMatch[1].length : 0;

      // Clean markdown formatting for PDF text
      const clean = line
        .replace(/^#{1,6}\s+/, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^[-*]\s+/, "\u2022 ")
        .replace(/^\d+\.\s+/, (m) => m);

      if (!clean.trim() && !isHeading) {
        y += 2;
        continue;
      }

      if (isHeading) {
        ensureSpace(12);
        if (y > 25) y += 3;
        const sizes: Record<number, number> = { 1: 16, 2: 14, 3: 12, 4: 11, 5: 10, 6: 10 };
        doc.setFontSize(sizes[headingLevel] || 12);
        doc.setFont("helvetica", "bold");
      } else if (clean.startsWith("\u2022")) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
      } else {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
      }

      const wrapped = doc.splitTextToSize(clean, maxWidth);
      for (const wline of wrapped) {
        ensureSpace(6);
        doc.text(wline, margin + (clean.startsWith("\u2022") ? 0 : 0), y);
        y += isHeading ? 6 : 4.5;
      }
      if (isHeading) y += 1;
    }

    // Deduplicated sources appendix with clickable links
    const uniqueLinks = Array.from(
      new Map(links.map((l) => [l.url, l])).values(),
    );
    if (uniqueLinks.length > 0) {
      ensureSpace(20);
      y += 6;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Sources", margin, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      for (const link of uniqueLinks) {
        ensureSpace(10);
        const label = `\u2022 ${link.text}`;
        const labelWrapped = doc.splitTextToSize(label, maxWidth);
        for (const wl of labelWrapped) {
          doc.text(wl, margin, y);
          y += 4;
        }
        // Add the URL as clickable blue text
        doc.setTextColor(59, 130, 246);
        const urlWrapped = doc.splitTextToSize(`  ${link.url}`, maxWidth - 4);
        for (const wu of urlWrapped) {
          ensureSpace(5);
          doc.textWithLink(wu, margin + 4, y, { url: link.url });
          y += 4;
        }
        doc.setTextColor(0, 0, 0);
        y += 1;
      }
    }

    doc.save(`research-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [buildFullContent]);

  if (!markdownContent) return null;

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        onClick={exportMarkdown}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
      >
        <FileText className="h-3.5 w-3.5" />
        Export Markdown
      </button>
      <button
        type="button"
        onClick={exportPDF}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
      >
        <FileDown className="h-3.5 w-3.5" />
        Export PDF
      </button>
    </div>
  );
}
