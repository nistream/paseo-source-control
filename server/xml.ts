// Small non-validating reader for SVN's bounded XML responses. No DTD/external entities.
export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}
export function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
    const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    return named[entity] ?? String.fromCodePoint(Number.parseInt(entity.slice(entity.startsWith("#x") ? 2 : 1), entity.startsWith("#x") ? 16 : 10));
  });
}
export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: "document", attrs: {}, children: [], text: "" };
  const stack = [root];
  const tokens = xml.match(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<[^>]*>|[^<]+/g) ?? [];
  for (const token of tokens) {
    const parent = stack.at(-1)!;
    if (token.startsWith("<?") || token.startsWith("<!--")) continue;
    if (token.startsWith("<![CDATA[")) { parent.text += token.slice(9, -3); continue; }
    if (token.startsWith("<!")) throw new Error("Unsupported XML declaration");
    if (token.startsWith("</")) {
      if (stack.length < 2 || stack.pop()!.name !== token.slice(2, -1).trim()) throw new Error("Malformed SVN XML");
    } else if (token.startsWith("<")) {
      const name = /^<([^\s/>]+)/.exec(token)?.[1];
      if (!name) throw new Error("Malformed SVN XML");
      const attrs: Record<string, string> = {};
      for (const match of token.matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[match[1]!] = decodeXml(match[2] ?? match[3] ?? "");
      const node: XmlNode = { name, attrs, children: [], text: "" };
      parent.children.push(node);
      if (!token.endsWith("/>")) stack.push(node);
    } else parent.text += decodeXml(token);
  }
  if (stack.length !== 1 || root.children.length !== 1) throw new Error("Malformed SVN XML");
  return root.children[0]!;
}
export function descendants(node: XmlNode, name: string): XmlNode[] {
  return node.children.flatMap((child) => [...(child.name === name ? [child] : []), ...descendants(child, name)]);
}
export const childText = (node: XmlNode, name: string): string | null => node.children.find((child) => child.name === name)?.text ?? null;
