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
corte duro de identidades baratas es **App Check**, que se activa en la consola
y no se puede expresar en `firestore.rules`. Mientras App Check esté apagado,
los cupos y bloqueos frenan al oportunista, no al atacante decidido.

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

**Residual:** no hay límite de publicación por cuenta. Un tope real necesita
enforcement en servidor (ver abajo); un contador puramente en reglas se esquiva
sin más que no incrementarlo.

### 5. Suplantación de coordinadores

- Ser validador es tener un documento en `validators/{uid}` que **solo se crea
  desde la consola**. No hay ninguna ruta por la que un cliente se autoproclame.
- Verificar deja registrado `verifiedByUid`, no solo el nombre con que se firmó.

### 6. Alteración de reportes ajenos

- Las reglas congelan el hecho reportado: categoría, descripción, referencia,
  ubicación, cantidad de personas, autor y fecha de creación son inmutables.
  Solo cambia el ciclo de vida.
- Nada se borra nunca. El histórico es la auditoría de la emergencia.

## Lo que falta: enforcement en servidor

Estas tres no se pueden resolver con reglas de Firestore y son las siguientes en
prioridad. Las dos primeras requieren plan Blaze (pago por uso, con tope de
gasto configurable).

1. **App Check con reCAPTCHA Enterprise.** Lo primero que hay que activar. Sin
   él, la clave web —que viaja al navegador por diseño— permite scriptear la
   API directamente, y todo lo anterior se vuelve un obstáculo de minutos.
   Se activa en la consola; no requiere Blaze.
2. **Límite de publicación por cuenta y por IP**, en una Cloud Function que
   intermedie la creación de necesidades.
3. **Verificación del teléfono por SMS** para quien se ofrece a ayudar. Es la
   defensa más fuerte contra identidades desechables, y tiene una asimetría
   valiosa: pone la fricción del lado del voluntario, no del damnificado. Quien
   acaba de perder su casa no debería esperar un SMS; quien va a recibir el
   teléfono de esa persona, sí.

## Riesgos aceptados

- **Las coordenadas son públicas.** Saber qué casas están dañadas o vacías tiene
  valor para un ladrón. Difuminarlas rompería el producto: un oferente necesita
  la distancia para decidir. Se asume el riesgo y se compensa con verificación
  en terreno.
- **Retención indefinida.** Hoy nada borra los teléfonos ni las coordenadas.
  Antes de que la plataforma crezca hay que definir una política —por ejemplo,
  purgar el contacto de las necesidades cerradas a los 30 días.
- **El cupo estorba a operadores legítimos de volumen.** Una parroquia que
  coordina 50 entregas topará a las 8. La respuesta correcta es acreditarla como
  validadora, no subir el cupo para todos.

## Verificación

`npm run test:rules` levanta 49 casos contra los emuladores, escritos como
situaciones de terreno y no como reglas abstractas. Entre ellos: que un tercero
no vea el teléfono antes de comprometerse, que un cupo de otra necesidad no
sirva, que el contador no se pueda saltar, que quien entrega no pueda cerrar,
que nadie se autoproclame validador, y que una cuenta bloqueada no pueda
publicar, comprometerse ni denunciar.

Toda regla nueva debería llegar con su caso.
