# Seed list — Strip centers y power centers en Chile (pre-work Fase 18)

**Estado:** PRE-WORK. La Fase 18 ("Competencia por Formato", requirement COMPE-04) todavía no está planificada ni ejecutada — este documento es investigación exploratoria para dejarle una base de partida, no una lista lista para cargar en producción.

**Por qué existe este documento:** `COMPE-04` (`.planning/REQUIREMENTS.md`) exige que la detección de strip center / power center use "una lista curada a mano de centros conocidos en Chile (mantenida por el equipo), dado que no existe tag OSM ni fuente pública con direcciones para estos formatos". `ARCHITECTURE.md` confirma que ningún nodo/way de OpenStreetMap está etiquetado como strip o power center en Chile, y que el único dato previo (`RESEARCH-MERCADO-CENTROS-COMERCIALES.md`) es un conteo agregado de la Cámara Chilena de Centros Comerciales (277 activos: 53 malls / 76 power centers / 70 strip centers / 68 stand-alone / 10 outlets) sin direcciones ni API. `FEATURES.md` marca esto explícitamente como "unresolved" para v1.7 y pide una decisión de Requirements sobre el fallback. Esta lista es ese fallback en construcción: un seed manual, con fuente verificable por fila, priorizando RM porque `mercado_locales_listings` (la tabla contra la que esto eventualmente cruzará) está confirmada RM-only en alcance.

## Método

Búsqueda web extensiva (30+ queries) más lectura directa de páginas fuente (fetch), cruzando:
- Sitios propios de administradoras/desarrolladoras de strip/power centers (Punta Blanca, BTG Pactual Renta Comercial, Cimenta, Más Center/IFB, Espacio Urbano, Cenco Malls, Parque Arauco).
- Prensa de negocios (Diario Financiero, La Tercera Pulso, El Mercurio vía terceros, The Clinic, Meganoticias, G5 Noticias, El Diario Inmobiliario).
- El mapa de socios de la Cámara Chilena de Centros Comerciales (`camaracentroscomerciales.cl/mapa-de-santiago`), que lista centros por comuna — usado como índice de nombres a verificar, no como fuente de formato (el mapa no etiqueta strip/power/mall por sí solo; la clasificación se hizo cruzando cada nombre contra su fuente propia).

**No se usó** ningún LLM ni inferencia para completar direcciones, operadores o nombres que las fuentes no dieran explícitamente. Donde la dirección exacta no apareció en ninguna fuente, la celda dice **"no confirmada"** en vez de una calle inventada. Donde un nombre aparece solo mencionado de pasada (ej. un artículo que dice "el strip center de Unimarc en Ñuñoa" sin más detalle), se dejó como lead de confianza baja, no se subió a confianza alta.

## Definiciones de trabajo (Chile), confirmadas vía fuentes

- **Strip center**: formato pequeño, generalmente en esquinas de alto tráfico vehicular, edificio comercial aislado (no mall cerrado) con una o más tiendas ancla (farmacia, banco o supermercado), administrado como una unidad. Rangos de superficie citados varían por fuente: "no más de 6.000 m²" (paráfrasis de nota de prensa sobre Cámara de Centros Comerciales) vs. "4 o más locales, GLA de 400 a 7.000 m²" (paráfrasis de otra nota citando a Colliers). Tratar estos números como orden de magnitud, no como umbral duro verificado por fetch directo — la nota fuente (`camaracentroscomerciales.cl/el-boom-de-los-strip-centers-en-sanhattan...`) devolvió 404 al momento de esta investigación; el dato viene de un snippet de búsqueda, no de lectura directa del artículo.
- **Power center**: hasta dos anclas retail, 400+ estacionamientos (superficie + subterráneo), ~40 locales pequeños, puede incluir cine, construcción de 8.000–15.000 m² útiles (misma fuente/caveat que arriba). Cenco Malls usa "Power Center" como una de sus 4 categorías propias (junto a super-regional, regional, y "neighborhood/vecinal"), lo que sugiere que la industria chilena sí usa el término formalmente, no solo como calco de EE.UU.
- Ambos formatos son **open-air, sin estructura de mall cerrado** — esto es lo que los distingue de "Mall Plaza X", "Open Plaza X", "Cenco X" (regional/super-regional) y "Arauco [Ciudad]" (regional), que SÍ son malls cerrados o semi-cerrados y quedaron **excluidos** de las tablas de abajo aunque aparecieran en el mapa de la Cámara.

