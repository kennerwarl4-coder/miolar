"use strict";

// Client HTTP para a API da SigiloPay. As chaves nunca saem do servidor —
// esse módulo só deve ser importado em código que roda no backend.
//
// As credenciais são lidas dentro das funções (não no topo do arquivo) de
// propósito: se lermos no topo e elas estiverem ausentes (ex: esqueceu de
// configurar as Environment Variables no Vercel), o import inteiro falha e
// a função serverless crasha sem nenhuma mensagem útil (é exatamente o que
// causa aquele erro genérico "This Serverless Function has crashed").
// Checando dentro da função, o erro vira uma resposta JSON normal.
function getCredentials() {
  const BASE_URL = process.env.SIGILOPAY_BASE_URL || "https://app.sigilopay.com.br/api/v1";
  const PUBLIC_KEY = process.env.SIGILOPAY_PUBLIC_KEY;
  const SECRET_KEY = process.env.SIGILOPAY_SECRET_KEY;

  if (!PUBLIC_KEY || !SECRET_KEY) {
    throw new Error(
      "Credenciais da SigiloPay ausentes. No Vercel, configure SIGILOPAY_PUBLIC_KEY e " +
      "SIGILOPAY_SECRET_KEY em Project Settings > Environment Variables (o .env local " +
      "não é enviado no deploy) e refaça o deploy."
    );
  }

  return { BASE_URL, PUBLIC_KEY, SECRET_KEY };
}

async function sigilopayRequest(method, path, body) {
  const { BASE_URL, PUBLIC_KEY, SECRET_KEY } = getCredentials();

  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-public-key": PUBLIC_KEY,
      "x-secret-key": SECRET_KEY
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    throw new Error("Resposta da SigiloPay não é JSON válido (status " + res.status + "): " + text.slice(0, 300));
  }

  if (!res.ok) {
    const err = new Error((data && data.message) || "Erro na requisição à SigiloPay");
    err.statusCode = res.status;
    err.errorCode = data && data.errorCode;
    err.details = data && data.details;
    throw err;
  }

  return data;
}

/**
 * Cria uma cobrança Pix — POST /gateway/pix/receive
 *
 * @param {object} params
 * @param {string} params.identifier   ID único do pedido, gerado por nós (obrigatório)
 * @param {number} params.amount       Valor total em reais (obrigatório)
 * @param {object} params.client       { name, email, phone, document } (obrigatório)
 * @param {Array}  [params.products]   [{ id, name, quantity, price }]
 * @param {string} [params.callbackUrl]
 * @param {object|string} [params.metadata]
 */
async function createPixCharge({ identifier, amount, client, products, callbackUrl, metadata }) {
  if (!identifier || !amount || !client || !client.name || !client.email || !client.document) {
    throw new Error("createPixCharge: identifier, amount e client (name, email, document) são obrigatórios.");
  }

  const body = { identifier, amount, client };
  if (products) body.products = products;
  if (callbackUrl) body.callbackUrl = callbackUrl;
  if (metadata) body.metadata = metadata;

  const data = await sigilopayRequest("POST", "/gateway/pix/receive", body);

  // "status" aqui é o status da TRANSAÇÃO (OK/PENDING = normal ao criar, aguardando
  // pagamento; só FAILED é falha de verdade — não confundir com sucesso da requisição).
  if (data.status === "FAILED") {
    const err = new Error(data.errorDescription || data.details || "A SigiloPay recusou a cobrança Pix.");
    err.statusCode = 400;
    throw err;
  }

  return {
    transactionId: data.transactionId,
    webhookToken: data.webhookToken,
    pixCode: data.pix && data.pix.code,
    pixImage: data.pix && data.pix.image,
    pixBase64: data.pix && data.pix.base64
  };
}

module.exports = { sigilopayRequest, createPixCharge };
