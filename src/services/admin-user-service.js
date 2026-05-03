const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");

function serializeAdminUserWithAccess(user) {
  return {
    id: user.id,
    email: user.email,
    isActive: Boolean(user.isActive),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    senderProfileIds: (user.senderProfileAccess || []).map((entry) => entry.senderProfileId),
    senderProfiles: (user.senderProfileAccess || []).map((entry) => ({
      id: entry.senderProfile.id,
      name: entry.senderProfile.name,
      domain: entry.senderProfile.domain,
      fromEmail: entry.senderProfile.fromEmail,
    })),
  };
}

async function listAdminUsers() {
  return prisma.adminUser.findMany({
    include: {
      senderProfileAccess: {
        include: {
          senderProfile: true,
        },
        orderBy: {
          senderProfile: { name: "asc" },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function createAdminUser(email, password, senderProfileIds = []) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      isActive: true,
      senderProfileAccess: senderProfileIds.length
        ? {
            createMany: {
              data: senderProfileIds.map((senderProfileId) => ({ senderProfileId })),
              skipDuplicates: true,
            },
          }
        : undefined,
    },
    include: {
      senderProfileAccess: {
        include: {
          senderProfile: true,
        },
      },
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

async function updateAdminUser(id, input) {
  const existing = await prisma.adminUser.findUnique({
    where: { id },
  });

  if (!existing) {
    return null;
  }

  const data = {
    email: input.email,
    isActive: Boolean(input.isActive),
  };

  if (input.password) {
    data.passwordHash = await bcrypt.hash(input.password, 10);
  }

  return prisma.$transaction(async (tx) => {
    await tx.adminUser.update({
      where: { id },
      data,
    });

    await tx.adminUserSenderProfileAccess.deleteMany({
      where: { adminUserId: id },
    });

    if (Array.isArray(input.senderProfileIds) && input.senderProfileIds.length > 0) {
      await tx.adminUserSenderProfileAccess.createMany({
        data: input.senderProfileIds.map((senderProfileId) => ({
          adminUserId: id,
          senderProfileId,
        })),
        skipDuplicates: true,
      });
    }

    return tx.adminUser.findUnique({
      where: { id },
      include: {
        senderProfileAccess: {
          include: {
            senderProfile: true,
          },
          orderBy: {
            senderProfile: { name: "asc" },
          },
        },
      },
    });
  });
}

async function listAllowedSenderProfileIdsForUser(userId) {
  if (!userId || Number(userId) === 0) {
    return null;
  }

  const access = await prisma.adminUserSenderProfileAccess.findMany({
    where: { adminUserId: Number(userId) },
    select: { senderProfileId: true },
  });

  return access.map((entry) => entry.senderProfileId);
}

module.exports = {
  listAdminUsers,
  createAdminUser,
  updateAdminPassword,
  updateAdminUser,
  listAllowedSenderProfileIdsForUser,
  serializeAdminUserWithAccess,
};
