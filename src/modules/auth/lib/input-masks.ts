import { onlyDigits } from "./cpf";

const CPF_MAX_DIGITS = 11;
const PHONE_MAX_DIGITS = 11;
/** DDI (2) + DDD (2) + 9 dígitos: o maior número com o código do Brasil que a máscara reconhece. */
const PHONE_MAX_DIGITS_WITH_COUNTRY_CODE = 13;
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
 * O "55" do começo é o DDI do Brasil ou o DDD 55 (Rio Grande do Sul: Santa Maria, Uruguaiana...)?
 * Só é DDI quando o texto é, de fato, um número internacional:
 * - começa com "+" ("+55 11 98123-4567"); ou
 * - é uma colagem de 12 ou 13 dígitos ("5511981234567"): o campo estava vazio ou o texto cresceu
 *   mais de um dígito de uma vez. Uma colagem não começa pelo "(" da máscara, cujo parêntese já
 *   guarda o DDD e não deixa lugar para um DDI antes dele.
 *
 * Na digitação, um dígito por vez, o 12º é só excesso e vai fora no corte do 11º, como em qualquer
 * outro DDD. Tratá-lo como DDI trocava "(55) 99123-4567" mais um dígito por "(99) 1234-5678",
 * outro número válido, que passava na validação e chegava ao back com o DDD errado.
 */
function hasBrazilCountryCode(value: string, previous: string): boolean {
  if (value.trim().startsWith("+")) return true;

  const digitCount = onlyDigits(value).length;
  const hasCountryCodeLength =
    digitCount > PHONE_MAX_DIGITS && digitCount <= PHONE_MAX_DIGITS_WITH_COUNTRY_CODE;
  if (!hasCountryCodeLength || value.trimStart().startsWith("(")) return false;

  const previousDigitCount = onlyDigits(previous).length;
  return previousDigitCount === 0 || digitCount - previousDigitCount > 1;
}

/** Número nacional (DDD + 8 ou 9 dígitos): sem o DDI do Brasil, quando o texto o traz. */
function localPhoneDigits(value: string, previous: string): string {
  const digits = onlyDigits(value);
  const hasCountryCode =
    digits.startsWith(BRAZIL_COUNTRY_CODE) && hasBrazilCountryCode(value, previous);
  return hasCountryCode ? digits.slice(BRAZIL_COUNTRY_CODE.length) : digits;
}

/**
 * (00) 0000-0000 ou (00) 00000-0000, conforme a quantidade de dígitos. Mesmas regras do CPF:
 * colagem com qualquer pontuação, nada além de dígitos, corte no 11º e saída idempotente.
 *
 * `previous` é o texto do campo antes desta alteração: com ele a máscara distingue uma colagem de
 * um dígito digitado (ver `hasBrazilCountryCode`). Sem ele, o campo conta como vazio.
 */
export function formatPhone(value: string, previous = ""): string {
  const digits = localPhoneDigits(value, previous).slice(0, PHONE_MAX_DIGITS);
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
