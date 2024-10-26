const crypto = require("crypto");
const axios = require("axios");
const prisma = require('../utils/PrismaClient');
const mailer = require('../utils/Mailer');

// Constants
const PR_POINTS = {
    "documentation": 1,
    "bug": 2,
    "level 1": 3,
    "level 2": 5,
    "level 3": 8,
    "level 4": 15
};

const PR_STATES = {
    OPEN: 'open',
    CLOSED: 'closed',
    MERGED: 'merged'
};

class WebhookHandler {
    constructor(webhookSecret) {
        this.webhookSecret = webhookSecret;
    }

    validateSignature(signature, rawBody) {
        if (!signature) return false;
        const hmac = crypto.createHmac('sha256', this.webhookSecret);
        const digest = `sha256=${hmac.update(rawBody).digest('hex')}`;
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
    }

    static async recalculateRanks() {
        const users = await prisma.users.findMany({
            orderBy: {
                points: 'desc',
            },
            select: {
                githubId: true,
                points: true,
            },
        });

        let currentRank = 0;
        let lastPoints = null;
        let usersToUpdate = [];

        users.forEach((user, index) => {
            if (lastPoints !== user.points) {
                currentRank += 1;
                lastPoints = user.points;
            }
            if (currentRank !== user.rank) {
                usersToUpdate.push({
                    githubId: user.githubId,
                    rank: currentRank,
                });
            }
        });

        for (const user of usersToUpdate) {
            await prisma.users.update({
                where: { githubId: user.githubId },
                data: { rank: user.rank },
            });
        }
    }

    static getHighestPriorityLabel(labels) {
        if (!labels?.length) return null;
        return labels.reduce((prev, current) => {
            const prevPoints = PR_POINTS[prev.name.toLowerCase()] || 0;
            const currentPoints = PR_POINTS[current.name.toLowerCase()] || 0;
            return currentPoints > prevPoints ? current : prev;
        }, labels[0]);
    }

    static calculatePoints(labels) {
        return labels.reduce((total, label) =>
            total + (PR_POINTS[label.name.toLowerCase()] || 0), 0);
    }

    static async getOrCreateUser(githubId) {
        try {
            const user = await prisma.users.findUnique({
                where: { githubId }
            });

            if (user) return user;

            const { data: userData } = await axios.get(
                `https://api.github.com/users/${githubId}`,
                { timeout: 5000 }
            );

            await WebhookHandler.recalculateRanks();
            return await prisma.users.create({
                data: {
                    githubId,
                    name: userData.name || userData.login,
                    email: userData.email,
                }
            });
        } catch (error) {
            console.error(`Error in getOrCreateUser: ${error.message}`);
            return null;
        }
    }

    async handleLabelUpdate(prData, repository, author, existingPr) {
        if (!existingPr) return;
    
        const highestPriorityLabel = WebhookHandler.getHighestPriorityLabel(prData.labels);
        const newPoints = highestPriorityLabel ? PR_POINTS[highestPriorityLabel.name.toLowerCase()] || 0 : 0;
    
        if (existingPr.points === newPoints) return;
    
        const pointsDiff = newPoints - existingPr.points;
    
        const transactionActions = [
            prisma.pullRequests.update({
                where: {
                    prNumber_repository: {
                        prNumber: prData.number,
                        repository: repository
                    }
                },
                data: {
                    label: highestPriorityLabel?.name || null,
                    points: existingPr.state === PR_STATES.MERGED ? newPoints : existingPr.points
                }
            })
        ];
    
        // Only add the user update to the transaction if the PR is merged
        if (existingPr.state === PR_STATES.MERGED) {
            transactionActions.push(
                prisma.users.update({
                    where: { githubId: author.githubId },
                    data: {
                        points: { increment: pointsDiff }
                    }
                })
            );
        }
    
        await prisma.$transaction(transactionActions);
    
        if (existingPr.state === PR_STATES.MERGED) {
            await WebhookHandler.recalculateRanks(); // Fixed: Using static method call
            console.log(`Updated points for user ${author.name} by ${pointsDiff}`);
        } else {
            console.log(`Updated labels for PR ${prData.number}`);
        }
    }
    
