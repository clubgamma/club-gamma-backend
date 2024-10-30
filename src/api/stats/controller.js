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

const projectWisePRs = async (req, res) => {
  try {
    // Fetch open PRs, ordered by `createdAt`
    const openPRs = await prisma.pullRequests.findMany({
      where: { state: "open" },
      orderBy: { createdAt: "desc" },
      select: {
        repository: true,
        prNumber: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        points: true,
        author: {
          select: {
            githubId: true,
            name: true,
          },
        },
      },
    });

    if (openPRs.length === 0) {
      return res.status(404).json({
        message: "No open PRs found",
        totalOpenPRs: 0,
        prs: {},
      });
    }

    // Group PRs by repository with the desired structure
    const groupedPRs = openPRs.reduce((acc, pr) => {
      if (!acc[pr.repository]) {
        acc[pr.repository] = [];
      }
      acc[pr.repository].push({
        prNumber: pr.prNumber,
        title: pr.title,
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
        points: pr.points,
        author: {
          githubId: pr.author.githubId,
          name: pr.author.name,
        },
      });
      return acc;
    }, {});

    res.status(200).json({
      totalOpenPRs:openPRs.length,
      prs:groupedPRs
    });

  } catch (error) {
    console.error("Error fetching project-wise open PRs:", error);
    res.status(500).json({ error: error.message });
  }
};

const projectPRs = async (req, res) => {
  try {
    const { projectId } = req.params; //club-gamma-backend

    if(!projectId){
      return res.status(400).json({
        message: `Project Id missing`,
      });
    }

    // Get open PRs for the specified project, ordered by `createdAt`
    const openPRs = await prisma.pullRequests.findMany({
      where: {
        state: "open",
        repository: `clubgamma/${projectId}`, //clubgamma/club-gamma-backend

      },
      orderBy: { createdAt: "desc" },
      select: {
        prNumber: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        points: true,
        author: {
          select: {
            githubId: true,
            name: true,
          },
        },
      },
    });

    // If no PRs are found for the project, return an empty response
    if (openPRs.length === 0) {
      return res.status(404).json({
        message: `No open PRs found for project with ID: ${projectId}`,
        totalOpenPRs: 0,
        prs: [],
      });
    }

    res.status(200).json({
      repository: projectId,
      prCount: openPRs.length,
      prs: openPRs,
    });

  } catch (error) {
    console.error("Error fetching open PRs for the specified project:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getStats , projectWisePRs , projectPRs};
