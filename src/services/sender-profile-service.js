const prisma = require("../lib/prisma");

async function listSenderProfiles() {
  return prisma.senderProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

async function getDefaultSenderProfile() {
  return prisma.senderProfile.findFirst({
    where: { isDefault: true },
    orderBy: { id: "asc" },
  });
}

function maskToken(token) {
  if (!token) {
    return "";
  }

  if (token.length <= 8) {
    return `${token.slice(0, 2)}****`;
  }

  return `${token.slice(0, 3)}****${token.slice(-4)}`;
}

function normalizeDomain(domain, fromEmail) {
  const explicit = String(domain || "").trim().toLowerCase();
  if (explicit) {
    return explicit;
  }

  const email = String(fromEmail || "").trim().toLowerCase();
  const parts = email.split("@");
  return parts[1] || "";
}

function serializeSenderProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    domain: profile.domain,
    fromName: profile.fromName,
    fromEmail: profile.fromEmail,
    messageStream: profile.messageStream,
    status: profile.status,
    isDefault: profile.isDefault,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    maskedToken: maskToken(profile.postmarkToken),
  };
}

async function ensureDefaultSenderProfile() {
  const existingCount = await prisma.senderProfile.count();
  if (existingCount > 0) {
    const missingDomains = await prisma.senderProfile.findMany({
      where: { domain: "" },
    });

    for (const profile of missingDomains) {
      await prisma.senderProfile.update({
        where: { id: profile.id },
        data: { domain: normalizeDomain("", profile.fromEmail) },
      });
    }

    return prisma.senderProfile.findFirst({
      where: { isDefault: true },
      orderBy: { id: "asc" },
    });
  }

  const defaults = [
    {
      name: "Hetadejten",
      domain: "hetadejten.com",
      fromName: "Hetadejten Support",
      fromEmail: "support@hetadejten.com",
      postmarkToken: "",
      messageStream: "broadcast",
      status: "active",
      isDefault: true,
    },
    {
      name: "Mindate",
      domain: "mindate.se",
      fromName: "Mindate Info",
      fromEmail: "info@mindate.se",
      postmarkToken: "",
      messageStream: "broadcast",
      status: "active",
      isDefault: false,
    },
    {
      name: "Danskeoperator",
      domain: "danskeoperator.com",
      fromName: "Danskeoperator Kundeservice",
      fromEmail: "kundeservice@danskeoperator.com",
      postmarkToken: "",
      messageStream: "broadcast",
      status: "active",
      isDefault: false,
    },
    {
      name: "Sveaportal",
      domain: "sveaportal.se",
      fromName: "Sveaportal Support",
      fromEmail: "support@sveaportal.se",
      postmarkToken: "",
      messageStream: "broadcast",
      status: "active",
      isDefault: false,
    },
    {
      name: "Min Date DK",
      domain: "min-date.dk",
      fromName: "Min Date Service",
      fromEmail: "service@min-date.dk",
      postmarkToken: "",
      messageStream: "broadcast",
      status: "active",
      isDefault: false,
    },
  ];

  await prisma.senderProfile.createMany({
    data: defaults,
  });

  return prisma.senderProfile.findFirst({
    where: { isDefault: true },
    orderBy: { id: "asc" },
  });
}

async function createSenderProfile(input) {
  if (input.isDefault) {
    await prisma.senderProfile.updateMany({
      data: { isDefault: false },
    });
  }

  const profile = await prisma.senderProfile.create({
    data: {
      name: input.name,
      domain: normalizeDomain(input.domain, input.fromEmail),
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      postmarkToken: input.postmarkToken,
      messageStream: input.messageStream,
      status: input.status || "active",
      isDefault: Boolean(input.isDefault),
    },
  });

  if (!input.isDefault) {
    const defaultProfile = await getDefaultSenderProfile();
    if (!defaultProfile) {
      await prisma.senderProfile.update({
        where: { id: profile.id },
        data: { isDefault: true },
      });
      profile.isDefault = true;
    }
  }

  return profile;
}

async function updateSenderProfile(id, input) {
  const existing = await prisma.senderProfile.findUnique({
    where: { id },
  });

  if (!existing) {
    return null;
  }

  if (input.isDefault) {
    await prisma.senderProfile.updateMany({
      where: { id: { not: id } },
      data: { isDefault: false },
    });
  }

  return prisma.senderProfile.update({
    where: { id },
    data: {
      name: input.name,
      domain: normalizeDomain(input.domain, input.fromEmail),
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      postmarkToken: input.postmarkToken ? input.postmarkToken : existing.postmarkToken,
      messageStream: input.messageStream,
      status: input.status || existing.status,
      isDefault: Boolean(input.isDefault),
    },
  });
}

async function deleteSenderProfile(id) {
  const profile = await prisma.senderProfile.findUnique({
    where: { id },
  });

  if (!profile) {
    return null;
  }

  const campaignCount = await prisma.campaign.count({
    where: { senderProfileId: id },
  });

  if (campaignCount > 0) {
    throw new Error("Cannot delete a sender profile that is used by existing campaigns.");
  }

  await prisma.senderProfile.delete({
    where: { id },
  });

  if (profile.isDefault) {
    const nextProfile = await prisma.senderProfile.findFirst({
      orderBy: { id: "asc" },
    });

    if (nextProfile) {
      await prisma.senderProfile.update({
        where: { id: nextProfile.id },
        data: { isDefault: true },
      });
    }
  }

  return profile;
}

module.exports = {
  listSenderProfiles,
  getDefaultSenderProfile,
  ensureDefaultSenderProfile,
  createSenderProfile,
  updateSenderProfile,
  deleteSenderProfile,
  serializeSenderProfile,
  normalizeDomain,
};
