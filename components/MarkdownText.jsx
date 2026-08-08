// Parser de markdown liviano para respuestas de IA — SIN dangerouslySetInnerHTML.
// El texto de la IA nunca se interpreta como HTML: se parsea a tokens y cada
// token se envuelve en un elemento React (<strong>, <em>, <li>, <p>...) que
// React renderiza como nodo de texto normal. Aunque la IA devolviera literal
// "<script>...</script>" dentro de la respuesta, llega como texto plano a
// un hijo de React y se escapa automáticamente — nunca se ejecuta como
// markup. Esto es lo que hace seguro no usar dangerouslySetInnerHTML.
//
// Cubre los casos que la IA de este proyecto realmente usa: encabezados
// (#, ##, ###), negrita (**texto**), cursiva (*texto*), listas con "-" o
// "*" y listas numeradas ("1. "), separadores (---) y párrafos.

function parseInline(text, keyPrefix) {
  const nodes = [];
  const regex = /(\*\*.+?\*\*|\*.+?\*)/g;
  let lastIndex = 0;
  let match;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b-${i++}`} style={{ color: "#3D1F0A", fontWeight: 700 }}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={`${keyPrefix}-i-${i++}`}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function parseBlocks(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") { i++; continue; }

    if (/^-{3,}$/.test(line.trim())) { blocks.push({ type: "hr" }); i++; continue; }

    const headerMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headerMatch) {
      blocks.push({ type: `h${headerMatch[1].length}`, text: headerMatch[2].trim() });
      i++; continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const pLines = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,3})\s+/.test(lines[i]) && !/^-{3,}$/.test(lines[i].trim()) && !/^[-*]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i])) {
      pLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "p", lines: pLines });
  }
  return blocks;
}

const HEADING_BASE = { fontFamily: "'Baloo 2', cursive", color: "var(--color-primary)", margin: "14px 0 6px" };
const STYLES = {
  h1: { ...HEADING_BASE, fontSize: 17, fontWeight: 800 },
  h2: { ...HEADING_BASE, fontSize: 15, fontWeight: 700 },
  h3: { ...HEADING_BASE, fontSize: 13.5, fontWeight: 700 },
  p: { margin: "0 0 12px", lineHeight: 1.7 },
  list: { margin: "0 0 12px", paddingLeft: 20, lineHeight: 1.7 },
  li: { marginBottom: 4 },
  hr: { border: "none", borderTop: "1.5px solid #FFE4D6", margin: "14px 0" },
};

export default function MarkdownText({ text }) {
  if (!text) return null;
  const blocks = parseBlocks(text);

  return (
    <div>
      {blocks.map((block, bi) => {
        const key = `b-${bi}`;
        if (block.type === "hr") return <hr key={key} style={STYLES.hr} />;
        if (block.type === "h1" || block.type === "h2" || block.type === "h3") {
          const Tag = block.type === "h1" ? "h3" : block.type === "h2" ? "h4" : "h5";
          return <Tag key={key} style={STYLES[block.type]}>{parseInline(block.text, key)}</Tag>;
        }
        if (block.type === "ul") {
          return (
            <ul key={key} style={STYLES.list}>
              {block.items.map((item, ii) => <li key={`${key}-${ii}`} style={STYLES.li}>{parseInline(item, `${key}-${ii}`)}</li>)}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={key} style={STYLES.list}>
              {block.items.map((item, ii) => <li key={`${key}-${ii}`} style={STYLES.li}>{parseInline(item, `${key}-${ii}`)}</li>)}
            </ol>
          );
        }
        // párrafo — los saltos de línea originales se conservan como <br/>
        return (
          <p key={key} style={STYLES.p}>
            {block.lines.flatMap((line, li) => [
              ...(li > 0 ? [<br key={`${key}-br-${li}`} />] : []),
              ...parseInline(line, `${key}-${li}`),
            ])}
          </p>
        );
      })}
    </div>
  );
}
