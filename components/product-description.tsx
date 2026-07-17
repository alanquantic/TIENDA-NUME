/**
 * Renderiza una descripción de texto estructurado (párrafos + listas).
 * El importador guarda cada bloque en una línea; las viñetas empiezan con "• ".
 * Server component (sin interactividad).
 */
import type { ReactNode } from 'react';

type ListItem = { text: string; nested: boolean };

type Block =
  | { type: 'ul'; items: ListItem[] }
  | { type: 'checklist'; items: string[] }
  | { type: 'numbered'; number: string; text: string }
  | { type: 'moduleTitle'; text: string }
  | { type: 'subtitle'; text: string }
  | { type: 'p'; text: string }
  | { type: 'promo'; text: string };

const PROMO_MESSAGES = [
  'RECIBE EN LA COMPRA DE LA AGENDA 1 MES GRATIS DE NUMERATHUM',
  'ADEMÁS INCLUYE LA AGENDA NUMEROLÓGICA 2026 DIGITAL PDF',
];

function isPromoMessage(text: string) {
  const normalizedText = text.replace(/\s+/g, ' ').toLocaleUpperCase('es-MX');
  return PROMO_MESSAGES.some((message) => normalizedText.includes(message));
}

function isSubtitleLine(text: string) {
  const withoutLeadingSymbol = text.replace(/^[^\p{L}\p{N}¿¡]+/u, '').trim();
  const normalized = withoutLeadingSymbol
    .replace(/\s*[\p{Extended_Pictographic}\uFE0F]+$/u, '')
    .trim();

  if (normalized.length === 0 || normalized.length > 100) return false;
  return normalized.endsWith(':') || (normalized.startsWith('¿') && normalized.endsWith('?'));
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderStyledText(
  text: string,
  highlightTerms: readonly string[],
  italicTerms: readonly string[],
  subtitleTerms: readonly string[],
): ReactNode {
  const terms = [...highlightTerms, ...italicTerms, ...subtitleTerms];
  const urlPattern = 'https?:\\/\\/[^\\s]+';
  if (terms.length === 0 && !/https?:\/\//i.test(text)) return text;

  const sortedTerms = [...terms].sort((a, b) => b.length - a.length);
  const termPattern = sortedTerms.map(escapeRegExp).join('|');
  const pattern = new RegExp(`(${termPattern ? `${termPattern}|` : ''}${urlPattern})`, 'gi');
  const normalizedHighlights = new Set(
    highlightTerms.map((term) => term.toLocaleLowerCase('es-MX')),
  );
  const normalizedItalics = new Set(italicTerms.map((term) => term.toLocaleLowerCase('es-MX')));
  const normalizedSubtitles = new Set(
    subtitleTerms.map((term) => term.toLocaleLowerCase('es-MX')),
  );

  return text.split(pattern).map((part, index) => {
    const normalizedPart = part.toLocaleLowerCase('es-MX');

    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="break-all font-medium text-[hsl(var(--fuchsia))] underline-offset-4 hover:underline"
        >
          {part}
        </a>
      );
    }

    const isHighlighted = normalizedHighlights.has(normalizedPart);
    const isItalic = normalizedItalics.has(normalizedPart);
    const isSubtitle = normalizedSubtitles.has(normalizedPart);

    if (isSubtitle) {
      return (
        <strong key={index} className="font-bold text-[hsl(var(--primary))]">
          {part}
        </strong>
      );
    }

    if (isHighlighted && isItalic) {
      return (
        <strong key={index} className="font-bold text-[hsl(var(--foreground))]">
          <em>{part}</em>
        </strong>
      );
    }

    if (isHighlighted) {
      return (
        <strong key={index} className="font-bold text-[hsl(var(--foreground))]">
          {part}
        </strong>
      );
    }

    if (isItalic) {
      return <em key={index}>{part}</em>;
    }

    return part;
  });
}

