const prisma = require('../../utils/PrismaClient');
const axios = require('axios');
const { WebhookHandler } = require('../../webhook/github');

const getUserStats = async (req, res) => {
    let { githubId } = req.params;
    if (!githubId) {
        return res.status(404).json({ error: 'Github ID not found' });
    }

    try {
        // Get user and their PRs
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
                        updatedAt: 'desc', // Order by the creation date in descending order
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const githubData = await axios.get(`https://api.github.com/users/${githubId}`, {
            headers: {
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            },
        });


        const stats = {
            totalPRs: user.prs.length,
            points: user.points,
            mergedPRs: user.prs.filter(pr => pr.state === 'merged').length,
            openPRs: user.prs.filter(pr => pr.state === 'open').length,
            closedPRs: user.prs.filter(pr => pr.state === 'closed').length,
            repositoryBreakdown: {},
            prs: [],
            prCountPerDay: {}, // Store PR count per day here
        };

        user.prs.forEach(pr => {
            // Get the date (only YYYY-MM-DD) for grouping purposes
            const date = new Date(pr.updatedAt).toISOString().split('T')[0];

            // Initialize the prCountPerDay object if the date doesn't exist
            if (!stats.prCountPerDay[date]) {
                stats.prCountPerDay[date] = 0;
            }

            // Increment the count for that date
            stats.prCountPerDay[date]++;

            // Populate repository breakdown
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
                label: pr.label
            });
        });

        // Respond with user stats and rank
        res.json({
            user: {
                githubId: user.githubId,
                name: user.name,
                avatar: user.avatar,
                email: user.email,
                universityEmail: user.universityEmail,
                rank: user.rank,
                followers: githubData.data.followers,
                following: githubData.data.following,
                bio: githubData.data.bio,
                repositories: githubData.data.public_repos,
                company: githubData.data.company,
                location: githubData.data.location,
                blog: githubData.data.blog,
            },
            stats,
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const repositories = [
    'yogi-coder-boy/github',
    'clubgamma/club-gamma-frontend',
    'clubgamma/club-gamma-backend',
    'clubgamma/Internet-Speed-Tester',
    'clubgamma/Weather-Web-App-2024',
    'clubgamma/Air-Quality-Index-Analysis',
    'clubgamma/Summarize-papers',
    'clubgamma/Sudoku',
    'clubgamma/Ticket-Booking'
];
const prPoints = {
    "documentation": 1,
    "bug": 2,
    "level 1": 3,
    "level 2": 5,
    "level 3": 8,
}

const syncPullRequests = async (req, res) => {
    const { githubId } = req.body;

    if (!githubId) {
        return res.status(400).json({ error: 'Missing githubId or invalid repositories' });
    }

    try {
        // Fetch user from database
        const user = await prisma.users.findUnique({
            where: { githubId },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Stage 1: Fetch all PRs for each repository concurrently
        const initialPRFetches = repositories.map(repo =>
            axios.get(`https://api.github.com/repos/${repo}/pulls?state=all`, {
                headers: {
                    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                },
            })
                .then(response => ({
                    repo,
                    pulls: response.data
                }))
        );

        const reposPRs = await Promise.all(initialPRFetches);

        // Stage 2: Fetch detailed PR data for each repository
        const detailedPRFetches = reposPRs.map(async ({ repo, pulls }) => {
            const prDetailPromises = pulls.map(pr =>
                axios.get(`https://api.github.com/repos/${repo}/pulls/${pr.number}`, {
                    headers: {
                        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                    },
                })
                    .then(response => response.data)
            );

            const detailedPRs = await Promise.all(prDetailPromises);
            return {
                repo,
                prs: detailedPRs
            };
        });

        const reposDetailedPRs = await Promise.all(detailedPRFetches);

        // Process and save PRs
        const prSavePromises = reposDetailedPRs.flatMap(({ repo, prs }) => {
            prs = prs.filter(pr => pr.user.login === githubId);
            return prs.map(pr => {

                // Find the highest priority label (assuming higher points mean higher priority)
                const highestPriorityLabel = pr.labels
                .reduce((highest, current) => {
                    const currentPoints = prPoints[current.name] || 0;
                    const highestPoints = prPoints[highest?.name] || 0;
                    return currentPoints > highestPoints ? current : highest;
                }, null)?.name || null;

                const points = prPoints[highestPriorityLabel] || 0;

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
                    points: points,
                    authorId: pr.user.login,
                    label: highestPriorityLabel,
                };
        
                return prisma.$transaction(tx => {
                    return tx.pullRequests.upsert({
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
        });
        
        // Wait for all transactions to complete
        await Promise.all(prSavePromises);

        // update user points
        const pointsSum = await prisma.pullRequests.aggregate({
            _sum: {
                points: true
            },
            where: {
                authorId: githubId,
            }
        });
        
        const points = pointsSum._sum.points || 0;
        
        await prisma.users.update({
            where: {
                githubId,
            },
            data: {
                points,
            },
        });

        WebhookHandler.recalculateRanks();
        
        res.json({
            message: 'Synchronization complete',
            syncedRepos: reposDetailedPRs.map(r => ({
                name: r.repo,
                pullCount: r.prs.length
            })),
            prCount: prSavePromises.length,
        });
    } catch (error) {
        console.error('Error syncing pull requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getUserStats,
    syncPullRequests
}
