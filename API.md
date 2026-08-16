# API pública de Ayuda Humanitaria

Para otras plataformas que atienden la misma emergencia. Sin llave, sin
registro, sin cuota. Basta con pedir.

En una emergencia, tres mapas distintos con datos parciales son peores que uno
con todos: la gente no sabe cuál mirar. Esto existe para que un albergue
publicado aquí aparezca en tu app sin que nadie lo teclee dos veces.

Base: `https://ayudahumanitaria.info/api`
(también `https://ayuda-humanitaria-89e72.web.app/api`)

---

## `GET /api/puntos.geojson`

Albergues, puntos de acopio, puestos de salud, agua potable y comida. **Solo los
activos.**

GeoJSON estándar: lo abre QGIS, Leaflet, Mapbox o cualquier librería de mapas
sin conversión.

```json
{
  "type": "FeatureCollection",
  "generado": "2026-08-16T22:23:46.150Z",
  "fuente": "Ayuda Humanitaria",
  "licencia": "Uso libre citando la fuente",
  "features": [
    {
      "type": "Feature",
      "id": "AbC123",
      "geometry": { "type": "Point", "coordinates": [-76.5407, 3.4206] },
      "properties": {
        "tipo": "albergue",
        "nombre": "Coliseo El Pueblo",
        "direccion": "Carrera 52 con calle 5, Cali",
        "horario": "24 horas",
        "notas": "Reciben familias con niños",
        "telefono": "3001234567",
        "zona": "valle",
        "confirmadoEnTerreno": true,
        "confirmadoPor": "Defensa Civil Comuna 3",
        "publicadoPor": "Defensa Civil Comuna 3",
        "actualizado": "2026-08-16T14:02:11.000Z"
      }
    }
  ]
}
```

`tipo` es uno de: `albergue`, `acopio`, `salud`, `agua`, `comida`.

**`geometry` puede ser `null`.** Muchos puntos se dan por dirección escrita y no
por coordenadas. Se incluyen igual: se pierden en un mapa pero no en una lista, y
omitirlos escondería albergues que existen. Trátalo, no lo asumas.

Los publica un coordinador acreditado, nunca un anónimo: a un albergue se llega
caminando y con la familia, y un dato falso ahí se paga caro.

**Mirá `confirmadoEnTerreno` antes de republicar.** Cuando es `false`, el dato
viene de una lista o de un aviso, pero nadie se paró todavía en la puerta. Sigue
siendo útil —una familia que no se entera de un albergue real también duerme
afuera— pero mostralo con la misma advertencia con que lo mostramos nosotros. Un
`false` presentado como certeza manda gente a caminar por nada.

---

## `GET /api/resumen.json`

Necesidades abiertas, **solo en agregado**.

```json
{
  "generado": "2026-08-16T22:23:32.650Z",
  "abiertas": 8,
  "porZona": { "valle": 3, "risaralda": 1, "otra": 4 },
  "porCategoria": { "medico": 5, "rescate": 1, "otro": 2 },
  "porEstado": { "abierta": 8 }
}
```

Sirve para saber dónde y de qué tipo se concentra la demanda, que es lo que se
necesita para repartir recursos.

---

## Por qué el detalle de las necesidades no está abierto

Es deliberado, no una tarea pendiente.

Una necesidad lleva la referencia escrita de quien la pidió. Cuando esa
referencia es *"Carrera 16 #3-51"* y la descripción es *"insulina para mi tía que
depende de esto"*, el conjunto identifica a una persona vulnerable y dice
exactamente qué le falta.

Dentro de la app, alcanzar el teléfono de alguien cuesta un cupo y queda anotado
con nombre, precisamente para que nadie coseche contactos de damnificados. Abrir
las direcciones en una sola petición contradiría esa misma decisión, y el primer
beneficiado sería quien busca a quién estafar.

**Si tu organización necesita ese nivel de detalle**, escríbenos a
`errantelegal@gmail.com`: se resuelve con un acuerdo y una llave, no cerrando la
puerta. Contanos quiénes son y para qué, y lo armamos.

---

## Cosas prácticas

- **CORS abierto** (`Access-Control-Allow-Origin: *`): consúmelo desde el
  navegador sin proxy.
- **Cache de 5 minutos** en el CDN. No hace falta que guardes copia ni que
  limites tu frecuencia; pedir cada minuto no molesta a nadie.
- **Sin versionado todavía.** Si algo cambia de forma, se avisa por el correo de
  arriba. Escríbenos para que sepamos a quién avisar.
- **Atribución**: cita "Ayuda Humanitaria" y enlaza a
  `https://ayudahumanitaria.info`. Es lo único que pedimos.

## Lo que nos sirve de vuelta

Si publicás albergues o acopios que acá no están, avisanos. Lo ideal es que
nadie tenga que elegir entre plataformas: que quien busque dónde dormir esta
noche lo encuentre, entre por donde entre.

Y si tenés una API abierta, pasánosla. Consumimos con gusto lo que ya esté
publicado en otro lado antes que pedirle a un coordinador que lo teclee de
nuevo: cada dato que se captura dos veces es tiempo robado a la emergencia.
