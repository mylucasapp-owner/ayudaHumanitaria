# Lanzamiento

URL en producción: **https://ayuda-humanitaria-89e72.web.app**

## Lo que ya está en pie

| Pieza | Estado |
|---|---|
| App (PWA estática) | Desplegada en Firebase Hosting |
| Base de datos | Firestore en `us-east1`, región simple |
| Reglas de seguridad | Desplegadas y verificadas en producción |
| Índices | Desplegados (feed, zona, ráfagas, purga, denuncias) |
| Autenticación | Anónima y correo/contraseña habilitadas |
| Cloud Functions | 4 desplegadas en `us-east1` |
| Mapa | Stadia Maps, estilo oscuro, autenticado por dominio |
| App Check | Registrado y emitiendo tokens, **en monitoreo** |
| Recuperación de reportes | Código de 8 caracteres, canjeable desde otro teléfono |
| Pruebas | 65 casos, todos en verde |

## Antes de difundir la URL

Dos cosas que no puede hacer nadie más que tú.

### 1. Acreditar validadores (bloqueante)

Sin validadores nadie verifica nada, y la plataforma se vuelve una lista de
reportes sin filtro. Es el paso más importante y el único verdaderamente
bloqueante.

Un comando por organización:

```bash
node scripts/validadores.mjs crear "Defensa Civil Comuna 3" "Valle del Cauca" coordinacion@ong.org
```

Crea la cuenta, la acredita e imprime un **enlace de un solo uso** para que
definan ellos su propia contraseña. Se lo envías por WhatsApp: al caducar y
servir una sola vez, es mucho más seguro que entregar una contraseña, que dura
para siempre.

Si el coordinador no puede abrir enlaces, agrega `--con-clave` y el script
imprime una contraseña para entregar en persona. No la mandes a un grupo:
cualquiera del grupo podría descartar reportes reales.

> El script arma el enlace en vez de dejar que Firebase envíe su correo
> automático. Ese correo apunta a una página alojada por Firebase que exige
> recibir la llave del proyecto en la URL, y en proyectos configurados por API
> esa llave llega vacía: el coordinador ve *"The selected page mode is invalid"*
> y se queda afuera. Además esa página está en inglés. Si algún día quieres que
> Firebase envíe el correo, hay que cambiar el *action URL* a
> `https://ayuda-humanitaria-89e72.web.app/clave/` desde la consola
> (Authentication → Templates), porque por API está bloqueado.

```bash
node scripts/validadores.mjs listar
node scripts/validadores.mjs revocar coordinacion@ong.org
```

Revocar quita los poderes de inmediato; la cuenta queda existiendo pero sin
capacidad de verificar, descartar ni bloquear.

**A quién acreditar.** Organizaciones con presencia física en la zona y un
responsable con nombre: defensa civil, bomberos, Cruz Roja, ONG con operación
en terreno, juntas de acción comunal, parroquias que ya estén coordinando
entregas. El criterio no es el tamaño sino que alguien pueda ir a mirar.

**Cuántos.** Al menos dos o tres antes de difundir, y de departamentos
distintos: las zonas están a cientos de kilómetros y nadie verifica lo que no puede
visitar. Un validador por zona es el mínimo para que la cola no se estanque.

**Qué explicarles.** Que su trabajo es confirmar que la necesidad existe (por
teléfono o yendo), descartar lo falso, liberar compromisos que no se
concretaron y confirmar entregas. Que el panel les ordena las denuncias de la
comunidad primero. Y que su cuenta queda registrada en cada acción que hacen:
verificar deja constancia de quién fue.

### 2. Alerta de presupuesto

Blaze cobra por uso. Un pico de tráfico ya cuesta dinero real, y una alerta es
lo que evita enterarte por la factura.

Consola de facturación → *Presupuestos y alertas* → crear presupuesto sobre el
proyecto, con avisos al 50%, 90% y 100%.

Como referencia, con 10.000 usuarios activos en un día el gasto dominante son
las lecturas de Firestore: cada cliente carga hasta 300 necesidades al abrir el
mapa, o sea ~3 millones de lecturas, que a precio de región simple son unos
**US$1–2**. Las Functions y el Hosting quedan dentro del nivel gratuito a esa
escala. Un presupuesto de US$50 al mes da margen amplio y avisa mucho antes de
que algo se descontrole.

**No pongas un corte automático de facturación.** Apagaría la plataforma en
plena emergencia, que es peor que la factura.

## App Check: por qué está en monitoreo y no bloqueando

App Check ya emite tokens, pero **no está rechazando peticiones**. Es
deliberado.

Si se activa el bloqueo, cualquier usuario para el que reCAPTCHA no cargue
—teléfono viejo, bloqueador de anuncios, red que filtra `google.com`— queda
completamente fuera de la app. En una plataforma de emergencia, dejar afuera a
un damnificado real es peor que tolerar algo de abuso el primer día.

El plan correcto es:

1. Lanzar en monitoreo.
2. Mirar **Consola → App Check → Firestore** unas horas después. Muestra el
   porcentaje de peticiones verificadas.
3. Activar el bloqueo solo si ese porcentaje supera ~95% **y** aparece abuso
   real.

Mientras tanto, App Check ya sirve: las métricas dicen cuánto tráfico no viene
de la app legítima, que es justo la señal para decidir.

## Runbook de la emergencia

