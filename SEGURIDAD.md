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

### 9. Ofertas falsas y estafas de anticipo

El tablón de ofertas es el imán de fraude más obvio de toda la plataforma:
alguien publica "tengo mercados", pide un depósito por adelantado y desaparece.
La víctima es alguien que ya lo perdió todo.

- Aviso permanente y fijo —no escondido tras un enlace— en las dos pantallas de
  ofertas: **la ayuda no se paga, nunca**. Quien está desesperado no lee la
  letra pequeña.
- Ninguna oferta nace verificada y **nadie puede autoproclamarse**: el sello lo
  pone un coordinador, y es justo lo que alguien mira antes de ir a recoger algo.
- Denuncia por estafa desde la ficha, y descarte por coordinadores.
- La fecha de publicación no se puede reescribir: es lo que se mira para saber
  si todavía queda algo.
- Nada se borra. Si una oferta resultó ser una estafa, el rastro importa.

### 10. Datos falsos sobre a dónde ir

Un albergue inventado manda a una familia caminando de noche, con niños y sin
batería, a un sitio que no existe. Es un daño peor que el de una necesidad
falsa, donde el que se mueve es un voluntario que puede darse la vuelta.

- Solo los coordinadores acreditados publican puntos. La asimetría del daño
  justifica la asimetría del permiso.
- Un punto nace **sin confirmar** aunque lo publique un coordinador: publicar
  desde una lista no es lo mismo que haberse parado en la puerta. Se muestra con
  esa advertencia hasta que alguien de terreno lo confirme.
- Quien llega puede avisar que está lleno, cerrado o que no existe. Ese aviso
  **no cierra el punto**: si bastara con avisar, cualquiera vaciaría el mapa de
  albergues. Lo marca para que un humano llame.
- La carga masiva desde una lista revisa antes de publicar y, si una sola línea
  no se entiende, no publica ninguna.

## Qué es público a propósito, y qué no

La asimetría es deliberada y conviene entenderla antes de tocar nada:

| Dato | Quién lo ve | Por qué |
|---|---|---|
| Teléfono de una **necesidad** | Autor, validadores y quien gastó un cupo | Es de una persona vulnerable. Cosechar 500 de estos es el peor escenario. |
| Teléfono de una **oferta** | Cualquiera | Quien ofrece no es vulnerable: publicó *para* que lo llamen. Ponerle un peaje sería cobrárselo a quien lo necesita. |
| Teléfono de un **punto** | Cualquiera | Es de una institución. Llamar antes de caminar dos horas con niños es justo lo que queremos. |
| **Coordenadas** | Cualquiera con sesión | Sin distancia, un oferente no puede decidir. Riesgo aceptado, ver abajo. |
| **Llaves de socios** | Nadie | Se guarda solo el hash. Una filtración de esa colección no entrega permisos de escritura. |

En **búsquedas de personas** el acceso al contacto no es exclusivo: se paga el
mismo cupo, pero no bloquea. A una persona no la encuentra uno, la encuentran
varios, y con el compromiso normal la segunda testigo —la que sabe hacia dónde
iba— se quedaba fuera tres horas.

## La API pública y su frontera

`/api/puntos.geojson` y `/api/resumen.json` se sirven sin llave ni sesión, con
caché de cinco minutos en el CDN para que mil consumidores no sean mil lecturas
de Firestore.

**Lo que deliberadamente no se abre** son los detalles de las necesidades. Una
referencia como "Carrera 16 #3-51" junto a "insulina para mi tía que depende de
esto" identifica a una persona vulnerable y dice qué le falta. Esta app gasta un
cupo por cada teléfono que revela precisamente para que nadie los coseche: abrir
las direcciones en una sola petición contradiría esa misma decisión, y el primer
beneficiado sería quien busca a quién estafar. Solo salen agregados.

`POST /api/aportarPunto` acepta datos de organizaciones con llave. Lo que
aportan nace sin confirmar y con su nombre a la vista, y revocar la llave corta
el acceso sin borrar lo ya aportado.

## Registro de fallos

`diagnostics` guarda errores del cliente para poder enterarse de que la app se
rompió para alguien. **No se usa un servicio externo a propósito**: un payload de
error puede arrastrar la descripción de una necesidad o un teléfono, y mandar eso
a un tercero contradiría todo lo demás.

La lista de campos es cerrada en el cliente y en las reglas, y no admite ningún
texto escrito por una persona. La ruta se guarda sin querystring: el id de una
necesidad no ayuda a depurar y sí serviría para reconstruir quién miró qué.
Leerlos queda restringido a validadores, porque un user-agent identifica el
dispositivo de alguien.

## Defensas activas en servidor

| Función | Qué resuelve |
|---|---|
| `detectarRafagaDePublicaciones` | Inundación de reportes (las reglas no cuentan) |
| `purgarContactosCerrados` | Retención de datos personales, a los 30 días |
| `reabrirEntregasSinConfirmar` | Necesidades varadas en el limbo, a las 72 h |
| `recuperarReporte` | Devolver un reporte a quien perdió su identidad de navegador |
| `api` | Lectura pública de puntos y agregados, con caché que acota el costo |
| `aportarPunto` | Aportes de organizaciones aliadas, con llave y atribución |

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
4. **Moderación proactiva de ofertas.** Hoy una oferta falsa se descubre porque
   alguien la denuncia o un coordinador la revisa. Con volumen hará falta algo
   que ordene la cola por señales, no por orden de llegada.
5. **Caducidad de las llaves de socios.** Hoy una llave vive hasta que se
   revoca a mano.

## Riesgos aceptados

- **Las coordenadas son públicas.** Saber qué casas están dañadas o vacías tiene
  valor para un ladrón. Difuminarlas rompería el producto: un oferente necesita
  la distancia para decidir. Se asume el riesgo y se compensa con verificación
  en terreno.
- **Las coordenadas se conservan indefinidamente.** El teléfono se purga a los
  30 días de cerrada la necesidad, pero la ubicación queda: es la auditoría de
  la emergencia. Si el histórico se publicara alguna vez, habría que agregarlo
  por zona en vez de exponer puntos.
- **El teléfono de una oferta es público y se puede cosechar.** Es el precio de
  que un damnificado pueda llamar sin fricción. Se avisa antes de publicar, y
  quien ofrece decide con eso a la vista.
- **Los datos de un socio llegan sin que nadie de aquí los verifique.** Entran
  sin confirmar y con su nombre: la confianza es por fuente, decidida una vez por
  un humano, y un coordinador puede descartarlos.
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

`npm test` levanta 95 casos contra los emuladores, escritos como
situaciones de terreno y no como reglas abstractas. Entre ellos: que un tercero
no vea el teléfono antes de comprometerse, que un cupo de otra necesidad no
sirva, que el contador no se pueda saltar, que quien entrega no pueda cerrar,
que nadie se autoproclame validador, y que una cuenta bloqueada no pueda
publicar, comprometerse ni denunciar.

También: que un anónimo no publique ni confirme un albergue, que avisar que un
punto está lleno no lo cierre, que nadie se ponga a sí mismo el sello de oferta
verificada, que no se pueda mover la fecha de publicación de una oferta, y que
el acceso al contacto de una búsqueda exija haber pagado el cupo.

Toda regla nueva debería llegar con su caso.

Además de las reglas, `npm run lint` corta la clase de fallo que ni los tipos ni
las pruebas ven —un hook bajo un `return` temprano tumbó todas las fichas de
necesidad en producción— y `npm run humo` abre las catorce pantallas en un
navegador real contra el sitio publicado.
