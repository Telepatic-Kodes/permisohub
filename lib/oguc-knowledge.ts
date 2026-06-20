export interface ArticuloOGUC {
  id: string
  titulo: string
  texto: string
  keywords: string[]
  categoria: 'definiciones' | 'rasantes' | 'coeficientes' | 'permisos' | 'recepciones' | 'regularizaciones' | 'distanciamientos' | 'estacionamientos'
}

export const ARTICULOS_OGUC: ArticuloOGUC[] = [
  {
    id: '1.1.2',
    titulo: 'Definiciones',
    texto: `Para los efectos de la presente Ordenanza, los términos que se indican tendrán los siguientes significados:

COEFICIENTE DE CONSTRUCTIBILIDAD (FOT - Factor de Ocupación Total): Número que multiplicado por la superficie total del predio, fija la superficie máxima posible de construir sobre él. Ejemplo: terreno 400m², FOT 0.8 → superficie máxima construida = 320m².

COEFICIENTE DE OCUPACIÓN DE SUELO (FOS - Factor de Ocupación del Suelo): Número que multiplicado por la superficie total del predio fija la superficie máxima que puede ser ocupada por las edificaciones en el nivel del terreno natural. Ejemplo: terreno 400m², FOS 0.4 → huella máxima = 160m².

RASANTE: Línea inclinada que, a partir de cualquier punto del deslinde del predio con el espacio de uso público, sube con una inclinación determinada por el Instrumento de Planificación Territorial respectivo, o en su defecto, por la OGUC. Si no hay disposición expresa: 70° (relación 2.75 horizontal / 1 vertical) medidos desde el nivel de acera.

ALTURA DE EDIFICACIÓN: Dimensión vertical de una edificación, medida desde el nivel de suelo hasta el punto más alto de la misma. No se incluyen chimeneas, antenas, ni elementos de instalaciones.

ADOSAMIENTO: Edificación que se construye pegada al deslinde del predio vecino. Requiere cumplir con la altura máxima permitida en el deslinde y acuerdo de los vecinos en muchos casos.

DISTANCIAMIENTO: Separación mínima exigida entre una edificación y los deslindes del predio o entre edificaciones dentro de un mismo predio.`,
    keywords: ['FOT', 'FOS', 'coeficiente', 'constructibilidad', 'ocupación', 'suelo', 'rasante', 'altura', 'adosamiento', 'distanciamiento', 'definición'],
    categoria: 'definiciones',
  },
  {
    id: '2.6.3',
    titulo: 'Rasantes y alturas de edificación',
    texto: `Las edificaciones no podrán sobrepasar las rasantes que se determinan a continuación:

1. Las rasantes se aplicarán en todos los deslindes del predio que no correspondan a espacios de uso público. La rasante se mide desde el nivel natural del terreno en el deslinde.

2. Cuando los Instrumentos de Planificación Territorial no establezcan otro valor, el ángulo de la rasante será de 70° (pendiente: 2.75/1), lo que equivale a: por cada metro horizontal que nos alejamos del deslinde, podemos subir 2.75 metros.

3. Para los efectos de la aplicación de las rasantes, se tomarán como referencia los puntos siguientes:
   a) En deslinde con propiedad privada: el nivel del suelo en el eje del deslinde.
   b) En deslinde con espacio público: el nivel del suelo en la línea oficial.

4. La rasante no aplica a patios interiores de predios que tengan acceso independiente desde la vía pública.

5. En los casos de terrenos en pendiente, la rasante se aplica desde el nivel del terreno natural antes de las obras de movimiento de tierra.

CÁLCULO PRÁCTICO: Si tu edificación tiene 6m de altura y el deslinde vecino está a 3m de distancia: rasante máxima en ese punto = 3m × 2.75 = 8.25m. Tu 6m está OK. Si tu edificación tiene 9m y el deslinde está a 2m: rasante = 2 × 2.75 = 5.5m. Tu 9m EXCEDE la rasante → observación probable.`,
    keywords: ['rasante', 'altura', 'deslinde', '70 grados', 'edificación', 'vecino', 'pendiente'],
    categoria: 'rasantes',
  },
  {
    id: '2.6.6',
    titulo: 'Distanciamientos mínimos',
    texto: `Los distanciamientos entre edificaciones y deslindes se regularán de la siguiente manera:

1. El distanciamiento mínimo entre una edificación y el deslinde del predio, cuando no haya adosamiento, será determinado por el Instrumento de Planificación Territorial (Plan Regulador Comunal).

2. A falta de disposición del Plan Regulador: el distanciamiento mínimo se determinará por la rasante aplicable en ese deslinde, de modo que la totalidad de la edificación quede dentro del sólido regulador.

3. DISTANCIAMIENTO ENTRE EDIFICACIONES EN UN MISMO PREDIO: No podrá ser inferior a la tercera parte de la altura de la edificación más alta, con un mínimo de 3m entre muros con vanos (ventanas) y 1.5m entre muros ciegos.

4. Para edificaciones de uso habitacional de hasta 2 pisos en zonas residenciales: el distanciamiento mínimo lateral (cuando no hay adosamiento) generalmente es de 3m según los PRC.

NOTA IMPORTANTE: Los distanciamientos varían significativamente por municipio según su Plan Regulador Comunal (PRC). Siempre verificar el PRC del municipio específico antes de diseñar.`,
    keywords: ['distanciamiento', 'separación', 'deslinde', 'vecino', 'adosamiento', 'muro', 'vano', 'ventana'],
    categoria: 'distanciamientos',
  },
  {
    id: '2.7.1',
    titulo: 'Normas sobre coeficientes de constructibilidad y ocupación de suelo',
    texto: `Los Instrumentos de Planificación Territorial establecerán los coeficientes de constructibilidad (FOT) y de ocupación de suelo (FOS) para cada zona.

ZONAS TÍPICAS EN SANTIAGO (valores referenciales — SIEMPRE verificar el PRC vigente del municipio):

ZONA RESIDENCIAL R1 (baja densidad, casas unifamiliares):
- FOS típico: 0.30 - 0.50
- FOT típico: 0.50 - 1.00
- Altura máxima típica: 2 pisos (7-9m)
- Ejemplo: Las Condes zona baja, Vitacura residencial

ZONA RESIDENCIAL R2 (densidad media, casas y edificios pequeños):
- FOS típico: 0.40 - 0.60
- FOT típico: 0.80 - 1.50
- Altura máxima típica: 3-4 pisos
- Ejemplo: Ñuñoa, Providencia zonas intermedias

ZONA RESIDENCIAL R3 (alta densidad, edificios):
- FOS típico: 0.50 - 0.70
- FOT típico: 2.00 - 4.00
- Altura máxima típica: Sin restricción o por rasante
- Ejemplo: Providencia eje Providencia, Santiago centro

ZONA COMERCIAL (C):
- FOS típico: 0.70 - 0.90
- FOT típico: 3.00 - 6.00
- Altura: Generalmente sin restricción, solo rasantes

ZONA MIXTA:
- Combinación de residencial y comercial
- FOT: 1.00 - 3.00 según ubicación

CÁLCULO:
FOT real = Superficie construida total / Superficie del predio
FOS real = Huella en planta baja / Superficie del predio

IMPORTANTE: Los pisos subterráneos generalmente no cuentan para el FOT. Terrazas descubiertas tampoco. Verificar el PRC de cada municipio.`,
    keywords: ['FOT', 'FOS', 'coeficiente', 'constructibilidad', 'ocupación', 'zona', 'R1', 'R2', 'R3', 'densidad'],
    categoria: 'coeficientes',
  },
  {
    id: '5.1.2',
    titulo: 'Solicitud de permiso de edificación — requisitos generales',
    texto: `Para obtener permiso de edificación se requiere:

1. Presentar solicitud en la DOM con los documentos del Art. 5.1.6.
2. El propietario o su representante (arquitecto con poder notarial) firma la solicitud.
3. El arquitecto proyectista debe estar habilitado en el Colegio de Arquitectos de Chile.
4. Planos firmados por los profesionales competentes (arquitecto, calculista, instaladores).

PLAZOS LEGALES DE LA DOM (Ley 21.718, vigente 2025):
- La DOM tiene 15 días hábiles para pronunciarse si el proyecto tiene Informe Favorable de Revisor Independiente.
- Sin Revisor Independiente: 30 días hábiles para primer pronunciamiento.
- Si la DOM no se pronuncia en el plazo → silencio negativo (arquitecto puede declarar denegación).
- Publicación mensual obligatoria de todos los permisos otorgados.

OBSERVACIONES DE LA DOM:
- La DOM puede emitir observaciones técnicas (no aprobaciones ni rechazos) indicando deficiencias.
- El arquitecto tiene 30 días hábiles para subsanar y volver a presentar.
- Las observaciones deben ser específicas y citar el artículo OGUC o PRC infringido.
- Si el arquitecto no está de acuerdo: puede apelar ante el MINVU Regional.`,
    keywords: ['permiso', 'edificación', 'solicitud', 'DOM', 'plazo', 'observación', 'hábiles', 'silencio', 'Ley 21718'],
    categoria: 'permisos',
  },
  {
    id: '5.1.6',
    titulo: 'Documentos para solicitar permiso de edificación',
    texto: `Para solicitar permiso de edificación se acompañarán los siguientes documentos:

DOCUMENTOS OBLIGATORIOS:
1. Formulario de solicitud (F1) con datos del propietario, arquitecto, proyecto.
2. Plano de ubicación y emplazamiento (escala 1:500 o 1:1000):
   - Indica límites del predio, construcciones existentes, norte magnético.
   - Superficie del terreno y frente a vía pública.
   - Coordenadas UTM en datum WGS84.
3. Planos de arquitectura (escala 1:50 o 1:100):
   - Plantas de todos los pisos con cotas y superficies.
   - Elevaciones (al menos 2, las más representativas).
   - Cortes (mínimo 1 longitudinal y 1 transversal).
   - Detalle de escaleras, accesibilidad.
4. Memoria de cálculo estructural (firmada por ingeniero civil calculista).
5. Especificaciones técnicas de arquitectura y especialidades.
6. Presupuesto de obra (para cálculo de derechos municipales).
7. Certificado de informaciones previas (CIP) vigente del municipio.
8. Certificado de dominio vigente del predio (CBR, no mayor a 30 días).
9. Certificado de hipotecas y gravámenes (CBR, no mayor a 30 días).

DOCUMENTOS ADICIONALES SEGÚN PROYECTO:
- Planos de instalaciones (agua potable, alcantarillado, electricidad, gas).
- Declaración de impacto vial si supera cierta superficie.
- Estudio de mecánica de suelos si el terreno lo requiere.

PARA DOM EN LÍNEA: Los documentos se suben en formato PDF. Nomenclatura esperada:
SOL_PERMISO, PLANO_UBICACION, PLANO_ARQ, MEM_CALCULO, EETT, PRESUPUESTO, CIP, CERT_DOMINIO, CERT_HIPOTECAS.`,
    keywords: ['documentos', 'planos', 'arquitectura', 'memoria', 'cálculo', 'especificaciones', 'CIP', 'dominio', 'hipotecas', 'presupuesto'],
    categoria: 'permisos',
  },
  {
    id: '5.5.1',
    titulo: 'Recepción final de obras',
    texto: `Una vez concluida la obra, el propietario debe solicitar la recepción final a la DOM.

DOCUMENTOS PARA RECEPCIÓN FINAL:
1. Formulario de solicitud de recepción final.
2. Copia del permiso de edificación original y todas sus modificaciones.
3. Certificados de instalaciones en regla:
   - Empresa sanitaria (agua potable y alcantarillado) — ESSAL, SMAPA, Aguas Andinas, etc.
   - SEC (superintendencia de electricidad y combustibles) para instalaciones eléctricas y gas.
4. Planos de obras ejecutadas (si hubo modificaciones durante la obra).
5. Libro de obras (cuando corresponde — obras con ITO).

PROCESO:
1. La DOM designa inspector para visita a terreno.
2. Inspector verifica que obra coincide con planos aprobados.
3. Verifica funcionamiento de instalaciones (agua, electricidad, evacuación).
4. Verifica accesibilidad universal si aplica.
5. Si hay observaciones: se levanta acta con plazo para subsanar.
6. Si está conforme: se otorga Certificado de Recepción Final.

PLAZOS:
- Sin Certificado de Recepción Final, el inmueble no puede ser habitado ni transferido legalmente.
- La DOM tiene 30 días hábiles para inspeccionar desde la solicitud.

RECEPCIÓN PARCIAL: Para obras en etapas, se puede solicitar recepción parcial de las partes concluidas.`,
    keywords: ['recepción', 'final', 'obra', 'certificado', 'inspector', 'instalaciones', 'SEC', 'sanitaria', 'libro', 'ITO'],
    categoria: 'recepciones',
  },
  {
    id: '5.8.1',
    titulo: 'Regularización de construcciones',
    texto: `Las construcciones ejecutadas sin permiso o en disconformidad con el permiso pueden regularizarse.

REQUISITOS PARA REGULARIZAR:
1. La construcción debe existir y ser verificable.
2. Debe cumplir con las normas de la OGUC y del PRC vigente al momento de la regularización.
3. Si no cumple el PRC actual pero existía antes de la fecha de entrada en vigencia del PRC: puede regularizarse con declaración jurada.
4. Las obras no regularizables son: las que no cumplen normas de seguridad estructural o habitabilidad mínima.

DOCUMENTOS:
- Solicitud de regularización (formulario específico).
- Plano de levantamiento arquitectónico (de lo existente, no de lo proyectado).
- Memoria de cálculo estructural si supera 2 pisos o tiene carga especial.
- Declaración jurada notarial del propietario.
- Certificado de dominio vigente.

DERECHOS MUNICIPALES:
- Se paga el 1.5% del presupuesto de obra para regularizaciones.
- Multa por construcción sin permiso: 0-100% del valor de derechos según caso.

Ley 21.718 simplificó el proceso de regularizaciones de viviendas sociales y construcciones antiguas.`,
    keywords: ['regularización', 'sin permiso', 'clandestina', 'levantamiento', 'declaración jurada', 'multa', 'existente'],
    categoria: 'regularizaciones',
  },
  {
    id: '4.5.1',
    titulo: 'Estacionamientos y dotación',
    texto: `Las edificaciones deben contemplar estacionamientos de vehículos en la cantidad que fije el Instrumento de Planificación Territorial.

DOTACIONES MÍNIMAS REFERENCIALES (según tabla del PRC — varían por municipio):

VIVIENDA:
- Hasta 60m² útiles: 0 estacionamientos exigidos en muchas comunas
- 60-140m² útiles: 1 estacionamiento por vivienda (general)
- Más de 140m² útiles: 1.5 a 2 estacionamientos por vivienda
- Vivienda social DFL2: frecuentemente exonerada

COMERCIO:
- Local comercial: 1 estacionamiento cada 20-40m² de superficie comercial
- Supermercado/Mall: 1 cada 25m² de venta
- Restaurant: 1 cada 5-10 asientos

OFICINAS:
- 1 estacionamiento cada 30-50m² de superficie útil

ACCESIBILIDAD (universal):
- Mínimo 1 estacionamiento para personas con discapacidad cada 25 estacionamientos normales.
- Dimensiones mínimas: 3.5m ancho × 5.0m largo (vs 2.5m × 5.0m normal).
- Señalización obligatoria.

NOTA: Los PRC de cada municipio pueden exigir más o exonerar según el caso. Las zonas cercanas al Metro pueden tener reducciones en Santiago.`,
    keywords: ['estacionamiento', 'parking', 'dotación', 'vehículo', 'discapacidad', 'accesibilidad', 'DFL2'],
    categoria: 'estacionamientos',
  },
  {
    id: '4.2.1',
    titulo: 'Accesibilidad universal — condiciones generales',
    texto: `Las edificaciones de uso público y colectivo deben cumplir condiciones de accesibilidad universal conforme a la Ley 20.422 y la OGUC.

EDIFICIOS QUE DEBEN CUMPLIR:
- Todo edificio de uso público (hospitales, colegios, municipalidades, centros comerciales).
- Edificios de vivienda colectiva de 3+ pisos: deben tener ascensor o rampas.
- Recintos de más de 50 personas simultáneas.

REQUISITOS CLAVE:
1. RAMPAS: Pendiente máxima 12% (1:8), ancho mínimo 1.20m libre entre pasamanos.
2. PUERTAS: Ancho mínimo 0.90m libre de paso.
3. ASCENSORES: Dimensiones interiores mínimas 1.10m × 1.40m. Botonera hasta 1.20m de altura.
4. BAÑOS ACCESIBLES: 1 baño por sexo con dimensiones que permitan silla de ruedas (cuadro de 1.5m × 1.5m).
5. ESTACIONAMIENTO: Ver Art. 4.5.1.
6. SEÑALÉTICA: En Braille y contraste visual donde corresponda.

CONSECUENCIAS DE NO CUMPLIR:
- Observación frecuente de la DOM.
- Sin recepción final si no se subsana.
- Multas de la Superintendencia.`,
    keywords: ['accesibilidad', 'discapacidad', 'rampa', 'ascensor', 'puerta', 'baño', 'Ley 20422', 'universal'],
    categoria: 'permisos',
  },
  {
    id: '5.1.15',
    titulo: 'Modificaciones a permisos — obras mayores y menores',
    texto: `Durante la ejecución de las obras pueden producirse modificaciones al proyecto original.

MODIFICACIONES MENORES (no requieren nuevo permiso):
- Cambios que no alteran el número de pisos, superficie total, fachadas principales, estructura ni destino.
- Redistribución de espacios interiores manteniendo superficies y destinos.
- Cambio de materialidad interior.

MODIFICACIONES MAYORES (requieren permiso de modificación):
- Aumento de superficie construida.
- Cambio de destino.
- Modificaciones de fachada principal.
- Alteración de la estructura.
- Cualquier cambio que afecte el cumplimiento de la OGUC.

PROCEDIMIENTO DE MODIFICACIÓN:
1. Solicitar permiso de modificación en la DOM.
2. Presentar planos que muestren claramente: "existente" vs "modificación".
3. La DOM tiene los mismos plazos que para el permiso original.
4. No se pueden ejecutar las modificaciones hasta obtener el permiso.

Construcción sin permiso de modificación = obra clandestina = multa + obligación de regularizar o demoler.`,
    keywords: ['modificación', 'permiso', 'cambio', 'obra', 'mayor', 'menor', 'fachada', 'superficie', 'destino'],
    categoria: 'permisos',
  },
]

