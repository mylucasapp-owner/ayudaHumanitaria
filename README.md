# Ayuda Humanitaria

Centraliza, verifica y geolocaliza las necesidades urgentes de los damnificados
por desastres naturales, y las conecta con los recursos que ofrecen ciudadanos y
empresas.

PWA en Next.js (exportación estática) sobre Firebase. Sin registro para pedir ni
para ofrecer ayuda: la identidad es anónima y automática.

## Cómo funciona

Tres roles, un solo flujo:

- **Solicitante** — 4 toques: categoría → una frase → ubicación y teléfono →
  ticket con código. El teléfono nunca aparece en el mapa público.
- **Oferente** — lista y mapa filtrables por categoría, ordenados por
  verificación y cercanía. `YO LO CUBRO` bloquea la necesidad 3 horas mediante
  una transacción, para que dos personas no gasten recursos en lo mismo. Recién
  ahí se le revela el contacto.
- **Validador** — coordinador acreditado (ONG, bomberos, junta de vecinos).
  Confirma que la necesidad es real, revisa denuncias, libera compromisos que no
  se concretaron, descarta reportes falsos y bloquea cuentas abusivas.

Un compromiso vence solo. Pasado el plazo la necesidad vuelve al feed sin que
nadie tenga que intervenir: en una emergencia nadie va a acordarse de liberar un
ticket.

Quien entrega **no cierra** la necesidad: solo declara la entrega. Confirmar es
potestad de quien pidió la ayuda o de un validador. Si el oferente pudiera
cerrar, tomar y "entregar" todo vaciaría el mapa sin repartir nada.

Comprometerse consume un cupo (8 por cada 6 horas) de un registro personal cuyo
contador solo avanza. Es lo que impide que alguien coseche teléfonos de
damnificados a escala. El detalle completo está en [SEGURIDAD.md](SEGURIDAD.md).

## Decisiones de diseño

- **Negro absoluto y brutalismo.** Alto contraste bajo sol directo y polvo,
  botones de 64px mínimo, cero animaciones e imágenes. En pantallas OLED los
  píxeles negros no consumen batería, que es un recurso crítico para un
  damnificado.
- **Exportación estática** (`output: "export"`). No hay servidor que renderice:
  Firebase Hosting sirve HTML desde el borde. Es lo más rápido que existe en 3G
  y lo más barato de escalar cuando llega un peak de tráfico.
- **Caché persistente de Firestore + service worker.** La app abre sin señal con
  la última vista conocida, y lo que se escriba se encola y sale al reconectar.
- **Sin fuentes web ni imágenes.** Cada byte cuenta; los íconos son SVG de trazo
  generados en el bundle y el logo es un PNG de 686 bytes.
- **Leaflet + OpenStreetMap.** Sin llave de API ni tarjeta de crédito, así que se
  levanta en minutos. Ver la advertencia de teselas más abajo.

## Puesta en marcha

```bash
npm install
```

Si npm se queda colgado, ver *IPv6* al final.

### 1. Consola de Firebase

En el proyecto `ayuda-humanitaria-89e72`:

1. **Firestore Database** → crear base de datos (modo producción, región
   cercana a la zona afectada).
2. **Authentication** → *Sign-in method* → habilitar **Anónimo** (obligatorio:
   toda la app depende de él) y **Correo/contraseña** (para los validadores).

### 2. Reglas e índices

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 3. Acreditar validadores

Un validador es una cuenta de correo con un documento que lo respalda. No hay
forma de autoproclamarse: el documento solo se crea desde la consola.

1. **Authentication** → *Add user* con correo y contraseña. Copia el UID.
2. **Firestore** → colección `validators` → documento con ese UID exacto:
   ```
   name: "Bomberos 3ª Compañía"
   zone: "Sector Norte"
   ```

### 4. Desarrollo y despliegue

```bash
npm run dev
```

```bash
npm run deploy
```

## Emuladores y pruebas de seguridad

Las reglas son la única barrera entre un teléfono privado y cualquier
desconocido, así que están cubiertas por pruebas. En una terminal:

```bash
npm run emulators
```

Y en otra:

```bash
npm run test:rules
```

Son 49 casos escritos como situaciones de terreno, no como reglas abstractas:
que un tercero no vea el teléfono antes de comprometerse, que un cupo de otra
necesidad no sirva, que el contador de cupos no se pueda saltar, que quien
entrega no pueda cerrar la necesidad, que nadie se autoproclame validador, y
que una cuenta bloqueada no pueda publicar ni denunciar.

Para probar la app contra los emuladores en vez de contra producción:

```bash
npm run dev:emu
```

## Antes de abrirlo al público

Tres cosas que un despliegue real necesita y este MVP todavía no trae:

1. **App Check** (reCAPTCHA Enterprise). Es lo primero. La identidad anónima es
   gratuita, así que cupos y bloqueos se esquivan creando otra cuenta; App Check
   es lo que hace cara esa creación. Sin él, las defensas frenan al oportunista
   pero no al atacante con un script. Ver [SEGURIDAD.md](SEGURIDAD.md).
2. **Teselas del mapa propias.** El default apunta a
   `tile.openstreetmap.org`, cuya política de uso no cubre picos masivos.
   Configura un proveedor propio antes de un lanzamiento amplio:
   ```
   NEXT_PUBLIC_TILE_URL=https://…/{z}/{x}/{y}.png
   NEXT_PUBLIC_TILE_ATTRIBUTION=…
   ```
3. **Centro del mapa.** Por defecto cae en Santiago de Chile. Ajusta la zona de
   la emergencia:
   ```
   NEXT_PUBLIC_DEFAULT_LAT=-33.45
   NEXT_PUBLIC_DEFAULT_LNG=-70.66
   ```

También conviene revisar la retención de datos: los reportes guardan teléfono y
coordenadas de personas en situación vulnerable, y hoy nada los borra.

## Estructura

```
app/                    rutas: inicio, /necesito, /ayudar, /necesidad, /mis-reportes, /validador
components/             UI sin estado + mapas Leaflet (carga diferida, solo cliente)
lib/                    firebase, auth, acceso a datos, geo, tipos
public/                 manifest, service worker, íconos
firestore.rules         modelo de permisos completo
scripts/test-rules.mjs  20 pruebas del modelo de seguridad
scripts/make-icons.mjs  regenera los PNG del logo
```

Firebase solo se carga en las pantallas que lo usan, no en el layout raíz. Por
eso la portada pesa 110 kB y el resto 250 kB (gzip). Es la diferencia entre
tocar un botón al segundo o al cuarto en una red saturada.

## Nota: IPv6 y npm

Si `npm install` se cuelga en esta red, es porque el IPv6 completa el handshake
TCP pero descarta los paquetes grandes del TLS. Node elige IPv6 y queda
esperando; curl no falla porque hace fallback. Solución:

```bash
NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection" npm install
```
