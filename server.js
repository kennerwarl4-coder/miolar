"use strict";

require("dotenv").config();
const path = require("path");
const express = require("express");
const { createPix, getStatus, handleWebhook } = require("./lib/checkoutService");

// Servidor local, pra rodar com `npm start` durante o desenvolvimento.
// Em produção no Vercel, quem atende essas mesmas rotas são as funções
// serverless em api/** — ambos usam a mesma lógica de lib/checkoutService.js.

const app = express();
app.use(express.json());

// Serve o site estático (index.html, checkout.html, imagens/) a partir da raiz do projeto.
app.use(express.static(path.join(__dirname)));

app.post("/api/checkout/create-pix", async (req, res) => {
  try {
    const result = await createPix(req.body || {});
    res.json(result);
  } catch (err) {
    console.error("Erro ao criar cobrança Pix:", err.message);
    res.status(err.statusCode || 500).json({ error: err.message, errorCode: err.errorCode });
  }
});

app.get("/api/checkout/status/:identifier", (req, res) => {
  try {
    res.json(getStatus(req.params.identifier));
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post("/api/webhooks/sigilopay", (req, res) => {
  try {
    handleWebhook(req.body || {});
  } catch (err) {
    console.error("Erro processando webhook da SigiloPay:", err.message);
  }
  res.status(200).send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Miolar rodando em http://localhost:" + PORT);
});
