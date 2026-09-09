"use strict";

require("dotenv").config();
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const QRCode = require("qrcode");
const { createPixCharge } = require("./lib/sigilopay");
const store = require("./lib/store");

const app = express();
app.use(express.json());

// Serve o site estático (index.html, checkout.html, imagens/) a partir da raiz do projeto.
app.use(express.static(path.join(__dirname)));

// Cria uma cobrança Pix para o pedido do checkout.
// O front-end (checkout.html) chama esta rota — nunca a API da SigiloPay diretamente,
// porque a chave secreta só existe aqui no servidor.
app.post("/api/checkout/create-pix", async (req, res) => {
  const { amount, customer } = req.body || {};

  if (!amount || !customer || !customer.name || !customer.email || !customer.document) {
    return res.status(400).json({ error: "Dados incompletos: amount, customer.name, customer.email e customer.document (CPF) são obrigatórios." });
  }

  const identifier = "miolar-" + Date.now().toString(36) + "-" + crypto.randomBytes(3).toString("hex");
  const callbackUrl = process.env.PUBLIC_URL ? process.env.PUBLIC_URL + "/api/webhooks/sigilopay" : undefined;

  try {
    const charge = await createPixCharge({
      identifier,
      amount,
      client: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        document: customer.document
      },
      products: [{ id: "kit-estacao-hidratacao", name: "Kit Estação de Hidratação", quantity: 1, price: amount }],
      callbackUrl,
      metadata: { origin: "checkout-miolar" }
    });

    store.save(identifier, { status: "PENDING", amount, customer, transactionId: charge.transactionId });

    // A SigiloPay pode não devolver base64/image prontos — nesse caso, geramos
    // o QR a partir do código copia-e-cola (é um BR Code/EMV Pix padrão).
    let qrCode = charge.pixBase64 ? "data:image/png;base64," + charge.pixBase64 : (charge.pixImage || null);
    if (!qrCode && charge.pixCode) {
      qrCode = await QRCode.toDataURL(charge.pixCode, { margin: 1, width: 280 });
    }

    res.json({
      identifier,
      transactionId: charge.transactionId,
      qrCode,
      pixCopyPaste: charge.pixCode || ""
    });
  } catch (err) {
    console.error("Erro ao criar cobrança Pix:", err.message);
    res.status(err.statusCode || 500).json({
      error: err.message,
      errorCode: err.errorCode
    });
  }
});

// Consulta o status de um pedido no NOSSO backend (não faz polling na SigiloPay —
// quem atualiza o status aqui é o webhook abaixo).
app.get("/api/checkout/status/:identifier", (req, res) => {
  const record = store.get(req.params.identifier);
  if (!record) return res.status(404).json({ error: "Pedido não encontrado." });
  res.json({ status: record.status });
});

// Recebe as notificações de status da SigiloPay (configurar essa URL pública
// como callbackUrl — precisa estar acessível pela internet, não localhost).
app.post("/api/webhooks/sigilopay", (req, res) => {
  const event = req.body || {};
  const identifier = event.transaction && event.transaction.identifier;
  const status = event.transaction && event.transaction.status;

  if (identifier && status) {
    store.save(identifier, { status });
    console.log("Webhook SigiloPay:", identifier, "->", status);
  } else {
    console.warn("Webhook SigiloPay com formato inesperado:", JSON.stringify(event).slice(0, 300));
  }

  res.status(200).send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Miolar rodando em http://localhost:" + PORT);
});
