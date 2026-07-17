import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Falta DATABASE_URL');

type Product = { id: string; slug: string; name: string; description: string | null };

const nameCorrections: Record<string, string> = {
  'agenda-numerologica-2026-fisica': 'Agenda Numerológica 2026 Física',
  'combo-niveles-1-2-3-y-4-pregrabados': 'COMBO Niveles 1, 2, 3 y 4 – Pregrabados',
  'licencia-software-arithmax-1-ano': 'Licencia Software ARITHMAX 1 año',
  'licencia-software-arithmax-3-anos': 'Licencia Software ARITHMAX 3 años',
  'modulo-6-tecnicas-de-alineacion-y-acompanamiento':
    'MÓDULO 6 – Técnicas de Alineación y Acompañamiento',
  'reporte-nuestro-antidoto-de-pareja': 'Reporte: Nuestro Antídoto de Pareja',
};

function commonCorrections(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/El\s+La Agenda/g, 'La Agenda')
    .replace(/orientan\s+;/g, 'orientan;')
    .replace(/armonía\s+,/g, 'armonía,')
    .replace(/por mi mismo/g, 'por mí mismo')
    .replace(/para mi gracias/g, 'para mí gracias')
    .replace(/\bQue esperar\b/g, 'Qué esperar')
    .replace(/\bQue impulsar\b/g, 'Qué impulsar')
    .replace(/¿Qué viniste a prender\?/g, '¿Qué viniste a aprender?')
    .replace(/[ \t]+([,;:.!?])/g, '$1');
}

