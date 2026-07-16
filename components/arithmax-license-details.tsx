import type { ReactNode } from 'react';

function Accent({ children }: { children: ReactNode }) {
  return <strong className="font-bold text-[hsl(var(--primary))]">{children}</strong>;
}

function DiamondItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-1 text-sm text-blue-600">
        ◆
      </span>
      <span>{children}</span>
    </li>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-b border-[hsl(var(--border))] pb-3 text-xl font-bold tracking-tight sm:text-2xl">
      {children}
    </h3>
  );
}

export function ArithmaxLicenseDetails() {
  return (
    <div className="mt-10 space-y-10 leading-relaxed text-[hsl(var(--foreground))]/85">
      <section className="space-y-5">
        <h3 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">
          Lo más importante, en claro
        </h3>

        <ul className="space-y-4">
          <DiamondItem>
            <Accent>Plataforma 100% en la nube.</Accent> Sin instalaciones ni conflictos entre Mac y
            PC. Acceso directo desde el navegador.
          </DiamondItem>
          <DiamondItem>
            <Accent>Bilingüe: español e inglés.</Accent> Interfaz y contenidos disponibles en dos
            idiomas para ampliar el alcance y facilitar el trabajo con clientes internacionales.
          </DiamondItem>
          <DiamondItem>
            <Accent>Nuevas entidades y guardado inteligente.</Accent> Ahora puedes{' '}
            <Accent>crear y guardar:</Accent>
            <ul className="mt-3 space-y-3 pl-3">
              <li className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-1 text-red-500">▲</span>
                <span><Accent>Parejas</Accent> (para sinastría)</span>
              </li>
              <li className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-1 text-red-500">▲</span>
                <span><Accent>Grupos</Accent> (equipos, familias, círculos de trabajo/estudio)</span>
              </li>
              <li className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-1 text-red-500">▲</span>
                <span>
                  <Accent>Nombres de personas, empresas o productos</Accent> para calcular y conservar
                  su <Accent>vibración numerológica</Accent>
                </span>
              </li>
            </ul>
            <p className="mt-3">
              Todo queda <Accent>almacenado en la nube</Accent> y accesible en sesiones posteriores.
            </p>
          </DiamondItem>
          <DiamondItem>
            <Accent>Módulos de tiempo ampliados.</Accent> Se incorporan el{' '}
            <Accent>Círculo de tiempo de pareja</Accent> y el{' '}
            <Accent>Círculo de tiempo de grupo</Accent> para seguir ciclos, hitos y tendencias de forma
            visual y comparativa.
          </DiamondItem>
          <DiamondItem>
            <Accent>Experiencia de uso mejorada.</Accent> <Accent>Glosario flotante</Accent> con
            definiciones contextuales, <Accent>modo oscuro</Accent>, y una interfaz depurada para
            sesiones largas y lectura cómoda.
          </DiamondItem>
          <DiamondItem>
            <Accent>Más rápida y más segura.</Accent> Motor interno refactorizado, validaciones
            adicionales y controles de acceso con <Accent>login</Accent> reforzado para proteger la
            información de cada usuario.
          </DiamondItem>
        </ul>
      </section>

      <section className="space-y-6">
        <SectionTitle>¿Qué hay de nuevo y por qué importa?</SectionTitle>

        <ol className="list-decimal space-y-8 pl-6 marker:text-[hsl(var(--foreground))]">
          <li className="pl-1">
            <h4 className="mb-3 text-lg font-bold">En la nube: trabaja sin fricciones</h4>
            <div className="space-y-3">
              <p>Antes: instalación local con posibles diferencias por sistema operativo.</p>
              <p>
                Ahora: <Accent>acceso web</Accent> con tus credenciales, actualizaciones unificadas y
                cero mantenimiento por tu parte. Ideal para consultorías en movimiento, sesiones
                remotas y equipos distribuidos.
              </p>
            </div>
          </li>

          <li className="pl-1">
            <h4 className="mb-3 text-lg font-bold">Velocidad y estabilidad en cada cálculo</h4>
            <p>
              La reprogramación del núcleo y la optimización de consultas reducen tiempos de espera y
              hacen más consistente el flujo de trabajo. Las <Accent>comprobaciones</Accent>{' '}
              incorporadas ayudan a minimizar errores y a mantener la{' '}
              <Accent>integridad de los datos.</Accent>
            </p>
          </li>

          <li className="pl-1">
            <h4 className="mb-3 text-lg font-bold">
              Guardado de <Accent>parejas, grupos y nombres</Accent>
            </h4>
            <ul className="space-y-4">
              <DiamondItem>
                <Accent>Parejas y grupos:</Accent> archiva configuraciones, reanuda análisis, compara
                evolución y genera seguimiento temporal con los nuevos{' '}
                <Accent>círculos de tiempo.</Accent>
              </DiamondItem>
              <DiamondItem>
                <Accent>Nombres (personas, empresas, productos):</Accent> registra, calcula y{' '}
                <Accent>conserva la vibración numerológica</Accent> de cada nombre para reutilizarla en
                estudios futuros o reportes.
              </DiamondItem>
            </ul>
          </li>

          <li className="pl-1">
            <h4 className="mb-3 text-lg font-bold">Círculos de tiempo de pareja y de grupo.</h4>
            <p className="mb-4">
              Visualiza periodos, ciclos y puntos sensibles en una línea de tiempo clara. Útil para:
            </p>
            <ul className="space-y-3">
              <DiamondItem>Delimitar etapas clave (inicios, cierres, transiciones).</DiamondItem>
              <DiamondItem>Preparar sesiones con enfoque anual/mensual.</DiamondItem>
              <DiamondItem>
                Comparar tendencias entre integrantes de un grupo o en la dinámica de pareja.
              </DiamondItem>
            </ul>
          </li>

          <li className="pl-1">
            <h4 className="mb-3 text-lg font-bold">Glosario flotante: aprender sin salir del flujo</h4>
            <p>
              Mientras trabajas, tienes <Accent>definiciones al vuelo</Accent> de conceptos y métricas.
              Ayuda a estandarizar la lectura, acelera la curva de aprendizaje y evita consultas
              externas.
            </p>
          </li>

          <li className="pl-1">
            <h4 className="mb-3 text-lg font-bold">Seguridad y acceso</h4>
            <p>
              El <Accent>login</Accent> mejorado y el almacenamiento en la nube resguardan tus datos.
              Las sesiones son más estables y los registros quedan disponibles cuando los necesites.
            </p>
          </li>
        </ol>
      </section>

      <section className="space-y-5">
        <SectionTitle>Beneficios concretos para tu práctica</SectionTitle>
        <ul className="space-y-3">
          <DiamondItem>
            <Accent>Continuidad total:</Accent> reabre parejas, grupos y nombres guardados sin rehacer
            trabajo.
          </DiamondItem>
          <DiamondItem>
            <Accent>Productividad:</Accent> cálculos más ágiles + glosario contextual = menos
            interrupciones y más foco.
          </DiamondItem>
          <DiamondItem>
            <Accent>Escalabilidad:</Accent> trabaja desde donde estés, con la misma versión siempre
            actualizada.
          </DiamondItem>
          <DiamondItem>
            <Accent>Alcance internacional:</Accent> interfaz en <Accent>español e inglés</Accent> para
            colaborar con más clientes.
          </DiamondItem>
        </ul>
      </section>

      <aside className="border-l-4 border-blue-500 bg-[hsl(var(--muted))] px-5 py-6 sm:px-6">
        <h3 className="mb-3 text-lg font-bold">Disponibilidad y uso</h3>
        <p>
          <Accent>ARITHMAX 3.0</Accent> está listo para usarse desde el navegador, con acceso por
          credenciales. Si vienes de una versión anterior, podemos acompañarte en la{' '}
          <Accent>actualización</Accent> y en la <Accent>organización de tus registros</Accent> para que
          empieces a aprovechar las nuevas funciones desde el primer día.
        </p>
      </aside>
    </div>
  );
}
