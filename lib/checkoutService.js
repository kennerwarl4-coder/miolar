"use strict";

const crypto = require("crypto");
const QRCode = require("qrcode");
const { createPixCharge } = require("./sigilopay");
const store = require("./store");

// Lógica compartilhada entre o servidor local (server.js, via Express) e as
// funções serverless do Vercel (api/**), pra não duplicar o mesmo código nos dois lugares.

async function createPix({ amount, customer }) {
  if (!amount || !customer || !customer.name || !customer.email || !customer.document) {
    const err = new Error("Dados incompletos: amount, customer.name, customer.email e customer.document (CPF) são obrigatórios.");
    err.statusCode = 400;
    throw err;
  }

  const identifier = "miolar-" + Date.now().toString(36) + "-" + crypto.randomBytes(3).toString("hex");
  const callbackUrl = process.env.PUBLIC_URL ? process.env.PUBLIC_URL + "/api/webhooks/sigilopay" : undefined;

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

  return {
    identifier,
    transactionId: charge.transactionId,
    qrCode,
    pixCopyPaste: charge.pixCode || ""
  };
}

function getStatus(identifier) {
  const record = store.get(identifier);
  if (!record) {
    const err = new Error("Pedido não encontrado.");
    err.statusCode = 404;
    throw err;
  }
  return { status: record.status };
}

function handleWebhook(body) {
  const identifier = body && body.transaction && body.transaction.identifier;
  const status = body && body.transaction && body.transaction.status;

  if (identifier && status) {
    store.save(identifier, { status });
    console.log("Webhook SigiloPay:", identifier, "->", status);
  } else {
    console.warn("Webhook SigiloPay com formato inesperado:", JSON.stringify(body).slice(0, 300));
  }
}

module.exports = { createPix, getStatus, handleWebhook };
