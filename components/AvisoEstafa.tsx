/**
 * Aviso permanente contra el fraude más común de cualquier desastre.
 *
 * Un tablón de ofertas atrae a quien pide un depósito por adelantado y
 * desaparece, y la víctima es alguien que ya lo perdió todo. No es hipotético:
 * es el patrón que aparece en todas las emergencias apenas circula dinero.
 *
 * Va fijo y no escondido tras un enlace, porque quien está desesperado no lee
 * la letra pequeña ni entra a los términos.
 */
export default function AvisoEstafa() {
  return (
    <p className="notice notice--error">
      <span className="strong">La ayuda no se paga. Nunca.</span> Si alguien te
      pide plata, un depósito, una recarga o datos de tu cuenta, es una estafa:
      no le pagues y denúncialo desde la ficha.
    </p>
  );
}
