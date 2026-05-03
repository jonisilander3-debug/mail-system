const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");

async function listAdminUsers() {
  return prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
  });
}

async function createAdminUser(email, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      isActive: true,
    },
  });
}

async function updateAdminPassword(id, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.adminUser.update({
    where: { id },
    data: { passwordHash },
  });
}

module.exports = {
  listAdminUsers,
  createAdminUser,
  updateAdminPassword,
};
