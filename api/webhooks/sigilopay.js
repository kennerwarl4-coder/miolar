"use strict";

const { handleWebhook } = require("../../lib/checkoutService");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    handleWebhook(req.body || {});
  } catch (err) {
    console.error("Erro processando webhook da SigiloPay:", err.message);
  }

  // Sempre responde 200 — se devolvermos erro aqui, a SigiloPay reenvia o
  // mesmo evento várias vezes achando que falhou.
  res.status(200).send("OK");
};