function toBlocks(text: string): Block[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim().replace(/\u00a0/g, ' '))
    .filter(Boolean);

  const blocks: Block[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (isPromoMessage(line)) {
      blocks.push({ type: 'promo', text: line.replace(/^([•\-*]\s+)/, '') });
      continue;
    }

    if (line.startsWith('§ ')) {
      blocks.push({ type: 'moduleTitle', text: line.slice(2) });
      continue;
    }

    if (line.startsWith('✅')) {
      const isStandaloneCheck = line === '✅' && Boolean(lines[index + 1]);
      const content = isStandaloneCheck ? lines[index + 1] : line.replace(/^✅\s*/, '');
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'checklist') last.items.push(content);
      else blocks.push({ type: 'checklist', items: [content] });
      if (isStandaloneCheck) index += 1;
      continue;
    }

    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      blocks.push({ type: 'numbered', number: numberedMatch[1], text: numberedMatch[2] });
      continue;
    }

    const isStandaloneBullet = /^[•\-*]$/.test(line);
    if (isStandaloneBullet && lines[index + 1]) {
      const content = lines[index + 1].replace(/^([•\-*]\s*)/, '');
      const last = blocks[blocks.length - 1];
      const item = { text: content, nested: false };
      if (last && last.type === 'ul') last.items.push(item);
      else blocks.push({ type: 'ul', items: [item] });
      index += 1;
      continue;
    }

    const isBullet = /^([•◦○\-*]\s+)/.test(line);
    if (isBullet) {
      const nested = /^[◦○]/.test(line);
      const content = line.replace(/^([•◦○\-*]\s+)/, '');
      const last = blocks[blocks.length - 1];
      const item = { text: content, nested };
      if (last && last.type === 'ul') last.items.push(item);
      else blocks.push({ type: 'ul', items: [item] });
    } else if (isSubtitleLine(line)) {
      blocks.push({ type: 'subtitle', text: line });
    } else {
      blocks.push({ type: 'p', text: line });
    }
  }
  return blocks;
}

export function ProductDescription({
  text,
  highlightTerms = [],
  italicTerms = [],
  subtitleTerms = [],
}: {
  text: string;
  highlightTerms?: readonly string[];
  italicTerms?: readonly string[];
  subtitleTerms?: readonly string[];
}) {
  const blocks = toBlocks(text);
  return (
    <div className="space-y-3 leading-relaxed text-[hsl(var(--foreground))]/85">
      {blocks.map((b, i) =>
        b.type === 'ul' ? (
          <ul
            key={i}
            className="list-disc space-y-3 pl-6 marker:font-bold marker:text-[hsl(var(--primary))]"
          >
            {b.items.map((item, j) => (
              <li key={j} className={item.nested ? 'ml-6 list-[circle]' : undefined}>
                {renderStyledText(item.text, highlightTerms, italicTerms, subtitleTerms)}
              </li>
            ))}
          </ul>
        ) : b.type === 'checklist' ? (
          <ul key={i} className="space-y-1">
            {b.items.map((it, j) => (
              <li key={j} className="flex items-start gap-2">
                <span aria-hidden="true">✅</span>
                <span>{renderStyledText(it, highlightTerms, italicTerms, subtitleTerms)}</span>
              </li>
            ))}
          </ul>
        ) : b.type === 'numbered' ? (
          <div key={i} className="flex items-start gap-2">
            <span className="shrink-0">{b.number}.</span>
            <p className="min-w-0 flex-1">
              {renderStyledText(b.text, highlightTerms, italicTerms, subtitleTerms)}
            </p>
          </div>
        ) : b.type === 'moduleTitle' ? (
          <h3
            key={i}
            className="rounded-lg border-l-4 border-[hsl(var(--primary))] bg-[hsl(var(--primary-soft))] px-4 py-3 font-bold text-[hsl(var(--primary))]"
          >
            {b.text}
          </h3>
        ) : b.type === 'subtitle' ? (
          <p key={i} className="pt-2 font-bold text-[hsl(var(--primary))]">
            {renderStyledText(b.text, highlightTerms, italicTerms, subtitleTerms)}
          </p>
        ) : b.type === 'promo' ? (
          <aside
            key={i}
            className="relative overflow-hidden rounded-xl border border-[hsl(var(--accent)/0.55)] bg-[hsl(var(--accent)/0.12)] px-5 py-4 shadow-sm"
            role="note"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1.5 bg-[hsl(var(--accent))]"
            />
            <p className="font-bold leading-snug text-[hsl(var(--foreground))] sm:text-lg">
              {renderStyledText(b.text, highlightTerms, italicTerms, subtitleTerms)}
            </p>
          </aside>
        ) : (
          <p key={i}>{renderStyledText(b.text, highlightTerms, italicTerms, subtitleTerms)}</p>
        ),
      )}
    </div>
  );
}
