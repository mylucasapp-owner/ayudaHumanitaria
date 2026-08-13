# Modelo de amenazas y defensas

Una plataforma de ayuda en catástrofe concentra tres cosas que atraen fraude:
teléfonos de personas vulnerables, direcciones de casas dañadas, y un flujo de
bienes donados sin trazabilidad. Este documento dice qué se defiende, cómo, y
—sobre todo— qué **no** está defendido todavía.

## El supuesto que ordena todo lo demás

La identidad es anónima y gratuita: entrar cuesta un toque, sin registro. Eso es
deliberado, porque pedirle una cuenta a alguien que acaba de perder su casa es
una barrera inaceptable.

La consecuencia es que **toda defensa atada al `uid` se esquiva creando otro**.
Las reglas de este proyecto encarecen el abuso y lo dejan registrado, pero el
corte duro de identidades baratas es **App Check**, que no se puede expresar en
`firestore.rules`. Está registrado y midiendo, aunque todavía **sin rechazar**
(el porqué está más abajo). Hasta que rechace, los cupos y bloqueos frenan al
oportunista, no al atacante decidido.

## Amenazas y qué hace la plataforma

### 1. Cosecha de teléfonos para estafas

El riesgo más grave. Un estafador que obtiene 500 números de damnificados tiene
una lista ideal para el fraude del familiar herido o la falsa colecta.

- El teléfono **no está** en el documento público. Vive en
  `needs/{id}/private/contact`, y las reglas solo lo entregan al autor, a quien
  tiene el compromiso vigente y a los validadores.
- Para llegar a un teléfono hay que comprometerse, y comprometerse **consume un
  cupo** de un registro personal (`ledger/{uid}`) con tope de 8 por ventana de
  6 horas.
- El cupo es inesquivable desde el cliente: cada compromiso ocupa una posición
  `slots/{seq}` que no se puede reescribir, y crear la siguiente exige que el
  contador ya haya avanzado. Omitir el contador deja al atacante intentando
  recrear un slot que ya existe.
- Ese mismo registro es la **bitácora**: `ledger/{uid}/slots` enumera a qué
  damnificados accedió cada cuenta. Sin ella no habría cómo investigar una fuga
  después de que ocurra.

**Residual:** una cuenta nueva reinicia el cupo. Sin App Check, cosechar 500
números cuesta 63 identidades nuevas en vez de un script de un minuto.

### 2. Negación de ayuda: vaciar el mapa

El agujero más fácil de pasar por alto. Si quien se compromete pudiera cerrar la
necesidad, tomar y "entregar" todo borraría el mapa sin repartir nada — y sin
que nadie lo note, porque las necesidades cerradas desaparecen del feed.

- El oferente **solo declara** la entrega (`entregada`). No cierra.
- Cerrar (`resuelta`) es potestad exclusiva de quien pidió la ayuda o de un
  validador.
- Mientras espera confirmación la necesidad **sigue visible y activa**, y
  aparece en la cola *Entregas por confirmar* del panel de validación.
- Un validador puede reabrirla con "La entrega no ocurrió".

### 3. Secuestro de necesidades

Tomar necesidades sin intención de cumplirlas, para bloquearlas.

- Todo compromiso vence (3 horas) y la necesidad vuelve al feed sola. En una
  emergencia nadie se va a acordar de liberar un ticket.
- Las reglas ponen techo al vencimiento (12 h): nadie puede bloquear un pedido
  indefinidamente aunque manipule el cliente.
- El cupo de 8 por ventana limita cuántas puede acaparar una cuenta a la vez.
- Los compromisos vencidos tienen su propia cola en el panel de validación.

### 4. Reportes falsos

Inventar necesidades para desviar donaciones, o inundar la base para ahogar a
los validadores.

- Cualquiera puede **denunciar** una necesidad con un motivo de una lista
  cerrada. Un documento por persona y necesidad: la ruta impide que un mismo
  uid infle el conteo.
- Las denuncias son la primera pestaña del panel de validación, ordenadas por
  cantidad. Quien fue al lugar y no encontró nada es la fuente más confiable
  que tiene la plataforma.
- Un validador puede descartar el reporte y **bloquear** la cuenta.
- Las necesidades verificadas suben al principio de la lista de oferentes, así
  que el reporte falso compite en desventaja.

**Residual:** el tope de publicación por cuenta lo aplica una Cloud Function
(punto 7), no las reglas. Un contador puramente en reglas se esquiva sin más
que no incrementarlo.

### 5. Suplantación de coordinadores

- Ser validador es tener un documento en `validators/{uid}` que **ningún cliente
  puede crear**: se escribe con credencial de administrador, mediante
  `scripts/validadores.mjs`. No hay ruta por la que alguien se autoproclame.
- Verificar deja registrado `verifiedByUid`, no solo el nombre con que se firmó.