export function getArticulosRelevantes(query: string, limit = 6): ArticuloOGUC[] {
  const q = query.toLowerCase()

  const scored = ARTICULOS_OGUC.map((art) => {
    let score = 0
    // Exact keyword match
    for (const kw of art.keywords) {
      if (q.includes(kw.toLowerCase())) score += 3
    }
    // Title match
    if (q.includes(art.titulo.toLowerCase())) score += 5
    // Article ID match (e.g. "artículo 2.6.3")
    if (q.includes(art.id)) score += 10
    // Category keyword match
    if (q.includes(art.categoria)) score += 2
    // Partial keyword match
    for (const kw of art.keywords) {
      if (kw.toLowerCase().includes(q.slice(0, 5))) score += 1
    }
    return { art, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.art)
}

export function getContextoOGUC(query: string): string {
  const articulos = getArticulosRelevantes(query)

  if (articulos.length === 0) {
    // Return general context if no specific match
    return ARTICULOS_OGUC.slice(0, 3).map(a =>
      `**Art. ${a.id} — ${a.titulo}**\n${a.texto}`
    ).join('\n\n---\n\n')
  }

  return articulos.map(a =>
    `**Art. ${a.id} — ${a.titulo}**\n${a.texto}`
  ).join('\n\n---\n\n')
}
