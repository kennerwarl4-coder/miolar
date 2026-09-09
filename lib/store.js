"use strict";

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "transactions.json");

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
