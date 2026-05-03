const express = require("express");
const prisma = require("../lib/prisma");
const { normalizeEmail } = require("../utils/unsubscribe");

const router = express.Router();

router.get("/unsubscribe", async (req, res) => {
  const token = String(req.query.token || "");
  const unsubscribe = await prisma.unsubscribe.findUnique({ where: { token } });

  if (!unsubscribe) {
    return res.status(404).render("public/unsubscribe", {
      title: "Unsubscribe",
      success: false,
      email: null,
    });
  }

  await prisma.unsubscribe.update({
    where: { token },
    data: {
      email: normalizeEmail(unsubscribe.email),
      unsubscribedAt: new Date(),
    },
  });

  return res.render("public/unsubscribe", {
    title: "Unsubscribe",
    success: true,
    email: unsubscribe.email,
  });
});

module.exports = router;
