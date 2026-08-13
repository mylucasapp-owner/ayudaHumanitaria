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
node scripts/validadores.mjs crear "Defensa Civil Comuna 3" "Cali" coordinacion@ong.org
```

Crea la cuenta, la acredita y le envía a esa dirección un correo para que
**definan ellos su propia contraseña**: así ninguna clave pasa por tus manos ni
queda escrita en un chat.

Si el coordinador no tiene acceso a correo —caso real en zona de desastre—
agrega `--con-clave` y el script imprime una contraseña para entregar en
persona. No la mandes a un grupo de WhatsApp: cualquiera del grupo podría
descartar reportes reales.

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

**Cuántos.** Al menos dos o tres antes de difundir, y de zonas distintas —Cali,
Chocó y Pereira están a cientos de kilómetros y nadie verifica lo que no puede
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
