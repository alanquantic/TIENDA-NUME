export type AIReportKey = 'quien-soy' | 'amor' | 'trabajo' | 'bienestar' | 'proposito';

export type AIReportProductDefinition = {
  report: AIReportKey;
  slug: string;
  name: string;
  description: string;
  label: string;
  imagePath: string;
};

export const AI_REPORT_PRODUCTS: readonly AIReportProductDefinition[] = [
  {
    report: 'quien-soy',
    slug: 'quien-soy',
    name: '¿Quién soy?',
    label: '¿Quién soy?',
    imagePath: '/images/reportes/quien-soy.png',
    description:
      'Un reporte dinámico que integra tu fecha de nacimiento y tu nombre para darte una lectura clara sobre tu esencia, tus talentos, tus aprendizajes y la forma en que tu energía se expresa hoy.',
  },
  {
    report: 'amor',
    slug: 'numerologia-en-el-amor',
    name: 'Numerología en el amor',
    label: 'Numerología en el amor',
    imagePath: '/images/reportes/numerologia-en-el-amor.png',
    description:
      'Explora cómo vives el amor, qué patrones afectivos te acompañan y qué tendencias energéticas se mueven en tu vida sentimental para ayudarte a relacionarte con más conciencia.',
  },
  {
    report: 'trabajo',
    slug: 'numerologia-en-el-trabajo',
    name: 'Numerología en el trabajo',
    label: 'Numerología en el trabajo',
    imagePath: '/images/reportes/numerologia-en-el-trabajo.png',
    description:
      'Descubre un panorama práctico sobre vocación, fortalezas profesionales, estilo de trabajo y etapas favorables para enfocar mejor tus decisiones laborales y de crecimiento.',
  },
  {
    report: 'bienestar',
    slug: 'mi-energia-vital-y-bienestar',
    name: 'Mi energía vital y bienestar',
    label: 'Mi energía vital y bienestar',
    imagePath: '/images/reportes/mi-energia-vital-y-bienestar.png',
    description:
      'Una lectura enfocada en tu equilibrio personal para reconocer desgastes, áreas de armonización y claves numerológicas que te ayuden a cuidar tu energía con mayor intención.',
  },
  {
    report: 'proposito',
    slug: 'mi-proposito-y-camino-de-vida',
    name: 'Mi propósito y camino de vida',
    label: 'Mi propósito y camino de vida',
    imagePath: '/images/reportes/mi-proposito-y-camino-de-vida.png',
    description:
      'Conecta con el sentido de tu camino, tus etapas de realización y los llamados más importantes de tu mapa numerológico para avanzar con mayor claridad en tu propósito.',
  },
] as const;

export const AI_REPORT_BY_SLUG = new Map(
  AI_REPORT_PRODUCTS.map((product) => [product.slug, product]),
);

export const AI_REPORT_BY_KEY = new Map(
  AI_REPORT_PRODUCTS.map((product) => [product.report, product]),
);

export const AI_REPORT_BY_IMAGE_PATH = new Map(
  AI_REPORT_PRODUCTS.map((product) => [product.imagePath, product]),
);

export function isAIReportKey(report: string): report is AIReportKey {
  return AI_REPORT_BY_KEY.has(report as AIReportKey);
}

export function getAIReportByImagePath(imagePath: string) {
  return AI_REPORT_BY_IMAGE_PATH.get(imagePath) ?? null;
}
