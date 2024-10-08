const crypto = require("crypto");
const prisma = require('../utils/PrismaClient');
const mailer = require('../utils/Mailer');

async function createUser(githubId) {
    let user = await prisma.users.findUnique({
        where: { githubId: githubId }
    });

    if (!user) {
        console.log(`User with GitHub ID: ${githubId} not found. Skipping the process.`);
        return null;
    }

    return user;
}

const prPoints = {
    "documentation": 1,
    "bug": 2,
    "level 1": 3,
    "level 2": 5,
    "level 3": 8,
}

module.exports = async (req, res) => {
    console.log('Received webhook request');

    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];

    if (!signature || !event) {
        return res.status(400).send('Missing headers');
    }

    const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');

    if (signature !== digest) {
        return res.status(401).send('Invalid signature');
    }

    if (event === 'pull_request') {
        const action = req.body.action;
        const prData = req.body.pull_request;
        const prNumber = prData.number;
        const baseBranch = prData.base.ref;

        console.log(`Received pull_request event: Action - ${action}, Branch - ${baseBranch}`);

        // Only proceed if the PR is targeting the 'main' branch
        if (baseBranch !== 'main') {
            console.log(`PR #${prNumber} is not targeting the main branch. Skipping processing.`);
            return res.status(200).send('PR is not for the main branch. Skipping process.');
        }

        let author = await createUser(prData.user.login);
        if (!author) return res.status(200).send('User not found. Skipping process.');

        if (action === 'opened') {
            console.log(`PR #${prNumber} opened on main branch`);

            await prisma.pullRequests.create({
                data: {
                    prNumber: prNumber,
                    repository: req.body.repository.full_name,
                    title: prData.title,
                    state: 'open',
                    url: prData.html_url,
                    openedAt: new Date(prData.created_at),
                    points: 0, // Initialize points
                    authorId: author.githubId
                }
            });
            console.log(`PR #${prNumber} data saved as open.`);
        } else if (action === 'closed') {
            console.log(`PR #${prNumber} closed`);
            const isMerged = prData.merged;

            await prisma.pullRequests.upsert({
                where: { prNumber: prNumber },
                create: {
                    prNumber: prNumber,
                    repository: req.body.repository.full_name,
                    title: prData.title,
                    state: isMerged ? 'merged' : 'closed',
                    url: prData.html_url,
                    openedAt: new Date(prData.created_at),
                    points: 0,
                    authorId: prData.user.login,
                    closedAt: new Date(prData.closed_at),
                    mergedAt: isMerged ? new Date(prData.merged_at) : null,
                    mergedBy: isMerged ? prData.merged_by.login : null
                },
                update: {
                    state: isMerged ? 'merged' : 'closed',
                    closedAt: new Date(prData.closed_at),
                    mergedAt: isMerged ? new Date(prData.merged_at) : null,
                    mergedBy: isMerged ? prData.merged_by.login : null
                }
            });
            console.log(`PR #${prNumber} state updated to ${isMerged ? 'merged' : 'closed'}.`);

            if (isMerged) {
                const points = prData.labels.reduce((total, label) => {
                    return total + (prPoints[label.name] || 0);
                }, 0);

                await prisma.pullRequests.update({
                    where: { prNumber: prNumber },
                    data: { points: points }
                });

                await prisma.users.update({
                    where: { githubId: prData.user.login },
                    data: {
                        points: { increment: points }
                    }
                });

                await mailer.sendPrMergedMail(author.email, {
                    userName: prData.user.login,
                    prNumber: prNumber,
                    prTitle: prData.title,
                    repoName: req.body.repository.full_name,
                    repoLink: req.body.repository.html_url,
                    mergeDate: new Date(prData.merged_at).toDateString(),
                    reviewerName: prData.merged_by.login,
                    leaderboardLink: "https://clubgamma.com/leaderboard"
                });

                console.log(`Updated points for user ${prData.user.login} by ${points}.`);
            }
        } else if (action === 'reopened') {
            console.log(`PR #${prNumber} reopened`);

            await prisma.pullRequests.update({
                where: { prNumber: prNumber },
                data: { state: 'open' }
            });
            console.log(`PR #${prNumber} state updated to open.`);
        }
    }

    res.status(200).send('Webhook received');
};
