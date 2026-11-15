const CPF_LENGTH = 11;
const CPF_DIGITS = /^\d{11}$/;
const CPF_SEPARATORS = /[\s.-]/g;

/** Só os dígitos: o que a máscara conta e o que o corpo do aceite leva (CPF e telefone). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Dígito verificador da posição `length` (9 ou 10): soma ponderada dos dígitos anteriores, com
 * pesos de `length + 1` até 2, depois (soma * 10) mod 11, com resto 10 valendo 0.
 */
function checkDigit(digits: readonly number[], length: number): number {
  let sum = 0;
  for (let index = 0; index < length; index++) {
    sum += digits[index] * (length + 1 - index);
  }
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/**
 * Mesmo critério do back (people/validators/cpf.ts): 11 dígitos, nem todos iguais e os dois
 * dígitos verificadores certos. Aceita a pontuação do CPF (ponto, hífen, espaço); uma letra deixa
 * o valor inválido, como no back, em vez de ser descartada em silêncio.
 */
export function isValidCpf(value: string): boolean {
  const normalized = value.replace(CPF_SEPARATORS, "");
  if (normalized.length !== CPF_LENGTH || !CPF_DIGITS.test(normalized)) return false;

  const digits = [...normalized].map(Number);
  if (digits.every((digit) => digit === digits[0])) return false;

  return checkDigit(digits, 9) === digits[9] && checkDigit(digits, 10) === digits[10];
}
