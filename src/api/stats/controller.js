const prisma = require("../../utils/PrismaClient");
const axios = require("axios");

const getUserStats = async (req, res) => {
    let { githubId } = req.params;
    if (!githubId) {
        return res.status(404).json({ error: 'GitHub ID not found' });
    }

    try {
        const user = await prisma.users.findFirst({
            where: { 
                githubId: {
                    equals: githubId,
                    mode: 'insensitive'
                }
            },
            include: {
                prs: {
                    orderBy: {
                        updatedAt: 'desc',
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Fetch additional GitHub data
        const githubData = await axios.get(`https://api.github.com/users/${githubId}`, {
            headers: {
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            },
        });

        // Calculate the total PR counts
        const totalPRCount = user.prs.length;
        const mergedPRCount = user.prs.filter(pr => pr.state === 'merged').length;
        const openPRCount = user.prs.filter(pr => pr.state === 'open').length;
        const closedPRCount = user.prs.filter(pr => pr.state === 'closed').length;

        // Calculate the rank of the user
        const allUsers = await prisma.users.findMany({
            orderBy: {
                points: 'desc',
            },
            select: {
                githubId: true,
            },
        });
        const rank = allUsers.findIndex(u => u.githubId === githubId) + 1;

        const stats = {
            totalPRs: totalPRCount,
            points: user.points,
            mergedPRs: mergedPRCount,
            openPRs: openPRCount,
            closedPRs: closedPRCount,
            repositoryBreakdown: {},
            prs: [],
        };

        // Calculate repository breakdown
        user.prs.slice(0, 3).forEach(pr => {
            if (!stats.repositoryBreakdown[pr.repository]) {
                stats.repositoryBreakdown[pr.repository] = {
                    total: 0,
                    merged: 0,
                    points: 0,
                };
            }
            stats.repositoryBreakdown[pr.repository].total++;
            stats.prs.push({
                prNumber: pr.prNumber,
                title: pr.title,
                points: pr.points,
                state: pr.state,
                url: pr.url,
                repository: pr.repository,
                openedAt: pr.openedAt,
                mergedAt: pr.mergedAt,
                closedAt: pr.closedAt,
                mergedBy: pr.mergedBy,
            });
        });

        res.json({
            user: {
                githubId: user.githubId,
                name: user.name,
                avatar: user.avatar,
                email: user.email,
                universityEmail: user.universityEmail,
                rank: rank,
                followers: githubData.data.followers,
                following: githubData.data.following,
                bio: githubData.data.bio,
                repositories: githubData.data.public_repos,
            },
            stats,
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getUserStats,
};
