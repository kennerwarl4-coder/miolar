"use strict";

const { getStatus } = require("../../../lib/checkoutService");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    res.status(200).json(await getStatus(req.query.identifier));
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};
