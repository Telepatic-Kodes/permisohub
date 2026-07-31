# Guía de inicio (onboarding PDF)

`PermisoHub-Guia-de-inicio.pdf` — 12 páginas A4: portada, 10 pasos con la
pantalla real de cada uno, y un cierre con las reglas para leer lo que la app
entrega.

## Regenerar

Las capturas son de la app corriendo en local, no mockups. Cuando cambie la UI:

1. Levanta el dev server **en el puerto 7891** (lo exige el self-fetch de
   zonificación, que apunta a ese puerto cuando `NEXT_PUBLIC_APP_URL` no está
   definida) y con webpack, no Turbopack:

   ```bash
   npx next dev --webpack -p 7891
   ```

2. Recaptura las pantallas afectadas con viewport de **1400 px de ancho** y el
   alto que ajuste a su contenido (560 para el dashboard, 520 para el kanban,
   780 para el formulario, 880 para la ficha y las herramientas). Guarda con el
   mismo nombre en `capturas/`.

3. Recorta la barra lateral de todas menos `ob-01` (la 01 la conserva para
   mostrar el menú):

   ```bash
   sips -c <alto> 1160 --cropOffset 0 240 original.png --out capturas/ob-NN-x.png
   ```

4. Vuelve a renderizar:

   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --headless --disable-gpu --no-pdf-header-footer \
     --print-to-pdf="PermisoHub-Guia-de-inicio.pdf" \
     --virtual-time-budget=12000 \
     "file://$PWD/guia.html"
   ```

5. Verifica que sigan siendo **12 páginas** (`pdfinfo`). Si salen 13, alguna
   hoja desbordó: el `max-height` de `.shot img` (108 mm) es el tope que hace
   caber cada paso en una página.

## Contenido y precisión

Cada afirmación del documento describe comportamiento real y verificado de la
app. Las advertencias del cierre —citas "(por verificar)", zonificación que no
reemplaza el CIP, Due Diligence preliminar, vía determinista vs. plazo
estimado, días hábiles— reflejan garantías que están implementadas en el
código. Si alguna deja de ser cierta, corrige la guía en el mismo commit.
