const prisma = require("../../utils/PrismaClient");

const formatUsers = (users, allUsers) => {
  return users.map((user) => {
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

    const rank = allUsers.findIndex((u) => u.points <= user.points) + 1;

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

const filterByUsers = async (req, res) => {
  const { minPoints, maxPoints, minPrs, page = 1, limit = 10, name } = req.query;

  const userQueryArguments = {
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
          state: true
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
            contains: name,
            mode: "insensitive",
          },
        },
        {
          githubId: {
            contains: name,
            mode: "insensitive",
          },
        },
      ],
    };
  }
  
  if (minPoints || maxPoints) {
    userQueryArguments.where = userQueryArguments.where || {};
    userQueryArguments.where.points = {
      gte: parseInt(minPoints) || 0,
      lte: parseInt(maxPoints) || undefined,
    };
  }

  try {
    const allUsers = await prisma.users.findMany({
      orderBy: {
        points: "desc",
      },
      select: {
        githubId: true,
        points: true,
      },
    });

    let users = await prisma.users.findMany(userQueryArguments);
    let totalUsersWithFilter = users.length;

    if (minPrs) {
      let _countLower = 0;
      users = users.filter(item => {
        if (item._count.prs >= minPrs) {
          return true;
        }
        _countLower++;
        return false;
      });
      totalUsersWithFilter -= _countLower;
    }

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
        totalUsers: totalUsersWithFilter,
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
