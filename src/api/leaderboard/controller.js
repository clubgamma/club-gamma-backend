const prisma = require('../../utils/prismaClient');

const getLeaderboard = async (req, res) => {
    const { page = 1, limit = 10 } = req.query;  // Get page and limit from query parameters with default values

    try {
        const users = await prisma.users.findMany({
            skip: (parseInt(page) - 1) * parseInt(limit),  // Pagination logic
            take: parseInt(limit),
            orderBy: {
                points: 'desc',  // Sort by points in descending order
            },
            select: {
                name: true,
                githubId: true,
                points: true,
                avatar: true,
                _count: {
                    select: {
                        prs: true,  // Count of all PRs
                    }
                },
                prs: {
                    select: {
                        state: true  // Select the status of each PR
                    }
                }
            }
        });

        // Count total users for pagination metadata
        const totalUsers = await prisma.users.count();

        // Transform the users data to include counts of opened, closed, and merged PRs
        const transformedUsers = users.map((user, index) => {
            const prCounts = {
                opened: 0,
                closed: 0,
                merged: 0
            };

            user.prs.forEach(pr => {
                if (pr.state === 'opened') prCounts.opened++;
                if (pr.state === 'closed') prCounts.closed++;
                if (pr.state === 'merged') prCounts.merged++;
            });
            user.prs = prCounts;
            delete user._count;
            return {
                ...user,
                rank: (parseInt(page) - 1) * parseInt(limit) + index + 1  // Calculate rank
            };
        });

        res.json({
            contributors: transformedUsers,
            meta: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalUsers / limit),
                totalUsers: totalUsers
            }
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).send('Error fetching leaderboard');
    }
}

const searchUser = async(req, res) => {
    const { name } = req.query;

    try {
        const users = await prisma.users.findMany({
            where: {
                OR: [
                    {
                        name: {
                            contains: name,  // Perform partial search using "contains" for name
                            mode: 'insensitive'  // Make search case-insensitive
                        }
                    },
                    {
                        githubId: {
                            contains: name,  // Perform partial search using "contains" for githubId
                            mode: 'insensitive'  // Make search case-insensitive
                        }
                    }
                ]
            },
            orderBy: {
                points: 'desc'  // Order results by points in descending order
            },
            select: {
                name: true,
                githubId: true,
                points: true,
                avatar: true,
                prs: true
            }
        });

        res.json({ data: users });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).send('Error searching users');
    }
}

const filterLeaderboard = async(req, res) => {
    const { minPoints, maxPoints, minPrs } = req.query;

    try {
        const users = await prisma.users.findMany({
            where: {
                points: {
                    gte: parseInt(minPoints) || 0,  // Filter users with at least minPoints (default 0)
                    lte: parseInt(maxPoints) || undefined  // Filter users with at most maxPoints
                },
                prs: {
                    some: {
                        id: {
                            gte: parseInt(minPrs) || 0  // Filter users with at least minPrs
                        }
                    }
                }
            },
            orderBy: {
                points: 'desc'
            },
            select: {
                name: true,
                githubId: true,
                points: true,
                avatar: true,
                prs: {
                    select: {
                        prNumber: true,
                        title: true,
                        mergedAt: true
                    }
                }
            }
        });

        res.json({ data: users });
    } catch (error) {
        console.error('Error filtering users:', error);
        res.status(500).send('Error filtering users');
    }
}

module.exports = {
    getLeaderboard,
    searchUser,
    filterLeaderboard
}