### 6. Alteración de reportes ajenos

- Las reglas congelan el hecho reportado: categoría, descripción, referencia,
  ubicación, cantidad de personas, autor y fecha de creación son inmutables.
  Solo cambia el ciclo de vida.
- Nada se borra nunca. El histórico es la auditoría de la emergencia.

### 7. Inundación de reportes

Publicar en ráfaga para ahogar a los validadores. Las reglas no pueden contar
documentos ni mirar hacia atrás en el tiempo, así que esto vive en una Cloud
Function.

- `detectarRafagaDePublicaciones` cuenta las publicaciones de la cuenta en la
  última hora y, sobre 12, la bloquea automáticamente.
- Actúa **después** de la escritura, a propósito. Interponer una función en la
  creación de necesidades sacrificaría el modo sin conexión y agregaría un
  arranque en frío al momento más urgente de la app. Detectar en segundos y
  cortar hacia adelante es mejor canje.
- No descarta ninguna necesidad automáticamente: las marca para que un humano
  decida. Si quien reporta en ráfaga fuera un coordinador improvisado con gente
  real a cargo, borrarlas sería el peor error posible.
- Los validadores están exentos: publican en volumen legítimamente.

## Defensas activas en servidor

| Función | Qué resuelve |
|---|---|
| `detectarRafagaDePublicaciones` | Inundación de reportes (las reglas no cuentan) |
| `purgarContactosCerrados` | Retención de datos personales, a los 30 días |
| `reabrirEntregasSinConfirmar` | Necesidades varadas en el limbo, a las 72 h |
| `recuperarReporte` | Devolver un reporte a quien perdió su identidad de navegador |

**App Check** está registrado con reCAPTCHA Enterprise y emitiendo tokens, pero
**en modo monitoreo**: mide sin rechazar. Activar el bloqueo dejaría fuera a
quien no pueda cargar reCAPTCHA —teléfono viejo, bloqueador, red filtrada—, y
en una plataforma de emergencia dejar afuera a un damnificado real es peor que
tolerar algo de abuso. El criterio para activarlo está en
[LANZAMIENTO.md](LANZAMIENTO.md).

## Lo que sigue faltando

1. **Verificación del teléfono por SMS** para quien se ofrece a ayudar. Es la
   defensa más fuerte contra identidades desechables, y tiene una asimetría
   valiosa: pone la fricción del lado del voluntario, no del damnificado. Quien
   acaba de perder su casa no debería esperar un SMS; quien va a recibir el
   teléfono de esa persona, sí.
2. **Límite por IP**, no solo por cuenta. Hoy la ráfaga se detecta por `uid`, y
   un atacante puede repartir sus publicaciones entre identidades nuevas.
3. **Bloqueo de App Check activado**, cuando las métricas lo respalden.

## Riesgos aceptados

- **Las coordenadas son públicas.** Saber qué casas están dañadas o vacías tiene
  valor para un ladrón. Difuminarlas rompería el producto: un oferente necesita
  la distancia para decidir. Se asume el riesgo y se compensa con verificación
  en terreno.
- **Las coordenadas se conservan indefinidamente.** El teléfono se purga a los
  30 días de cerrada la necesidad, pero la ubicación queda: es la auditoría de
  la emergencia. Si el histórico se publicara alguna vez, habría que agregarlo
  por zona en vez de exponer puntos.
- **El cupo estorba a operadores legítimos de volumen.** Una parroquia que
  coordina 50 entregas topará a las 8. La respuesta correcta es acreditarla como
  validadora, no subir el cupo para todos.

### 8. Duplicados que ahogan la verificación

No son mala fe: son varias personas de una cuadra reportando lo mismo, o alguien
que reintentó creyendo que no se había enviado. El costo lo pagan los
validadores, revisando tres veces el mismo pedido mientras otros esperan.

- Al marcar la ubicación se avisa si ya hay una necesidad de la misma categoría
  a menos de 400 m, con su descripción y un enlace.
- Es solo un aviso. Dos familias vecinas pueden necesitar lo mismo de verdad, y
  frenar a quien está pidiendo ayuda sería mucho peor que tolerar repetidos.
- La consulta corre en segundo plano mientras la persona llena el formulario: no
  agrega ningún paso ni espera, y si falla no pasa nada.

## Verificación

`npm test` levanta 65 casos contra los emuladores, escritos como
situaciones de terreno y no como reglas abstractas. Entre ellos: que un tercero
no vea el teléfono antes de comprometerse, que un cupo de otra necesidad no
sirva, que el contador no se pueda saltar, que quien entrega no pueda cerrar,
que nadie se autoproclame validador, y que una cuenta bloqueada no pueda
publicar, comprometerse ni denunciar.

Toda regla nueva debería llegar con su caso.
