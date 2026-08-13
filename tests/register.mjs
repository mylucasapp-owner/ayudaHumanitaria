// Punto de entrada para `node --import`: instala el resolvedor de las pruebas.
import { register } from "node:module";

register("./ts-resolver.mjs", import.meta.url);
