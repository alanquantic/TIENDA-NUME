/**
 * Renderiza una descripción de texto estructurado (párrafos + listas).
 * El importador guarda cada bloque en una línea; las viñetas empiezan con "• ".
 * Server component (sin interactividad).
 */
type Block = { type: 'ul'; items: string[] } | { type: 'p'; text: string };

function toBlocks(text: string): Block[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const blocks: Block[] = [];
  for (const line of lines) {
    const isBullet = /^([•\-*]\s+)/.test(line);
    if (isBullet) {
      const content = line.replace(/^([•\-*]\s+)/, '');
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ul') last.items.push(content);
      else blocks.push({ type: 'ul', items: [content] });
    } else {
      blocks.push({ type: 'p', text: line });
    }
  }
  return blocks;
}

export function ProductDescription({ text }: { text: string }) {
  const blocks = toBlocks(text);
  return (
    <div className="space-y-3 leading-relaxed text-[hsl(var(--foreground))]/85">
      {blocks.map((b, i) =>
        b.type === 'ul' ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
    </div>
  );
}
