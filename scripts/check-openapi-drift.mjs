// Compara a cópia do contrato do front (openapi/openapi.json) com o docs/openapi.json da develop
// do tedi-back. Só AVISA: sempre termina com código 0, para nunca derrubar o job da CI.
// A comparação é semântica (JSON.parse + chaves ordenadas): a formatação do oxfmt não conta.
//
// Uso: node scripts/check-openapi-drift.mjs [front.json] [back.json | URL]
import { appendFile, readFile } from "node:fs/promises";

const FRONT_DEFAULT = "openapi/openapi.json";
const BACK_DEFAULT =
  "https://raw.githubusercontent.com/projetotedi/tedi-back/develop/docs/openapi.json";
const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
const SYNC_HINT = "Sincronize seguindo o passo 5 de docs/ARCHITECTURE.md.";

function canonical(value) {
  return JSON.stringify(value, (_key, current) =>
    current && typeof current === "object" && !Array.isArray(current)
      ? Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)))
      : current,
  );
}

function operationsOf(spec) {
  const operations = new Map();
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = item?.[method];
      if (!operation) continue;
      const id = operation.operationId ?? `${method.toUpperCase()} ${path}`;
      operations.set(id, canonical({ method, path, parameters: item.parameters, operation }));
    }
  }
  return operations;
}

function schemasOf(spec) {
  const schemas = new Map();
  for (const [name, schema] of Object.entries(spec.components?.schemas ?? {})) {
    schemas.set(name, canonical(schema));
  }
  return schemas;
}

function compare(frontMap, backMap) {
  const missing = [...backMap.keys()].filter((key) => !frontMap.has(key)).sort();
  const extra = [...frontMap.keys()].filter((key) => !backMap.has(key)).sort();
  const changed = [...frontMap.keys()]
    .filter((key) => backMap.has(key) && frontMap.get(key) !== backMap.get(key))
    .sort();
  return { missing, extra, changed };
}

function diffContracts(front, back) {
  const operations = compare(operationsOf(front), operationsOf(back));
  const schemas = compare(schemasOf(front), schemasOf(back));
  const hasDrift = [operations, schemas].some(
    (d) => d.missing.length + d.extra.length + d.changed.length > 0,
  );
  const otherDrift = !hasDrift && canonical(front) !== canonical(back);
  return { operations, schemas, otherDrift, inSync: !hasDrift && !otherDrift };
}

async function loadBack(source) {
  if (!/^https?:\/\//.test(source)) return JSON.parse(await readFile(source, "utf8"));
  const response = await fetch(source, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} ao baixar ${source}`);
  return response.json();
}

// Comandos de workflow do GitHub: %, \r e \n precisam ser escapados na mensagem.
function warning(title, message) {
  const escaped = message.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  console.log(`::warning title=${title}::${escaped}`);
}

async function summary(markdown) {
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}

function list(items) {
  return items.length > 0 ? items.map((item) => `\`${item}\``).join(", ") : "—";
}

async function main() {
  const [frontPath = FRONT_DEFAULT, backSource = BACK_DEFAULT] = process.argv.slice(2);
  const front = JSON.parse(await readFile(frontPath, "utf8"));
  const back = await loadBack(backSource);
  const { operations, schemas, otherDrift, inSync } = diffContracts(front, back);

  if (inSync) {
    await summary(
      `### Contrato OpenAPI\n\n\`${frontPath}\` está igual ao \`docs/openapi.json\` da develop do tedi-back.`,
    );
    return;
  }

  const lines = [
    `Faltam no front: ${operations.missing.join(", ") || "nenhuma"}`,
    `Sobram no front: ${operations.extra.join(", ") || "nenhuma"}`,
    `Mudaram: ${operations.changed.join(", ") || "nenhuma"}`,
    `Schemas faltando/sobrando/mudados: ${schemas.missing.length}/${schemas.extra.length}/${schemas.changed.length}`,
  ];
  if (otherDrift) lines.push("Diferenças fora de paths e schemas (info, securitySchemes...).");
  warning(
    "Contrato OpenAPI desatualizado",
    `${frontPath} diverge do docs/openapi.json da develop do tedi-back.\n${lines.join("\n")}\n${SYNC_HINT}`,
  );
  await summary(
    [
      "### Contrato OpenAPI desatualizado",
      "",
      `\`${frontPath}\` diverge do \`docs/openapi.json\` da develop do tedi-back. ${SYNC_HINT}`,
      "",
      "| | Operações (`operationId`) | Schemas |",
      "| --- | --- | --- |",
      `| Faltam no front | ${list(operations.missing)} | ${list(schemas.missing)} |`,
      `| Sobram no front | ${list(operations.extra)} | ${list(schemas.extra)} |`,
      `| Mudaram | ${list(operations.changed)} | ${list(schemas.changed)} |`,
      ...(otherDrift ? ["", "Há diferenças fora de `paths` e `components.schemas`."] : []),
    ].join("\n"),
  );
}

try {
  await main();
} catch (error) {
  warning(
    "Contrato OpenAPI não verificado",
    `Não foi possível comparar o contrato: ${error.message}${error.cause?.code ? ` (${error.cause.code})` : ""}`,
  );
}
