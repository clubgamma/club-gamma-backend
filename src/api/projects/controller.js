const prisma = require("../../utils/PrismaClient");

const getContributors = async (req, res) => {
  const { id } = req.params;

  try {
    const contributors = await prisma.pullRequests.findMany({
      where: {
        repository: "clubgamma/" + id,
      },
      select: {
        author: {
          select: {
            name: true,
            githubId: true,
            avatar: true,
          },
        },
        points: true,
      },
    });

    if (contributors.length === 0) {
      return res.status(404).json({ message: "No contributors found" });
    }

    const contributorStats = contributors.reduce((acc, curr) => {
      const githubId = curr.author.githubId;
      const existingContributor = acc[githubId];

      if (existingContributor) {
        existingContributor.contributionsCount += 1;
        existingContributor.totalPoints += curr.points;
      } else {
        acc[githubId] = {
          name: curr.author.name,
          githubId: curr.author.githubId,
          profileUrl: `https://github.com/${curr.author.githubId}`,
          avatarUrl: curr.author.avatar,
          contributionsCount: 1,
          totalPoints: curr.points,
        };
      }
      return acc;
    }, {});

    const response = Object.values(contributorStats);
    
    response.sort((a, b) => b.totalPoints - a.totalPoints);
    
    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching contributors:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getContributors };
