"use strict";

const fs = require("fs");
const path = require("path");

// Em produção no Vercel, a pasta do projeto é somente leitura — só /tmp
// aceita escrita. Mas /tmp também é temporário e pode não ser o mesmo
// entre invocações da função (cada uma pode rodar num container diferente),
// então isso é um remendo pra não crashar, não uma persistência de verdade.
// Pra funcionar de forma confiável em produção, isso precisa virar um banco
// de verdade (Vercel KV, Postgres, etc.) — ou o status-check pode consultar
// a própria SigiloPay via "Buscar transação" em vez de guardar estado aqui.
const FILE = process.env.VERCEL
  ? path.join("/tmp", "transactions.json")
  : path.join(__dirname, "..", "data", "transactions.json");

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function writeAll(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function save(identifier, record) {
  const all = readAll();
  all[identifier] = { ...all[identifier], ...record, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[identifier];
}

function get(identifier) {
  return readAll()[identifier] || null;
}

module.exports = { save, get };
