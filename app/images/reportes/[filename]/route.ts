import React from 'react';
import { ImageResponse } from 'next/og';
import { AI_REPORT_PRODUCTS } from '@/lib/ai-report-products';

export const runtime = 'edge';

function getProductByFilename(filename: string) {
  return (
    AI_REPORT_PRODUCTS.find((product) => product.imagePath.endsWith(`/${filename}`)) ?? null
  );
}

type Style = React.CSSProperties;

const styles = {
  root: {
    height: '100%',
    width: '100%',
    display: 'flex',
    position: 'relative',
    overflow: 'hidden',
    background:
      'radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 32%), linear-gradient(135deg, #fbf5ff 0%, #f2e8ff 48%, #ead9ff 100%)',
    color: '#3f2457',
    fontFamily: 'sans-serif',
  } satisfies Style,
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    background:
      'radial-gradient(circle at 85% 18%, rgba(161, 74, 255, 0.22), transparent 18%), radial-gradient(circle at 12% 88%, rgba(214, 151, 255, 0.3), transparent 24%)',
  } satisfies Style,
  ring: {
    position: 'absolute',
    right: -90,
    top: -70,
    width: 380,
    height: 380,
    borderRadius: 9999,
    border: '2px solid rgba(123, 63, 191, 0.14)',
  } satisfies Style,
  glow: {
    position: 'absolute',
    left: -60,
    bottom: -120,
    width: 320,
    height: 320,
    borderRadius: 9999,
    background: 'rgba(123, 63, 191, 0.08)',
  } satisfies Style,
  frame: {
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '88px 84px',
    width: '100%',
    height: '100%',
  } satisfies Style,
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    maxWidth: 860,
  } satisfies Style,
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
  } satisfies Style,
  brandMark: {
    width: 74,
    height: 74,
    borderRadius: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '3px solid #7b3fbf',
    color: '#7b3fbf',
    fontSize: 40,
    fontWeight: 700,
    background: 'rgba(255,255,255,0.7)',
  } satisfies Style,
  brandText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } satisfies Style,
  brandTitle: {
    fontSize: 46,
    fontWeight: 700,
    color: '#7b3fbf',
  } satisfies Style,
  brandSubtitle: {
    fontSize: 28,
    color: '#7f6796',
  } satisfies Style,
  pill: {
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 9999,
    padding: '14px 24px',
    fontSize: 28,
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: 'uppercase',
    background: 'rgba(123, 63, 191, 0.1)',
    color: '#7b3fbf',
  } satisfies Style,
  heading: {
    display: 'flex',
    fontSize: 86,
    lineHeight: 1.05,
    fontWeight: 700,
  } satisfies Style,
  body: {
    display: 'flex',
    fontSize: 34,
    lineHeight: 1.35,
    color: '#5f4b73',
    maxWidth: 930,
  } satisfies Style,
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 24,
  } satisfies Style,
  footerText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    color: '#7f6796',
  } satisfies Style,
  footerLine: {
    fontSize: 28,
  } satisfies Style,
  footerHint: {
    fontSize: 24,
  } satisfies Style,
  cta: {
    display: 'flex',
    padding: '18px 28px',
    borderRadius: 28,
    background: '#7b3fbf',
    color: '#fff',
    fontSize: 28,
    fontWeight: 600,
  } satisfies Style,
};

function el(
  tag: keyof React.JSX.IntrinsicElements,
  style: Style,
  children?: React.ReactNode,
) {
  return React.createElement(tag, { style }, children);
}

export async function GET(
  _request: Request,
  context: { params: { filename: string } },
) {
  const product = getProductByFilename(context.params.filename);

  if (!product) {
    return new Response('Not found', { status: 404 });
  }

  return new ImageResponse(
    el(
      'div',
      styles.root,
      [
        el('div', styles.overlay),
        el('div', styles.ring),
        el('div', styles.glow),
        el(
          'div',
          styles.frame,
          [
            el(
              'div',
              styles.stack,
              [
                el(
                  'div',
                  styles.brandRow,
                  [
                    el('div', styles.brandMark, 'N'),
                    el(
                      'div',
                      styles.brandText,
                      [
                        el('div', styles.brandTitle, 'numerología cotidiana'),
                        el('div', styles.brandSubtitle, 'Reporte IA personalizado'),
                      ],
                    ),
                  ],
                ),
                el('div', styles.pill, 'Reporte IA'),
                el('div', styles.heading, product.label),
                el('div', styles.body, product.description),
              ],
            ),
            el(
              'div',
              styles.footer,
              [
                el(
                  'div',
                  styles.footerText,
                  [
                    el('div', styles.footerLine, 'tienda.numerologia-cotidiana.com'),
                    el('div', styles.footerHint, 'Lectura numerológica digital'),
                  ],
                ),
                el('div', styles.cta, 'Disponible en tienda'),
              ],
            ),
          ],
        ),
      ],
    ),
    {
      width: 1200,
      height: 1200,
    },
  );
}
