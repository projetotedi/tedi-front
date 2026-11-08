import { onlyDigits } from "./cpf";

const CPF_MAX_DIGITS = 11;
const PHONE_MAX_DIGITS = 11;
/** Com 11 dígitos o número tem o nono dígito do celular: 5 antes do hífen em vez de 4. */
const MOBILE_PHONE_DIGITS = 11;
const BRAZIL_COUNTRY_CODE = "55";

/**
 * 000.000.000-00, aplicada a cada digitação. Aceita colagem com ou sem pontuação, descarta o que
 * não é dígito e corta no 11º dígito. A própria saída volta igual (idempotente).
 */
export function formatCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, CPF_MAX_DIGITS);
  const formatted = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)]
    .filter(Boolean)
    .join(".");
  const checkDigits = digits.slice(9);
  return checkDigits ? `${formatted}-${checkDigits}` : formatted;
}

/**
 * Número nacional (DDD + 8 ou 9 dígitos). O DDI do Brasil que vem colado ("+55 11 98123-4567")
 * sai antes: sem isso o "55" viraria o DDD e o resto do número, errado, mas ainda válido.
 */
function localPhoneDigits(value: string): string {
  const digits = onlyDigits(value);
  const hasCountryCode = value.trim().startsWith("+") || digits.length > PHONE_MAX_DIGITS;
  return hasCountryCode && digits.startsWith(BRAZIL_COUNTRY_CODE) ? digits.slice(2) : digits;
}

/**
 * (00) 0000-0000 ou (00) 00000-0000, conforme a quantidade de dígitos. Mesmas regras do CPF:
 * colagem com qualquer pontuação, nada além de dígitos, corte no 11º e saída idempotente.
 */
export function formatPhone(value: string): string {
  const digits = localPhoneDigits(value).slice(0, PHONE_MAX_DIGITS);
  if (digits.length === 0) return "";

  const areaCode = digits.slice(0, 2);
  if (digits.length <= 2) return `(${areaCode}`;

  const number = digits.slice(2);
  const split = digits.length === MOBILE_PHONE_DIGITS ? 5 : 4;
  const head = number.slice(0, split);
  const tail = number.slice(split);
  return tail ? `(${areaCode}) ${head}-${tail}` : `(${areaCode}) ${head}`;
}

/**
 * Posição do cursor logo depois do `digitCount`-ésimo dígito de `formatted` (0 = início). Serve
 * para devolver o cursor ao lugar certo quando a máscara reescreve o texto no meio da digitação.
 */
export function caretAfterDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;

  let seen = 0;
  for (let index = 0; index < formatted.length; index++) {
    if (/\d/.test(formatted[index])) {
      seen += 1;
      if (seen === digitCount) return index + 1;
    }
  }
  return formatted.length;
}
