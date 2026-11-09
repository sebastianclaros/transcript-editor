# Guía de uso

Esta guía explica cómo trabajar una sesión con Transcript Editor. English: [user-guide.md](user-guide.md).

## 1. Qué necesitás en la carpeta

Una carpeta por sesión (por ejemplo `entrevistado/sesion`) con:

- un **audio o video** (`.mp4`, `.m4a`, `.mp3`, `.wav` u `.ogg`),
- el **texto**: una línea por párrafo con el formato `Nombre: texto`,
- opcional, el **meta**: un `.json` con el tiempo, el hablante y el estado de cada párrafo.

Si tenés una transcripción cruda (`[00:01:10] SPEAKER_01: texto`), también se puede abrir directo.
Si te falta el meta, el audio no se sincroniza con el texto hasta que haya tiempos.

## 2. Abrir una sesión

1. En la pantalla de inicio tocá **Abrir carpeta de sesión** y elegí la carpeta. Para probar, usá
   **Abrir sesión de ejemplo**. Los proyectos recientes aparecen abajo.
2. Si la carpeta no tiene `proyecto.json`, la app pregunta: _Esta sesión no tiene proyecto.json. ¿Querés crearlo?_
   - **Crear**: elegís el audio, el texto y el meta (ya vienen sugeridos si se reconocen). Se abre el
     panel de proyecto con los hablantes detectados. El archivo se escribe la primera vez que guardás.
   - **Continuar sin proyecto**: trabajás igual, con colores por defecto. Podés crear el proyecto después
     con **Crear proyecto.json** en la barra lateral.
3. Si `proyecto.json` está dañado, podés verlo y corregirlo, o ignorarlo (se guarda una copia como
   `proyecto.bak.json`).
4. Si el proyecto menciona archivos que ya no están, se abre el diálogo para elegir otros.

## 3. La pantalla

- **Barra superior (fija)**: botones de reproductor, velocidad, barra de posición, estado de guardado,
  **Auto-scroll**, **Abrir carpeta…**, **Recargar**, **Guardar**, el ícono de personas (proyecto) y **?** (ayuda).
- **Barra lateral**: proyecto, mapa de avance y novedades de actualización. El botón de las tres rayas la oculta.
- **Texto**: un bloque por párrafo. La barra de color de la izquierda es el estado.
- **Pie**: estadísticas por persona.

### Estados de párrafo

| Color   | Estado     | Cuándo                                           |
| ------- | ---------- | ------------------------------------------------ |
| gris    | pendiente  | el audio todavía no pasó por ahí                 |
| azul    | leído      | el audio pasó por el párrafo mientras reproducía |
| naranja | corregido  | editaste el texto                                |
| verde   | verificado | revisado y aprobado (`Ctrl+Enter`)               |

Doble clic en la hora de un párrafo cambia su estado a mano.

## 4. Corregir

- Hacé clic en el texto y escribí. Al salir del párrafo queda como _corregido_.
- Un párrafo es siempre una sola línea: los saltos de línea se convierten en espacio y un párrafo vacío
  vuelve a su texto anterior. Así el texto y el meta nunca se desalinean.
- Clic en la hora de un párrafo salta a ese momento y reproduce.
- **Guardar** (`Ctrl+S`, `Cmd+S` en Mac) escribe el texto, el meta y, si hizo falta, `proyecto.json`.
  Si el archivo cambió en el disco (por ejemplo una carpeta sincronizada), la app te deja elegir:
  _Sobrescribir_, _Recargar desde disco_ o _Cancelar_.
- Con una transcripción cruda, la primera vez que guardás se crea una copia limpia
  (`<nombre>.editado.txt` y `<nombre>.meta.json`) y se registra en `proyecto.json`. El original no se toca.

## 5. Hablantes y proyecto

Con el ícono de personas (o **Editar proyecto**) completás título, descripción y, por cada hablante,
nombre completo, iniciales y color. Elegí cómo mostrar el nombre (automático, etiqueta, iniciales o nombre)
y si el texto toma el color. Con **Ver/editar proyecto.json** ves el archivo tal cual, con validación.

## 6. Mapa de avance y estadísticas

El mapa tiene dos carriles: el de la izquierda muestra el estado de cada párrafo; el otro, quién habla.
Hacé clic en un segmento para ir a ese párrafo. Arriba se ve el porcentaje, cuánto falta y cuántos
párrafos están verificados. Abajo, por persona: palabras, porcentaje del texto, párrafos y tiempo hablado
estimado.

## 7. Atajos

Ver [hotkeys.md](hotkeys.md) o el botón **?** dentro de la app. En Mac usá Cmd en lugar de Ctrl. Si el sistema
se queda con una combinación (Ctrl+Espacio o Ctrl+flechas en Linux, Cmd+Espacio en Mac), usá la alternativa con Mayús.

## 8. Idioma y configuración

El idioma se cambia desde **?**. La app recuerda el último proyecto, la posición del audio, la velocidad, la
ventana y la barra lateral. Esos datos están en la carpeta de datos de la aplicación, no en tus sesiones.

## 9. Problemas frecuentes

- **No se oye el audio / no avanza**: aparece un aviso rojo; podés seguir editando. Probá con otro formato.
- **«Sin tiempos»**: falta el meta o no tiene tiempos. Generalo con `tools/transcribe` o usá una transcripción cruda.
- **macOS dice que la app está dañada o no verificada**: ver la sección de instalación del README (todavía no está firmada).
