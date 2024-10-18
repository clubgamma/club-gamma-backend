const prisma = require('../../utils/PrismaClient');
const axios = require('axios');

const getUserStats = async (req, res) => {
    let { githubId } = req.params;
    if (!githubId) {
        return res.status(404).json({ error: 'Github ID not found' });
    }

    try {
        const user = await prisma.users.findFirst({
            where: { githubId: { equals: githubId, mode: 'insensitive' }},
            include: {
                prs: {
                    orderBy: { updatedAt: 'desc' },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const githubData = await axios.get(`https://api.github.com/users/${githubId}`, {
            headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
        });

        const allUsers = await prisma.users.findMany({
            orderBy: { points: 'desc' },
            select: { githubId: true },
        });

        const rank = allUsers.findIndex(u => u.githubId === githubId) + 1;

        const stats = {
            totalPRs: user.prs.length,
            points: user.points,
            mergedPRs: user.prs.filter(pr => pr.state === 'merged').length,
            openPRs: user.prs.filter(pr => pr.state === 'open').length,
            closedPRs: user.prs.filter(pr => pr.state === 'closed').length,
            repositoryBreakdown: {},
            prs: [],
        };

        user.prs = user.prs.slice(0, 3);

        user.prs.forEach(pr => {
            if (!stats.repositoryBreakdown[pr.repository]) {
                stats.repositoryBreakdown[pr.repository] = { total: 0, merged: 0, points: 0 };
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

const repositories = [
    'yogi-coder-boy/github'
];

const prPoints = {
    "documentation": 1,
    "bug": 2,
    "level 1": 3,
    "level 2": 5,
    "level 3": 8,
};

const syncPullRequests = async (req, res) => {
    const { githubId } = req.body;

    if (!githubId) {
        return res.status(400).json({ error: 'Missing githubId' });
    }

    try {
        const user = await prisma.users.findUnique({ where: { githubId } });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const initialPRFetches = repositories.map(repo =>
            axios.get(`https://api.github.com/repos/${repo}/pulls?state=all`, {
                headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
            }).then(response => ({ repo, pulls: response.data }))
        );

        const reposPRs = await Promise.all(initialPRFetches);

        const detailedPRFetches = reposPRs.map(async ({ repo, pulls }) => {
            const prDetailPromises = pulls.map(pr =>
                axios.get(`https://api.github.com/repos/${repo}/pulls/${pr.number}`, {
                    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
                }).then(response => response.data)
            );

            const detailedPRs = await Promise.all(prDetailPromises);
            return { repo, prs: detailedPRs };
        });

        const reposDetailedPRs = await Promise.all(detailedPRFetches);

        const prSavePromises = reposDetailedPRs.flatMap(({ repo, prs }) => {
            prs = prs.filter(pr => pr.user.login === githubId);
            return prs.map(pr => {
                const points = pr.labels.map(label => prPoints[label.name] || 0).reduce((a, b) => a + b, 0);

                const prData = {
                    prNumber: pr.number,
                    repository: repo,
                    title: pr.title,
                    state: pr.merged ? 'merged' : pr.state,
                    url: pr.html_url,
                    openedAt: new Date(pr.created_at),
                    mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
                    closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
                    mergedBy: pr.merged_by?.login || null,
                    points,
                    authorId: pr.user.login,
                };

                return prisma.pullRequests.upsert({
                    where: {
                        prNumber_repository: {
                            prNumber: pr.number,
                            repository: repo,
                        },
                    },
                    create: prData,
                    update: prData,
                });
            });
        });

        await Promise.all(prSavePromises);

        // Update user PR counts
        const updatedUser = await prisma.users.update({
            where: { githubId },
            data: {
                totalPRs: {
                    increment: reposDetailedPRs.flatMap(r => r.prs).filter(pr => pr.user.login === githubId).length,
                },
                points: {
                    increment: reposDetailedPRs.flatMap(r => r.prs)
                        .filter(pr => pr.user.login === githubId)
                        .map(pr => pr.labels.map(label => prPoints[label.name] || 0).reduce((a, b) => a + b, 0))
                        .reduce((a, b) => a + b, 0),
                },
            },
        });

        res.json({
            message: 'Synchronization complete',
            syncedRepos: reposDetailedPRs.map(r => ({ name: r.repo, pullCount: r.prs.length })),
            user: updatedUser,
        });
    } catch (error) {
        console.error('Error syncing pull requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getUserStats,
    syncPullRequests,
};