function fixDescription(slug: string, original: string | null) {
  if (!original) return original;
  let text = commonCorrections(original);

  switch (slug) {
    case 'combo-niveles-1-2-3-y-4-pregrabados':
      text = text
        .replace(/^\?+\u200d?\?*\s+Imparte:/m, '👩‍🏫 Imparte:')
        .replace(/^\?\s+Actividades,/m, '📝 Actividades,')
        .replace(/^Que incluye$/m, '¿Qué incluye?');
      break;

    case 'certificacion-completa-numerologia':
      text = text
        .replace('Conviértele en un Consultor Numerológico', 'Conviértete en consultor numerológico')
        .replace('ésta maravillosa técnica', 'esta maravillosa técnica')
        .replace('no sólo a nivel personal, si no también', 'no solo a nivel personal, sino también')
        .replace('6 módulos de 30 hr c/u', '6 módulos de 30 h cada uno')
        .replace('material virtual, didáctica', 'material virtual, material didáctico')
        .replace(/WhatsApp, etc$/, 'WhatsApp, etc.')
        .replace('en base al entendimiento', 'con base en el entendimiento')
        .replace(
          /Realiza consultas acertadas de numerología para terceros\.*$/m,
          'Realiza consultas acertadas de numerología para terceros.',
        );
      break;

    case 'diseno-de-nombres-con-numerologia':
      text = text
        .replace(/^\?Requisitos:/m, '📋 Requisitos:')
        .replace(/^-\s*/gm, '• ')
        .replace('especialista en Numerología, creador de Numerología Cotidiana', 'especialista en numerología, creadora de Numerología Cotidiana')
        .replace(/^Incluye:$/m, '🎁 ¿Qué incluye?')
        .replace(/^\?MANUAL/m, '📘 MANUAL')
        .replace(/^\?FORMATOS/m, '📝 FORMATOS')
        .replace(/^\?ACCESO A LA PRESENTACIÓN/m, '📊 ACCESO A LA PRESENTACIÓN')
        .replace(/^\?ACTIVIDADES/m, '✅ ACTIVIDADES')
        .replace(/^\?CLASES/m, '🎥 CLASES')
        .replace(/^\?MÁS DE 30 HORAS/m, '⏱️ MÁS DE 30 HORAS')
        .replace(/^\?\s*ACCESO AL TALLER/m, '🔐 ACCESO AL TALLER')
        .replace(/^\?NO INCLUYE/m, '⚠️ NO INCLUYE');
      break;

    case 'kit-primavera':
      text = text.replace(/Kit Primavera\.\s+\?\s+/, 'Kit Primavera. ');
      break;

    case 'libro-numerologia-cotidiana':
      text = text.replace('Sábado 10 de enero 2026', 'sábado 10 de enero de 2026');
      break;

    case 'membresia-180':
    case 'membresia-360':
      text = text
        .replace(/^•\s+–\s+/gm, '• ')
        .replace(/Acceso a Artículos/g, 'Acceso a artículos')
        .replace(/Horóscopo Anual/g, 'horóscopo anual')
        .replace(/Reporte de Año de Pareja/g, 'Reporte de año de pareja')
        .replace(/Reporte Conocete/g, 'Reporte Conócete');
      break;

    case 'modulo-1-quien-soy-inicia-en-la-numerologia':
    case 'modulo-2-cual-es-mi-mision-mi-camino-de-exito-profesional-y-vocacional':
    case 'modulo-3-activa-tu-brujula-sincroniza-tu-energia-en-el-tiempo-perfecto-para-lograr-tus-propositos':
    case 'modulo-4-la-tabla-del-destino-la-historia-de-tu-vida-esta-escrita-en-tu-nombre-numerologia-predictiva':
    case 'modulo-5-compatibilidad-numerologica-de-las-relaciones-construye-y-potencializa-vinculos-sanos-y-exitosos':
    case 'modulo-6-tecnicas-de-alineacion-y-acompanamiento':
      text = text
        .replace(/^\?+\u200d?\?*\s+Imparte:/m, '👩‍🏫 Imparte:')
        .replace(/^\?\s+Actividades,/m, '📝 Actividades,')
        .replace(/^(?:Que incluye|Incluye:)$/m, '🎁 ¿Qué incluye?')
        .replace(/^Requisitos:/m, '📋 Requisitos:')
        .replace(/en base al entendimiento/g, 'con base en el entendimiento')
        .replace(/SESIÓN DE PREGUNTAS Y RESPUESTAS AL FINAL DE LA SESION/g, 'SESIÓN DE PREGUNTAS Y RESPUESTAS AL FINAL DE LA SESIÓN');

      if (slug.startsWith('modulo-2-')) {
        text = text
          .replace(/código alfa-numérico/g, 'código alfanumérico')
          .replace(/letras de tu Nombre completo/g, 'letras de tu nombre completo')
          .replace('la marca que vienes a dejar el.', 'la marca que vienes a dejar en él.');
      }
      if (slug.startsWith('modulo-3-')) {
        text = text
          .replace(
            /Los ciclos numerológicos son predecibles y progresivos y se mueve\w*/,
            'Los ciclos numerológicos son predecibles y progresivos y se mueven',
          )
          .replace('Todos los años, meses, semanas y días, tienen', 'Todos los años, meses, semanas y días tienen')
          .replace('así que el identificarlas nos sirve', 'así que identificarlas nos sirve');
      }
      if (slug.startsWith('modulo-5-')) {
        text = text
          .replace('La sinastría o compatibilidad numerológica, es', 'La sinastría o compatibilidad numerológica es')
          .replace('SESIONES EN GRABADAS AUTODIDÁCTAS', 'SESIONES GRABADAS AUTODIDACTAS');
      }
      if (slug.startsWith('modulo-6-')) {
        text = text
          .replace('Queremos Consultores extraordinarios', 'Queremos consultores extraordinarios')
          .replace('sepan de Números', 'sepan de números')
          .replace('Seres Humanos íntegros', 'seres humanos íntegros')
          .replace('MIÉRCOLES A LAS 11AM', 'MIÉRCOLES A LAS 11 A. M.');
      }
      break;

    case 'numerathum-oraculo-365-agenda-numerologica-2026-digital-pdf':
      text = text
        .replace(/^\?\s+Ideal/m, '💡 Ideal')
        .replace('Ve como funciona aquí -->', 'Ve cómo funciona aquí →');
      break;

    case 'planeador-numerologico-2026-digital-pdf':
      text = text.replace('cada día del 2026', 'cada día de 2026');
      break;

    case 'reporte-semestral-2026':
      text = text
        .replace('de enero a junio 2026', 'de enero a junio de 2026')
        .replace('Que Sí podemos hacer', 'Qué sí podemos hacer')
        .replace('Que No podemos hacer', 'Qué no podemos hacer')
        .replace(/^\?\s+¿Cómo se entrega\?/m, '📥 ¿Cómo se entrega?')
        .replace(/^\?\s+¿Tienes dudas\?/m, '💬 ¿Tienes dudas?');
      break;

    case 'reporte-ano-personal-de-la-pareja-2026':
      text = text
        .replace(/2025/g, '2026')
        .replace('Año Universal 9', 'Año Universal 1')
        .replace('y por otro lado, tú', 'y, por otro lado, tú')
        .replace('Sinastría Numerológica', 'sinastría numerológica')
        .replace('Nombres y Fechas de Nacimiento', 'nombres y fechas de nacimiento');
      break;

    case 'reporte-el-amor-segun-tu-ano-personal':
      text = text
        .replace(/¡Obtén el tuyo hoy mismo!*/, '¡Obtén el tuyo hoy mismo!')
        .replace(/si estas solter@/g, 'si estás solter@')
        .replace(/si estas en una relación/g, 'si estás en una relación');
      break;

    case 'reporte-la-herida-que-sano-con-mi-pareja':
      text = text.replace(
        'la conducta desarmónica que no he podido resolver por mí mismo y que mi maestro me muestra',
        'la conducta desarmónica que no has podido resolver por ti mismo y que tu maestro te muestra',
      );
      break;

    case 'reporte-numerologia-de-pareja':
      text = text.replace(
        'la conducta desarmónica que no he podido resolver por mí mismo y que mi maestro me muestra',
        'la conducta desarmónica que no has podido resolver por ti mismo y que tu maestro te muestra',
      );
      break;

    case 'taller-numerologia-de-parejas':
      text = text
        .replace(/^\?\s+¿Qué tipo/m, '💞 ¿Qué tipo')
        .replace(/^\?\s+¿Qué incluye/m, '🎁 ¿Qué incluye')
        .replace(/^\?\s+Temario:/m, '📚 Temario:')
        .replace(/^\?\s+(¿)/gm, '🔹 $1')
        .replace(/^\?\ufe0f?\s+Formato:/m, '💻 Formato:')
        .replace(/^\?\s+Impartido por:/m, '👩‍🏫 Impartido por:')
        .replace(/\s+\?✨$/m, ' ❤️✨');
      break;

    case 'taller-numerologia-de-las-casas-y-los-espacios':
      text = text
        .replace(/casa\?\s+\?\?\s+Descubre/, 'casa? 🏡✨ Descubre')
        .replace(/Espacios\.\s+\?$/m, 'Espacios. 🌿')
        .replace(/Maestra de los Números!\s+\?\?$/m, 'Maestra de los Números! 👩‍🏫🔢')
        .replace(/^\?\s+/gm, '🔹 ')
        .replace(/^Que Incluye:/m, '🎁 ¿Qué incluye?')
        .replace(/^\?MANUAL/m, '📘 MANUAL')
        .replace(/^\?FORMATOS/m, '📝 FORMATOS')
        .replace(/^\?ACCESO A LA PRESENTACIÓN/m, '📊 ACCESO A LA PRESENTACIÓN')
        .replace(/^\?ACTIVIDADES/m, '✅ ACTIVIDADES')
        .replace(/^\?CLASES/m, '🎥 CLASES')
        .replace(/^\?\s*ACCESO AL TALLER/m, '🔐 ACCESO AL TALLER')
        .replace(/^\?NO INCLUYE/m, '⚠️ NO INCLUYE');
      break;
  }

  if (slug.startsWith('licencia-software-arithmax-')) {
    text = text.replace(/Arithmax/g, 'ARITHMAX').replace(/Aritmax/g, 'ARITHMAX');
  }

  return text;
}

async function main() {
  const sql = postgres(connectionString!, { prepare: false });
  const products = await sql<Product[]>`
    select id, slug, name, description
    from products
    where deleted_at is null
    order by name
  `;

  const changes = products
    .map((product) => ({
      ...product,
      nextName: nameCorrections[product.slug] ?? product.name,
      nextDescription: fixDescription(product.slug, product.description),
    }))
    .filter(
      (product) =>
        product.nextName !== product.name || product.nextDescription !== product.description,
    );

  await sql.begin(async (transaction) => {
    for (const product of changes) {
      await transaction`
        update products
        set
          name = ${product.nextName},
          description = ${product.nextDescription},
          updated_at = now()
        where id = ${product.id}
      `;
    }
  });

  console.log(`Productos corregidos: ${changes.length}`);
  for (const product of changes) console.log(`- ${product.slug}`);
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
