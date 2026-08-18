# Ayuda Humanitaria

**https://ayudahumanitaria.info**

Centraliza, verifica y geolocaliza las necesidades urgentes de los damnificados
por desastres naturales, y las conecta con los recursos que ofrecen ciudadanos y
empresas. También publica a dónde ir —albergues, puntos de acopio, agua, comida
y atención médica— y las ofertas de quien tiene algo que dar.

Los datos de esos puntos son abiertos y otras plataformas pueden aportar los
suyos ([API.md](API.md)). No para que nadie converja aquí: para que un albergue
publicado una vez aparezca en todos los mapas.

Para poner esto en manos de la comunidad y la operación diaria, ver
[LANZAMIENTO.md](LANZAMIENTO.md). Para el modelo de amenazas y las defensas,
[SEGURIDAD.md](SEGURIDAD.md). Para integrarse desde otra plataforma,
[API.md](API.md).

PWA en Next.js (exportación estática) sobre Firebase. Sin registro para pedir ni
para ofrecer ayuda: la identidad es anónima y automática.

## Cómo funciona

Tres roles, un solo flujo:

- **Solicitante** — 4 toques: categoría → una frase → ubicación y teléfono →
  ticket con código. El teléfono nunca aparece en el mapa público.
- **Quien ofrece** — puede publicar lo que tiene en `/ofrezco/`, y aparece en
  `/ofertas/` para quien lo necesite. Aquí el teléfono **sí** es público: se
  publica para que llamen, y ponerle un peaje sería cobrárselo a quien lo
  necesita. Ver [SEGURIDAD.md](SEGURIDAD.md) para la asimetría completa.
- **Oferente** — lista y mapa filtrables por categoría, ordenados por
  verificación y cercanía. `YO LO CUBRO` bloquea la necesidad 3 horas mediante
  una transacción, para que dos personas no gasten recursos en lo mismo. Recién
  ahí se le revela el contacto.
- **Validador** — coordinador acreditado (ONG, bomberos, junta de vecinos).
  Confirma que la necesidad es real, revisa denuncias, libera compromisos que no
  se concretaron, descarta reportes falsos y bloquea cuentas abusivas. También
  publica los puntos a donde ir y ubica en el mapa los reportes que llegaron sin
  coordenadas.

El autor puede corregir su propio reporte mientras siga abierto; al hacerlo se
cae la verificación, porque un coordinador confirmó un texto y ese texto cambió.

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
- **Leaflet + Stadia Maps, estilo oscuro.** Autenticado por dominio, sin llave
  en el bundle. El estilo oscuro no es estética: un mapa blanco es la superficie
  que más batería consume y la que peor se lee bajo el sol, justo lo que el
  diseño negro quiere evitar. El service worker guarda las teselas ya vistas, de
  modo que el mapa sigue sirviendo sin señal en las zonas visitadas.

## Puesta en marcha

```bash
npm install
```

Si npm se queda colgado, ver *IPv6* al final.

### 1. Configuración

Copia `.env.example` a `.env.local` y complétalo. Las variables `NEXT_PUBLIC_*`
viajan al navegador por diseño; la seguridad real vive en `firestore.rules`.

