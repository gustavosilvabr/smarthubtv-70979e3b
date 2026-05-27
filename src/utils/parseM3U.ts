import type { M3UItem } from "@/types/iptv";
import { classifyContent } from "./classifyContent";

function attr(line: string, key: string): string {
  const m = line.match(new RegExp(`${key}="([^"]*)"`));
  return m ? m[1] : "";
}

export function parseM3U(text: string): M3UItem[] {
  const lines = text.split(/\r?\n/);
  const out: M3UItem[] = [];
  let i = 0;
  let idx = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("#EXTINF")) {
      const logo = attr(line, "tvg-logo");
      const group = attr(line, "group-title") || "Outros";
      const commaIdx = line.lastIndexOf(",");
      const name = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : "Sem nome";
      // find next non-comment line as URL
      let url = "";
      let j = i + 1;
      while (j < lines.length) {
        const l = lines[j].trim();
        if (l && !l.startsWith("#")) {
          url = l;
          break;
        }
        j++;
      }
      if (url) {
        out.push({
          id: `${idx++}-${name}`,
          name,
          logo,
          group,
          url,
          type: classifyContent(group, url),
        });
      }
      i = j + 1;
    } else {
      i++;
    }
  }
  return out;
}
