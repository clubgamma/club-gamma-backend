const prisma = require("../../utils/PrismaClient");

const getStats = async (req, res) => {
  try {
    const numberOfPr = await prisma.pullRequests.count();
    const numberOfRepos = await prisma.pullRequests.groupBy({
      by: ["repository"],
      _count: {
        repository: true,
      },
    });
    const repoCount = numberOfRepos.length;
    const numberOfContributors = await prisma.users.count();

    res
      .status(200)
      .json({ numberOfPr, numberOfRepos: repoCount, numberOfContributors });
  } catch (e) {
    console.error("Error fetching data:", e);
    res.status(500).json({ error: e.message });
  }
};

module.exports = { getStats };
