const prisma = require("../../utils/PrismaClient");

const formatUsers = (users, allUsers) => {
  return users.map((user) => {
    // Calculate PR statistics
    const prStats = user.prs.reduce(
        (acc, pr) => {
          switch (pr.state.toLowerCase()) {
            case "open":
              acc.opened++;
              break;
            case "closed":
              acc.closed++;
              break;
            case "merged":
              acc.merged++;
              break;
          }
          return acc;
        },
        { opened: 0, closed: 0, merged: 0 }
    );

    // Calculate user's rank
    const rank = allUsers.findIndex((u) => u.points <= user.points) + 1;

    // Format the user
    return {
      name: user.name,
      githubId: user.githubId,
      points: user.points,
      avatar: user.avatar,
      prs: {
        opened: prStats.opened,
        closed: prStats.closed,
        merged: prStats.merged,
      },
      rank,
    };
  });
}

const filterByUser = async (req, res) => {
  const { name, page = 1, limit = 10  } = req.query;
  //validate the name
  if (!name || name.trim() === "") {
    return filterLeaderboard(req, res);
  }

  try {
    // First get all users ordered by points to calculate rank
    const allUsers = await prisma.users.findMany({
      orderBy: {
        points: "desc",
      },
      select: {
        githubId: true,
        points: true,
      },
    });

    // Find all matching users with all required fields
    const users = await prisma.users.findMany({
      skip: (parseInt(page) - 1) * parseInt(limit), // Pagination logic
      take: parseInt(limit),
      where: {
        OR: [
          {
            name: {
              contains: name, // Changed from startsWith to contains
              mode: "insensitive",
            },
          },
          {
            githubId: {
              contains: name, // Changed from startsWith to contains
              mode: "insensitive",
            },
          },
        ],
      },
      include: {
        prs: {
          select: {
            state: true,
          },
        },
      },
    });

    if (!users || users.length === 0) {
      return res.json({
        contributors: [],
        meta: {
          currentPage: 1,
          totalPages: 1,
          totalUsers: 0,
        } });
    }

    // Transform the users data to include counts of opened, closed, and merged PRs
    const formattedUsers = formatUsers(users, allUsers);

    res.json({
      contributors: formattedUsers,
      meta: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(allUsers.length / limit) || 1,
        totalUsers: allUsers.length,
      }
    });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).send("Error searching users");
  }
};

const filterLeaderboard = async (req, res) => {
  const {minPoints, maxPoints, minPrs, page = 1, limit = 10, name} = req.query;

  try {
    // First get all users ordered by points to calculate rank
    const allUsers = await prisma.users.findMany({
      orderBy: {
        points: "desc",
      },
      select: {
        githubId: true,
        points: true,
      },
    });

    const users = await prisma.users.findMany({
      skip: (parseInt(page) - 1) * parseInt(limit), // Pagination logic
      take: parseInt(limit),
      orderBy: {
        points: "desc",
      },
      where: {
        points: {
          gte: parseInt(minPoints) || 0, // Filter users with at least minPoints (default 0)
          lte: parseInt(maxPoints) || undefined, // Filter users with at most maxPoints
        },
        prs: {
          some: {
            prNumber: {
              gte: parseInt(minPrs) || 0, // Filter users with at least minPrs
            },
          },
        },
      },
      select: {
        name: true,
        githubId: true,
        points: true,
        avatar: true,
        _count: {
          select: {
            prs: true, // Count of all PRs
          },
        },
        prs: {
          select: {
            prNumber: true,
            title: true,
            mergedAt: true,
          },
        },
      },
    });

    const totalUsers = await prisma.users.count();

    // Transform the users data to include counts of opened, closed, and merged PRs
    const formattedUsers = formatUsers(users, allUsers);

    res.json({
      contributors: formattedUsers || [],
      meta: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / limit) || 1,
        totalUsers: totalUsers,
      },
    });
  } catch (error) {
    console.error("Error filtering users:", error);
    res.status(500).send("Error filtering users");
  }
};

module.exports = {
  filterByUser,
  filterLeaderboard,
};
