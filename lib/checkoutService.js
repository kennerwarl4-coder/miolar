"use strict";

const crypto = require("crypto");
const QRCode = require("qrcode");
const { createPixCharge, getTransaction } = require("./sigilopay");

// Lógica compartilhada entre o servidor local (server.js, via Express) e as
// funções serverless do Vercel (api/**), pra não duplicar o mesmo código nos dois lugares.

async function createPix({ amount, customer, utm }) {
  if (!amount || !customer || !customer.name || !customer.email || !customer.document) {
    const err = new Error("Dados incompletos: amount, customer.name, customer.email e customer.document (CPF) são obrigatórios.");
    err.statusCode = 400;
    throw err;
  }

  const identifier = "miolar-" + Date.now().toString(36) + "-" + crypto.randomBytes(3).toString("hex");

  // utm_source/medium/campaign/content/term + fbclid/gclid, capturados no
  // front-end (index.html/checkout.html) e guardados na transação — assim dá
  // pra ver qual campanha gerou a venda direto no painel da SigiloPay, mesmo
  // sem uma integração de API com a Utmify.
  const metadata = { origin: "checkout-miolar" };
  if (utm && typeof utm === "object") {
    Object.keys(utm).forEach(function (key) {
      if (utm[key]) metadata[key] = String(utm[key]).slice(0, 200);
    });
  }

  // Não mandamos callbackUrl aqui de propósito: a SigiloPay conta cada chamada
  // com callbackUrl contra um limite de 20 webhooks (mesmo repetindo a mesma URL).
  // Em vez de depender de webhook, o status é consultado ao vivo (veja getStatus).
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
    metadata: metadata
  });

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

// Consulta o status direto na SigiloPay pelo identifier que geramos na criação
// (não precisa de webhook nem de guardar estado em disco — funciona de forma
// confiável em serverless).
async function getStatus(identifier) {
  const transaction = await getTransaction({ clientIdentifier: identifier });
  return { status: transaction.status };
}

// Best-effort: se um webhook algum dia chegar (ex: configurado manualmente no
// painel da SigiloPay), só loga — o status real já vem da consulta ao vivo acima.
function handleWebhook(body) {
  const identifier = body && body.transaction && body.transaction.identifier;
  const status = body && body.transaction && body.transaction.status;
  console.log("Webhook SigiloPay recebido:", identifier || "(sem identifier)", "->", status || "(sem status)");
}

module.exports = { createPix, getStatus, handleWebhook };