## Tabla 1 — Strip centers (Región Metropolitana)

| Nombre | Operador/Cadena | Comuna | Dirección | Fuente | Confianza |
|---|---|---|---|---|---|
| Punta Blanca Maipú (Los Pajaritos) | Punta Blanca Inversiones | Maipú | Av. Los Pajaritos 1.948 | [puntablanca.cl/comercial](https://puntablanca.cl/comercial) | Alta |
| Punta Blanca Pajaritos | Punta Blanca Inversiones | Maipú | Av. Pajaritos 2.872 | [puntablanca.cl/comercial](https://puntablanca.cl/comercial) | Alta |
| Punta Blanca Irarrázaval | Punta Blanca Inversiones | Ñuñoa | Av. Irarrázaval 2.401 | [puntablanca.cl/comercial/irarrazaval](https://puntablanca.cl/comercial/irarrazaval) | Alta |
| Punta Blanca Antonio Varas | Punta Blanca Inversiones | Ñuñoa | Av. Antonio Varas 2.284 | [puntablanca.cl/comercial](https://puntablanca.cl/comercial) | Alta |
| Punta Blanca San Bernardo | Punta Blanca Inversiones | San Bernardo | Av. Padre Hurtado 14.529 | [puntablanca.cl/comercial/san-bernardo](https://puntablanca.cl/comercial/san-bernardo) | Alta |
| Punta Blanca Avenida Perú | Punta Blanca Inversiones | Recoleta | Av. Perú 805 | [puntablanca.cl/comercial/avenida-peru](https://puntablanca.cl/comercial/avenida-peru) | Alta |
| Punta Blanca Talagante | Punta Blanca Inversiones | Talagante | Av. Bernardo O'Higgins 1.116 | [puntablanca.cl/comercial](https://puntablanca.cl/comercial) | Alta |
| Punta Blanca Ciudad Empresarial | Punta Blanca Inversiones | Huechuraba | Av. del Parque 4.023 | [puntablanca.cl/comercial](https://puntablanca.cl/comercial) | Alta |
| Plaza Don Carlos | Fondo BTG Pactual Renta Comercial | La Reina | Príncipe de Gales 8.531 (esquina Carlos Ossandón) | [btgpactual.cl/rentacomercial/activos/don-carlos](https://btgpactual.cl/rentacomercial/activos/don-carlos/) | Alta |
| Paseo Tobalaba I | Fondo BTG Pactual Renta Comercial | Peñalolén | Av. Tobalaba 11.835 | [btgpactual.cl/rentacomercial/activos/tobalaba-i](https://btgpactual.cl/rentacomercial/activos/tobalaba-i/) | Alta |
| Paseo Tobalaba II | Fondo BTG Pactual Renta Comercial | Peñalolén | Av. Tobalaba 11.855 | [btgpactual.cl/rentacomercial/activos/tobalaba-ii](https://btgpactual.cl/rentacomercial/activos/tobalaba-ii/) | Alta |
| Paseo Maipú II | Fondo BTG Pactual Renta Comercial | Maipú | Av. Tres Poniente 2.600 | [btgpactual.cl/rentacomercial/activos/maipu-ii](https://btgpactual.cl/rentacomercial/activos/maipu-ii/) | Alta |
| Plaza La Fuente | Fondo BTG Pactual Renta Comercial | Macul | Macul 2.555 | [btgpactual.cl/rentacomercial/activos/la-fuente](https://btgpactual.cl/rentacomercial/activos/la-fuente/) | Alta |
| Plaza Vivaceta | Fondo BTG Pactual Renta Comercial | Independencia | Fermín Vivaceta 957 | [btgpactual.cl/rentacomercial/activos/vivaceta](https://btgpactual.cl/rentacomercial/activos/vivaceta/) | Alta |
| Plaza San Pío | Fondo BTG Pactual Renta Comercial (¿vendido?) | Vitacura | Esquina Pío XI / Av. Vitacura — número exacto no confirmado | Snippet de búsqueda de `btgpactual.cl/rentacomercial/activos/san-pio/` (la URL directa devolvió 404 al hacer fetch — posible activo vendido; BTG vendió 3 strip centers en Vitacura/Las Condes/Lo Barnechea a fines de 2024 según [thelatinamericanlawyer.com](https://thelatinamericanlawyer.com/be-assists-btg-pactual-in-the-sale-of-strip-centers/)) | Media |
| Cimenta Strip Center Puente Alto | Cimenta S.A. | Puente Alto | no confirmada | [cimenta.cl/negocios/strip-centers](https://cimenta.cl/negocios/strip-centers/) | Media |
| Terrazas San Cristóbal | Cimenta S.A. | Providencia (Bellavista) | no confirmada | Búsqueda "Cimenta strip centers Chile portafolio" (mención de inauguración próxima) — no verificado con fetch directo a página del proyecto | Baja |
| Strip center Camino Lonquén (sin nombre comercial confirmado) | Inmobiliaria SMU (matriz de Unimarc/SMU) | Maipú | Camino Lonquén 17.723 | [df.cl — "Matriz de los supermercados Unimarc busca entrar al negocio de los strip center..."](https://www.df.cl/empresas/retail/matriz-de-los-supermercados-unimarc-busca-entrar-al-negocio-de-los-strip) | Alta (dirección), pero SMU declaró que este proyecto "no forma parte de nuestro foco de crecimiento" — un solo activo, no una estrategia de expansión |
| Strip center Colina (Más Center) | IFB Inversiones / Más Center | Colina | Contiguo a Ruta 57 (Los Libertadores) — número exacto no confirmado | [meganoticias.cl — strip center en Colina](https://www.meganoticias.cl/nacional/494412-strip-center-en-colina-ubicacion-cuando-abre-pdp-5-8-2025.html) | Media (en construcción al momento de la nota; apertura prevista jun-2026 — **verificar si ya abrió**, dado que hoy es ago-2026) |
| Strip center Pirque Etapa III (Más Center) | IFB Inversiones / Más Center | Pirque | no confirmada | [meganoticias.cl — strip center en Pirque](https://www.meganoticias.cl/nacional/494020-strip-center-en-pirque-etapa-iii-supermercado-farmacia-pdp-1-8-2025.html) | Media (en construcción; apertura prevista oct-2026) |
| BCenter Alto Jahuel | Operador no confirmado (portal "bicentenario.cl" lo publica) | Buin (sector Alto Jahuel) | Av. principal Buin–Alto Jahuel, cerca de Miraflores 166-300 — número exacto no confirmado | [bicentenario.cl/blcenter-alto-jahuel](https://www.bicentenario.cl/blcenter-alto-jahuel/) | Baja-Media (anclado por Unimarc; 25 locales, 130 estacionamientos según la fuente, pero el operador real de la propiedad no quedó claro) |

**Leads de nombre-sin-dirección (NO subidos a tabla, mencionados para que una sesión futura no los busque de cero):**
- Grupo Patio / Patio Comercial — líder del mercado de strip centers en Chile (~15% del mercado metropolitano, 91 activos propios / 158 administrados a nivel nacional según [emol.com](https://www.emol.com/noticias/Economia/2023/09/27/1108388/grupo-patio-conglomerado.html) y [sumandovalor.cl](https://sumandovalor.cl/empresas/4702/)). Fundó su primer strip center en Ñuñoa en 2004. No se encontró un listado público propiedad-por-propiedad con direcciones — su sitio corporativo no fue explorado en profundidad.
- Más Center / IFB Inversiones — más de 30 strip centers operando en RM (Las Condes, Lo Barnechea, Colina, Pirque, Peñalolén, Vitacura) y en 7 regiones más, según [df.cl](https://www.df.cl/mercados/bolsa-monedas/la-arremetida-de-la-gestora-ifb-fondos-suman-mas-de-39-strip-centers-a) — pero `mascenter.cl` bloqueó el fetch directo (403) y no se encontró un listado de nombres/direcciones individuales de los activos ya operando (solo los 2 en construcción, arriba).
- Cimenta declara "ocho strip centers en Santiago, Independencia, San Miguel y Estación Central" (vía snippet de búsqueda) sin nombrar ninguno individualmente — no se incluyeron en la tabla porque no hay nombre ni dirección verificable por activo.

## Tabla 2 — Power centers (Región Metropolitana)

| Nombre | Operador/Cadena | Comuna | Dirección | Fuente | Confianza |
|---|---|---|---|---|---|
| Paseo Los Trapenses | Fondo BTG Pactual Renta Comercial | Lo Barnechea | Camino Los Trapenses N° 3.515 | [btgpactual.cl/rentacomercial/activos/paseo-los-trapenses](https://btgpactual.cl/rentacomercial/activos/paseo-los-trapenses/) | Alta (anclas: Jumbo ~8.400 m², Cine Hoyts, Smart Fit) |
| Power Center Cerrillos | Cenco Malls (Cencosud) | Cerrillos | no confirmada | [cencomalls.com/corporativo/negocios/centros-comerciales/chile](https://cencomalls.com/corporativo/negocios/centros-comerciales/chile) + snippets de búsqueda agregada | Baja (confirmado que existe un Power Center de Cenco Malls en la comuna; no se encontró nombre propio ni dirección) |
| Power Center Puente Alto | Cenco Malls (Cencosud) | Puente Alto | no confirmada | Idem anterior | Baja |
| Power Center San Bernardo | Cenco Malls (Cencosud) | San Bernardo | no confirmada | Idem anterior | Baja |

**Lead de clasificación dudosa (NO incluido con confianza en la tabla):**
- **Movicenter** (Av. Américo Vespucio 1.151/1.155, Huechuraba) — centro comercial especializado en rubro automotriz (venta de autos nuevos/usados, repuestos, servicios), con múltiples "anclas" del mismo rubro. Ninguna fuente consultada lo clasifica explícitamente como "power center" — la definición chilena de power center (hasta dos anclas retail generalistas, ej. supermercado + home improvement) no calza limpiamente con un formato mono-rubro automotriz. Se deja fuera de la tabla por disciplina de no-fabricación de categoría, pero se anota porque podría ser un caso límite relevante a criterio del equipo.

## Centros de formato ambiguo (mencionados por una fuente confiable, pero sin clasificación strip/power/mall verificada)

Espacio Urbano opera "13 centros comerciales y 25 strip centers" a nivel nacional según snippets de búsqueda, pero su propio sitio no distingue cuál de sus activos es cuál — varios de los nombrados abajo tienen grandes tiendas + supermercado + cine, lo que los acerca más a "power center" o "mall vecinal" que a "strip center" clásico. Se listan con dirección (sí verificada) pero **sin asignar formato**, para que quien planifique la Fase 18 decida con criterio propio o consulte directamente a Espacio Urbano:

| Nombre | Comuna | Dirección | Fuente |
|---|---|---|---|
| Espacio Urbano La Dehesa | Lo Barnechea | Av. El Rodeo 12.850 | Búsqueda agregada sobre espaciourbano.cl |
| Espacio Urbano Gran Avenida | San Miguel | José Miguel Carrera N° 6.150 | [espaciourbano.cl/centro-comercial/gran-avenida](https://www.espaciourbano.cl/centro-comercial/gran-avenida) |
| Espacio Urbano Las Rejas | Estación Central | Av. Libertador Bernardo O'Higgins N° 5.091 | Búsqueda agregada sobre espaciourbano.cl/centro-comercial/las-rejas |
| Espacio Urbano Puente Alto+ | Puente Alto | Av. Concha y Toro 1.149 | [espaciourbano.cl/centro-comercial/puente-alto](https://www.espaciourbano.cl/centro-comercial/puente-alto) |
| Espacio Urbano Plaza Maipú | Maipú | Av. Ramón Freire (ex Av. Pajaritos) 1.790 | Búsqueda agregada sobre espaciourbano.cl/centro-comercial/plaza-maipu |

## Fuentes consultadas

**Fuentes que sí aportaron datos usables:**
- [puntablanca.cl/comercial](https://puntablanca.cl/comercial) — listado propio con 15 direcciones (8 en RM usadas arriba).
- BTG Pactual Fondo Renta Comercial, páginas de activos individuales bajo `btgpactual.cl/rentacomercial/activos/*` — 9 activos strip/power con dirección y anclas.
- [cencomalls.com/corporativo/negocios/centros-comerciales/chile](https://cencomalls.com/corporativo/negocios/centros-comerciales/chile) — nombres de malls regionales (excluidos) + mención de comunas con Power Center (Cerrillos, Puente Alto, San Bernardo, Osorno, Talca, Calama, Hualpén).
- [camaracentroscomerciales.cl/mapa-de-santiago](https://camaracentroscomerciales.cl/mapa-de-santiago/) — índice de ~60 nombres de centros por comuna en Santiago (usado para saber qué buscar, no como fuente de formato).
- [espaciourbano.cl/selecciona-tu-espacio](https://www.espaciourbano.cl/selecciona-tu-espacio) + páginas individuales — 13 propiedades nacionales, 5 en RM con dirección (formato sin confirmar, ver sección arriba).
- [cimenta.cl/negocios/strip-centers](https://cimenta.cl/negocios/strip-centers/) — confirma 2 "Cimenta Strip Center®" (Puente Alto, Iquique) + 8 más sin nombrar.
- Diario Financiero: artículo sobre SMU/Unimarc entrando al negocio strip center (Camino Lonquén, Maipú), artículo sobre plan de inversión de IFB Inversiones (7 proyectos), artículo sobre "más de 39 strip centers" de IFB.
- Meganoticias: strip center Colina (Más Center), strip center Pirque Etapa III (Más Center).
- The Clinic: mercado de strip centers en Gran Santiago (contexto, sin nombres propios de activos).
- [bicentenario.cl/blcenter-alto-jahuel](https://www.bicentenario.cl/blcenter-alto-jahuel/) — BCenter Alto Jahuel, Buin.
- Búsqueda agregada sobre venta de strip center en Temuco (US$9M, sector Los Pablos) — no RM, no incluido en tabla, mencionado como contexto de mercado secundario.
- G5 Noticias / La Tercera — brecha de m² de strip center por habitante entre comunas (Puente Alto vs. Lo Barnechea) — dato de contexto de mercado, sin nombres de activos.

**Fuentes que resultaron dead ends (para que una sesión futura no las repita):**
- `mascenter.cl/strip-centers/` — devuelve HTTP 403 Forbidden al fetch directo; el contenido solo se pudo inferir de snippets de búsqueda de terceros.
- `araucoexpress.cl` — la página raíz es un selector dinámico (JS) sin contenido estático listable; no se encontró un listado de ubicaciones individuales de Arauco Express (marca de strip center de Parque Arauco) en esta sesión.
- `parauco.com/parque-arauco-corporativo-en/portafolio` — solo devolvió datos de contacto corporativo, no el portafolio de activos.
- `cimenta.cl/proyectos-en-desarrollo/` — página placeholder sin proyectos listados al momento del fetch.
- `mall.fandom.com/es/wiki/Lista_de_centros_comerciales_en_Chile` (Wikimall Fandom) — devolvió HTTP 402 Payment Required; podría ser una fuente valiosa (lista comprehensiva por nombre) si se accede de otra forma en el futuro.
- `camaracentroscomerciales.cl/el-boom-de-los-strip-centers-en-sanhattan-abriran-21-mil-metros-cuadrados-y-afps-quieren-tomar-su-tajada-17-02/` — devolvió HTTP 404 al fetch directo; las definiciones de strip/power center citadas arriba vienen de snippets de búsqueda sobre esta URL, no de lectura directa — **tratar con cautela, re-verificar si se usa para producto**.
- Artículos de Diario Financiero / La Tercera / Cimenta / AmericaRetail sobre "28 strip centers en 2 años" y "12 nuevos recintos" — dan estadísticas agregadas por comuna (Colina, Lo Barnechea, Peñalolén, Ñuñoa, Vitacura, Pudahuel, etc.) pero **no nombran los proyectos individuales**, por lo que no se pudieron convertir en filas de tabla sin fabricar nombres.
- `btgpactual.cl/rentacomercial/portafolio-de-activos/` — página con mapa interactivo cargado por JavaScript; el fetch estático no devuelve el listado completo de activos (se accedió a activos individuales vía búsqueda de URLs indexadas en su lugar).
- `btgpactual.cl/rentacomercial/activos/san-pio/` — HTTP 404 al fetch directo (posiblemente el activo fue vendido a fines de 2024, ver nota en tabla).

## Gaps y próximos pasos

1. **El "segundo power center" del fondo BTG Pactual no fue identificado** — la fuente confirma "2 power centers" en el portafolio del fondo pero solo se pudo nombrar uno (Paseo Los Trapenses). Revisar `btgpactual.cl/rentacomercial/portafolio-de-activos/` con un navegador real (JS) o pedir el reporte trimestral en PDF del fondo (hay uno referenciado: `Presentacion_renta_comercial.pdf`).
2. **Grupo Patio, líder del mercado (15% share), no tiene ni un solo activo nombrado en esta lista** — es la brecha más grande. Su sitio corporativo (`grupopatio.cl` o similar, no explorado en profundidad esta sesión) probablemente tiene un listado de propiedades — visitarlo directamente en una sesión futura.
3. **Más Center/IFB opera "más de 30 strip centers" ya activos** (no en construcción) en RM y regiones, y solo se pudieron nombrar los 2 en construcción (Colina, Pirque). Su propio sitio (`mascenter.cl`) bloqueó el fetch automatizado (403) — visitarlo manualmente o vía navegador con user-agent real.
4. **Consultar directamente a Colliers/CBRE/JLL Chile por su categorización interna** — sus reportes de mercado (ej. "Reporte Strip Centers 1S 2025" de Colliers, referenciado pero no descargado en profundidad) probablemente tienen un apéndice o base de datos con nombre, dirección y m² de cada activo del inventario que monitorean — sería la fuente más autorizada y estructurada si se puede conseguir acceso (típicamente requiere ser cliente o pedirlo directamente).
5. **Revisar permisos de edificación de uso comercial de gran superficie en municipios específicos** (ej. Colina, Lo Barnechea, Peñalolén, Buin, Maipú — las comunas con más proyectos nuevos según la prensa) — el propio expediente de permiso de edificación municipal a veces declara el destino "strip center" o "centro comercial menor" y podría dar direcciones exactas de proyectos aprobados/en construcción que la prensa aún no cubrió.
6. **Verificar estado real (¿abrió?) de los 2 activos de Más Center "en construcción"** — el strip center de Colina tenía apertura prevista para junio de 2026 según la nota consultada; la fecha actual del sistema es agosto de 2026, así que probablemente ya abrió — confirmar y promover de "en construcción" a "operando" si corresponde.
7. **El caso Espacio Urbano (13 malls + 25 strip centers, sin discriminar cuál es cuál) necesita resolución humana o una llamada/consulta directa a la empresa** antes de poder clasificar sus 5 propiedades de RM listadas en la sección de "formato ambiguo".
8. **Ningún dato de regiones fuera de RM se cargó en las tablas principales** (por diseño, dado que `mercado_locales_listings` es RM-only), pero quedaron leads sueltos en el texto (Temuco, Curicó, Ovalle, Arica, La Cruz, Quillota, Calama, La Serena vía Punta Blanca; Boulevard del Valle en San Pedro de la Paz vía BTG) por si el alcance se expande en un milestone futuro.
9. **No se intentó cruzar esta lista contra `cadenas_sucursales`** (la tabla ya existente en el codebase con sucursales de Walmart/SMU geocodificadas) — sería un paso natural de una fase de implementación futura para detectar si algún strip/power center de esta lista ya tiene su ancla (Unimarc, Líder, etc.) presente en esa tabla, como cross-check de coherencia.

---
*Investigación: 2026-08-02. Pre-work para Fase 18 (aún no planificada) del milestone v1.7 Cabida Comercial.*