    async handlePrMerge(prData, repository, author) {
        const points = WebhookHandler.calculatePoints(prData.labels);

        await prisma.$transaction([
            prisma.pullRequests.update({
                where: {
                    prNumber_repository: {
                        prNumber: prData.number,
                        repository
                    }
                },
                data: { points }
            }),
            prisma.users.update({
                where: { githubId: author.githubId },
                data: {
                    points: { increment: points }
                }
            })
        ]);

        console.log(`Mailing PR merged notification to ${author.name} (${author.email})`);
        if (author.email) {
            await mailer.sendPrMergedMail(author.email, {
                userName: author.name,
                prNumber: prData.number,
                prTitle: prData.title,
                repoName: repository,
                repoLink: prData.base.repo.html_url,
                mergeDate: new Date(prData.merged_at).toDateString(),
                reviewerName: prData.merged_by.login,
                leaderboardLink: "https://clubgamma.vercel.app/leaderboard"
            }).catch(error =>
                console.error(`Failed to send email to ${author.email}: ${error.message}`));
            console.log(`Sent email to ${author.email}`);
        }
        await WebhookHandler.recalculateRanks(); // Fixed: Using static method call
        return points;
    }

    async handlePrStateChange(action, prData, repository, author) {
        const baseData = {
            prNumber: prData.number,
            repository,
            title: prData.title,
            authorId: author.githubId,
            label: WebhookHandler.getHighestPriorityLabel(prData.labels)?.name
        };

        if (action === 'opened' || action === 'reopened') {
            await prisma.pullRequests.upsert({
                where: {
                    prNumber_repository: {
                        prNumber: prData.number,
                        repository
                    }
                },
                create: {
                    ...baseData,
                    state: PR_STATES.OPEN,
                    openedAt: new Date(prData.created_at),
                    points: 0
                },
                update: {
                    ...baseData,
                    state: PR_STATES.OPEN
                }
            });
        } else if (action === 'closed') {
            const isMerged = prData.merged;
            const state = isMerged ? PR_STATES.MERGED : PR_STATES.CLOSED;

            await prisma.pullRequests.upsert({
                where: {
                    prNumber_repository: {
                        prNumber: prData.number,
                        repository
                    }
                },
                create: {
                    ...baseData,
                    state,
                    openedAt: new Date(prData.created_at),
                    closedAt: new Date(prData.closed_at),
                    mergedAt: isMerged ? new Date(prData.merged_at) : null,
                    mergedBy: isMerged ? prData.merged_by.login : null,
                    points: 0
                },
                update: {
                    ...baseData,
                    state,
                    closedAt: new Date(prData.closed_at),
                    mergedAt: isMerged ? new Date(prData.merged_at) : null,
                    mergedBy: isMerged ? prData.merged_by.login : null
                }
            });

            if (isMerged) {
                await this.handlePrMerge(prData, repository, author);
            }
        }
    }
}

const webhookController = async (req, res) => {
    const handler = new WebhookHandler(process.env.WEBHOOK_SECRET);

    try {
        // Validate headers
        const signature = req.headers['x-hub-signature-256'];
        const event = req.headers['x-github-event'];

        if (!signature || !event) {
            return res.status(400).json({ error: 'Missing required headers' });
        }

        // Validate webhook signature
        if (!handler.validateSignature(signature, req.rawBody)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Handle only pull request events
        if (event !== 'pull_request') {
            return res.status(200).json({ message: 'Event ignored' });
        }

        const { action, pull_request: prData, repository } = req.body;

        // Skip if not targeting main branch
        if (prData.base.ref !== 'main') {
            return res.status(200).json({
                message: 'PR not targeting main branch'
            });
        }

        // Get or create user
        const author = await WebhookHandler.getOrCreateUser(prData.user.login);
        if (!author) {
            return res.status(500).json({
                error: 'Failed to get or create user'
            });
        }

        // Handle label changes
        if (action === 'labeled' || action === 'unlabeled') {
            const existingPr = await prisma.pullRequests.findUnique({
                where: {
                    prNumber_repository: {
                        prNumber: prData.number,
                        repository: repository.full_name
                    }
                }
            });

            await handler.handleLabelUpdate(
                prData,
                repository.full_name,
                author,
                existingPr
            );
        }
        // Handle PR state changes
        else if (['opened', 'closed', 'reopened'].includes(action)) {
            await handler.handlePrStateChange(
                action,
                prData,
                repository.full_name,
                author
            );
        }

        return res.status(200).json({
            message: 'Webhook processed successfully'
        });

    } catch (error) {
        console.error('Webhook processing error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

module.exports = {
    webhookController,
    WebhookHandler
}