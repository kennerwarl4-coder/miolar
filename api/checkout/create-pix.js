"use strict";

const { createPix } = require("../../lib/checkoutService");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await createPix(req.body || {});
    res.status(200).json(result);
  } catch (err) {
    console.error("Erro ao criar cobrança Pix:", err.message);
    res.status(err.statusCode || 500).json({ error: err.message, errorCode: err.errorCode });
  }
};
