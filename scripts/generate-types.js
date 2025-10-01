const { compileFromFile } = require("json-schema-to-typescript");
const fs = require("fs");
const path = require("path");

async function generate() {
  const schemasDir = path.join(__dirname, "../schemas/ocpp/1.6");
  const typesDir = path.join(__dirname, "../types/ocpp/1.6");

  if (!fs.existsSync(typesDir)) {
    fs.mkdirSync(typesDir, { recursive: true });
  }

  const files = fs.readdirSync(schemasDir).filter(f => f.endsWith(".json"));

  for (const file of files) {
    const schemaPath = path.join(schemasDir, file);
    const ts = await compileFromFile(schemaPath, {
      bannerComment: `/* Auto-generated from ${file}, do not edit manually */`
    });
    fs.writeFileSync(path.join(typesDir, file.replace(/\.json$/, ".d.ts")), ts);
  }
}

generate().catch(err => {
  console.error("Ошибка генерации:", err);
  process.exit(1);
});