### 2. Reglas, índices y funciones

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
```

### 3. Acreditar validadores

```bash
node scripts/validadores.mjs crear "Defensa Civil Comuna 3" "Valle del Cauca" coordinacion@ong.org
```

Crea la cuenta, la acredita y envía un correo para que definan su contraseña.
Ningún cliente puede crear el documento que otorga el rol. Detalle y criterios
en [LANZAMIENTO.md](LANZAMIENTO.md).

### 4. Desarrollo y despliegue

```bash
npm run dev
```

```bash
npm run deploy
```

## Antes de desplegar

```bash
npm run check   # tipos + reglas de React + 95 pruebas
npm run build && npx firebase deploy
npm run humo    # abre las 12 pantallas en un navegador real
```

`npm run deploy` encadena `check` para que la puerta no se salte por descuido.
Existe porque un `useState` colocado bajo un `return` temprano tumbó todas las
fichas de necesidad en producción, y ni los tipos ni las pruebas lo veían:
ninguna monta una pantalla.

## Pruebas

```bash
npm test
```

Levanta los emuladores, corre las 95 pruebas y los apaga. No necesita
dependencias extra: usa el runner de Node.

Cinco capas:

- **`tests/unit.test.mjs`** — lógica pura: distancias, formatos de tiempo, y
  comprobaciones de que el código y `firestore.rules` no se desincronicen
  (categorías, motivos de denuncia, tope de cupo).
- **`tests/journeys.test.mjs`** — recorridos completos con varios actores,
  ejecutando **el mismo código que corre en el navegador**: se pide, se cubre,
  se entrega, se confirma; se abandona y otro retoma; se denuncia y se descarta.
- **`tests/rules.test.mjs`** — lo que la app nunca enviaría y un atacante sí:
  campos fuera de rango, escalada de privilegios, manipulación del ledger.
- **`tests/offline.test.mjs`** — el camino sin señal: que reportar no se cuelgue,
  que lo encolado llegue al reconectar, y que lo que exige red lo diga claro.
- **`tests/recovery.test.mjs`** — recuperar un reporte cuando el dispositivo
  perdió su identidad, y que el código no sirva para robar reportes ajenos.

Solo la capa pura, sin emuladores:

```bash
npm run test:unit
```

Para usar la app contra los emuladores en vez de producción:

```bash
npm run dev:emu
```

## Adaptarlo a otra emergencia

Tres lugares, y ninguno más:

1. **`lib/zones.ts`** — los focos de la emergencia. Es lo que permite que un
   voluntario sepa si lo que lee le queda cerca o a 250 km.
2. **`NEXT_PUBLIC_DEFAULT_LAT` / `LNG` / `ZOOM`** — dónde arranca el mapa.
3. **`firestore.rules`** — la lista cerrada de zonas válidas, que debe coincidir
   con `lib/zones.ts`. Una prueba comprueba que no se desincronicen.

## Scripts

```
scripts/validadores.mjs  acreditar, listar y revocar coordinadores
scripts/socios.mjs       llaves para organizaciones que aportan datos
scripts/puntos.mjs       carga albergues y acopios desde una lista de texto
scripts/importar.mjs     trae ofertas de la API de otra plataforma
scripts/diagnosticos.mjs fallos del cliente de las últimas horas, agrupados
scripts/humo.mjs         abre cada pantalla en un navegador real
```

## Estructura

```
app/            inicio, /necesito, /ayudar, /necesidad, /donde-ir, /ofertas,
                /ofrezco, /mis-reportes, /recuperar, /clave, /validador,
                /validador/puntos, /aliados, /como-usar, /legal
components/     UI sin estado + mapas Leaflet (carga diferida, solo cliente)
lib/            firebase, auth, acceso a datos, geo, tipos, diagnóstico de fallos
public/         manifest, service worker, íconos
functions/      ráfagas, purga de datos, recuperación, y la API pública
tests/          95 pruebas: unitarias, recorridos, reglas, sin señal
firestore.rules modelo de permisos completo
scripts/        ver más arriba
```

Firebase solo se carga en las pantallas que lo usan, no en el layout raíz. Por
eso la portada pesa unos 105 kB y las pantallas con datos unos 225 kB
comprimidos, medido por el cable. Es la diferencia entre tocar un botón al
segundo o al cuarto en una red saturada. Después de la primera visita lo sirve
el service worker desde el teléfono.

## Nota: IPv6 y npm

Si `npm install` se cuelga en esta red, es porque el IPv6 completa el handshake
TCP pero descarta los paquetes grandes del TLS. Node elige IPv6 y queda
esperando; curl no falla porque hace fallback. Solución:

```bash
NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection" npm install
```


## Licencia

MIT. Úsalo, adáptalo y despliégalo sin pedir permiso, incluso comercialmente:
solo conserva el aviso de autoría.

Si tu emergencia es otra —otro país, otro desastre— monta tu propia instancia en
vez de esperar a que alguien cubra tu zona. Está pensado para eso: mira
"Adaptarlo a otra emergencia" más arriba. No hace falta avisar, aunque si nos
escribes te ayudamos con lo que ya sabemos que duele.

## Intercambio con otras plataformas

Los datos de puntos son públicos y sin llave (`API.md`), y otras organizaciones
pueden aportar los suyos. La página `/aliados/` lo explica de cara al público y
reconoce a quien colabora.

Funciona en las dos direcciones: `scripts/importar.mjs` trae las ofertas de una
plataforma aliada y las publica con su nombre y un enlace a su ficha. Republicar
sin decir de dónde viene convertiría un intercambio en una apropiación.

Lo que **no** se abre es el detalle de las necesidades: llevan la referencia
escrita de una persona damnificada y abrir esas direcciones en una sola petición
le serviría antes que a nadie a quien busca a quién estafar.