**Reporte falso o denunciado.** Panel de validación → pestaña *Denunciadas*
(viene ordenada por cantidad de denuncias) → entrar a la ficha → *Descartar
reporte*. Si la cuenta insiste, *Bloquear*.

**Alguien acapara necesidades.** Panel → *Compromisos vencidos*. Entrar y
*Liberar compromiso*. Si se repite, bloquear la cuenta desde la ficha.

**Entrega que no ocurrió.** Panel → *Entregas por confirmar* → *La entrega no
ocurrió, reabrir*. Si nadie interviene, el sistema la reabre solo a las 72 h.

**Publicar un arreglo urgente.**
```bash
npm run deploy
```
El HTML se sirve con `no-cache`, así que los usuarios reciben la versión nueva
en la siguiente carga. No hay que pedirle a nadie que borre caché.

**Ver qué está haciendo el sistema.**
```bash
firebase functions:log --project ayuda-humanitaria-89e72
```

**Alguien perdió el acceso a su reporte.** Si conserva su código de 8
caracteres, lo recupera solo en `/recuperar/`. Si no lo tiene, un validador
puede cerrar la necesidad por él cuando la ayuda llegue.

**Revisar el consumo del mapa.** Panel de Stadia Maps. El service worker guarda
las teselas ya vistas, así que el consumo real es una fracción del tráfico.

## Riesgos conocidos que quedan abiertos

1. **Identidades anónimas gratuitas.** Con App Check en monitoreo, cupos y
   bloqueos se esquivan reinstalando. Es el techo real de las defensas hasta
   que se active el bloqueo.
2. **Coordenadas públicas.** Saber qué casas están dañadas o vacías tiene valor
   para un ladrón. Difuminarlas rompería el producto; se asume y se compensa
   con verificación en terreno.
3. **Denuncias en manada.** No hay ocultamiento automático por número de
   denuncias, a propósito: un grupo coordinado podría borrar del mapa la
   necesidad real de una familia. Las denuncias solo priorizan la cola humana.
4. **Sin verificación de teléfono.** La defensa más fuerte contra cuentas
   desechables sigue pendiente. Lo correcto es exigirla al oferente, no al
   damnificado: quien va a recibir el teléfono de una víctima puede esperar un
   SMS; quien acaba de perder su casa, no.

## Lo siguiente, por orden de valor

1. Verificación por SMS del oferente (punto 4 de arriba).
2. Exportación para coordinación: CSV o vista imprimible por zona, porque en
   terreno se trabaja con papel cuando no hay señal.
3. Panel de zona para validadores, que hoy ven las tres zonas mezcladas.
4. Mapa auto-hospedado (PMTiles) para no depender de ningún proveedor. Hoy no
   hace falta: Stadia cubre el uso y el service worker guarda las teselas.


## Antes de cada despliegue

```bash
npm run check     # tipos + reglas de React + 84 pruebas
npm run build
npx firebase deploy --only hosting,firestore:rules
npm run humo      # abre cada pantalla en un navegador real
```

`npm run deploy` encadena `check` y el despliegue, así que la puerta no se
puede saltar por descuido. La prueba de humo va **después**: comprueba lo que
quedó publicado, no lo que había en el portátil.

Esto existe por un incidente concreto. Un `useState` quedó debajo de un `return`
temprano y todas las fichas de necesidad murieron en la pantalla de error, en
producción, hasta que lo reportó un usuario. Los tipos pasaban y las 84 pruebas
pasaban: ninguna monta una pantalla. Ahora `npm run lint` lo ve sin ejecutar
nada, y `npm run humo` abre las once pantallas de verdad.


## El mapa puede apagarse en silencio

Las teselas vienen de Stadia Maps y se autentican **por dominio**, no por llave:
la URL en `.env.local` no lleva ninguna. Comprobado con `curl`: desde
`ayuda-humanitaria-89e72.web.app` devuelven 200, y sin ese origen, 401.

Tres formas de quedarse sin fondo de mapa, y ninguna avisa por correo:

1. **Mover la app a un dominio propio** sin registrarlo antes en Stadia. Es la
   más probable, porque es un cambio que se hace con prisa y el mapa deja de
   funcionar sin que nada falle en el despliegue.
2. **Navegadores que quitan la cabecera Referer** por privacidad. Afecta solo a
   esos usuarios, así que no se nota mirando el propio teléfono.
3. **Agotar el tope del plan gratuito** con difusión masiva.

Qué pasa cuando ocurre: el mapa queda gris pero **los puntos siguen bien
colocados**, y tras cuatro teselas fallidas aparece un aviso que remite a la
vista de lista, que no depende de ningún proveedor. Comprobado apuntando a un
host inexistente.

Qué hacer: registrar el dominio nuevo en Stadia **antes** de cambiarlo, y
revisar el consumo si la difusión crece. Cambiar de proveedor es una variable de
entorno —`NEXT_PUBLIC_TILE_URL` y `NEXT_PUBLIC_TILE_ATTRIBUTION`— sin tocar
código; la atribución es condición de licencia y hay que cambiarla con él.

## Cuánto pesa abrir la app

Unos 222 kB comprimidos la primera vez, y después el service worker la sirve del
teléfono. El reparto: Firestore 77 kB, React 54 kB, Auth 26 kB y el resto
repartido. Todo es carga útil —Firestore es lo que hace que funcione sin señal—
así que no hay recorte grande sin cambiar de arquitectura.

Los polyfills (39 kB) llevan `noModule`: los navegadores modernos ni los
descargan, así que no cuentan para casi nadie.
