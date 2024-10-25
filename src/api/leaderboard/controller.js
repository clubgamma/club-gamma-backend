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

 

    // Format the user
    return {
      name: user.name,
      githubId: user.githubId,
      points: user.points,
      prs: {
        opened: prStats.opened,
        closed: prStats.closed,
        merged: prStats.merged,
      },
      rank: user.rank,
    };
  });
}

const filterByUsers = async (req, res) => {
  const {minPoints, maxPoints, minPrs, page = 1, limit = 10, name} = req.query;

  const userQueryArguments = {
    select: {
      name: true,
      githubId: true,
      points: true,
      rank: true,
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
          state: true
        },
      },
    },
    where: {
      prs: {
        some: {
          state: 'merged', // Ensure the user has at least one merged PR
        },
      },
    },
    orderBy: {
      points: "desc",
    }
  };

  if (name && name.trim()) {
    userQueryArguments.where = {
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
    };
  }
  if (minPoints || maxPoints) {
    userQueryArguments.where = userQueryArguments.where || {};
    userQueryArguments.where.points = {
      gte: parseInt(minPoints) || 0, // Filter users with at least minPoints (default 0)
      lte: parseInt(maxPoints) || undefined, // Filter users with at most maxPoints
    };
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
    let users = await prisma.users.findMany(userQueryArguments);
    let totalUsersWithFilter = users.length;

    // Prisma ORM doesn't support filtering directly by the aggregated count in the findMany function
    // So we filter in application
    if (minPrs) {
      let _countLower = 0;
      users = users.filter(item => {
        if (item._count.prs >= minPrs) {
          return true;
        }
        _countLower++;
        return false;
      });
      totalUsersWithFilter-=_countLower;
    }

    // Javascript Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    users = users.slice(skip, skip + take);

    // Transform the users data to include counts of opened, closed, and merged PRs
    const formattedUsers = formatUsers(users, allUsers);

    res.json({
      contributors: formattedUsers,
      meta: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsersWithFilter / limit) || 1,
        totalUsers: totalUsersWithFilter
      }
    });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).send("Error searching users");
  }
};

module.exports = {
  filterByUsers,
};
