const crypto = require("crypto");
const axios = require("axios");
const prisma = require('../utils/PrismaClient');
const mailer = require('../utils/Mailer');

async function getOrCreateUser(githubId) {
    let user = await prisma.users.findUnique({
        where: { githubId: githubId }
    });

    if (!user) {
        console.log(`User with GitHub ID: ${githubId} not found. Creating new user.`);
        try {
            const response = await axios.get(`https://api.github.com/users/${githubId}`);
            const userData = response.data;

            user = await prisma.users.create({
                data: {
                    githubId: githubId,
                    name: userData.name || userData.login,
                    email: userData.email,
                    avatar: userData.avatar_url,
                }
            });
            console.log(`Created new user: ${user.name}`);
        } catch (error) {
            console.error(`Error creating user: ${error.message}`);
            return null;
        }
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

        if (baseBranch !== 'main') {
            console.log(`PR #${prNumber} is not targeting the main branch. Skipping processing.`);
            return res.status(200).send('PR is not for the main branch. Skipping process.');
        }

        let author = await getOrCreateUser(prData.user.login);
        if (!author) return res.status(200).send('Failed to get or create user. Skipping process.');

        const labels = prData.labels;
        let highestPriorityLabel = labels.length > 0 ? labels.reduce((prev, current) => {
            return (prPoints[current.name.toLowerCase()] > prPoints[prev.name.toLowerCase()]) ? current : prev;
        }, labels[0]).name : "";

        if (action === 'synchronize'){
            const existingPr = await prisma.pullRequests.findUnique({
                where: {
                    prNumber_repository: {
                        prNumber: prNumber,
                        repository: req.body.repository.full_name
                    }
                }
            });

            if (existingPr && existingPr.state === 'merged') {
                console.log(`PR #${prNumber} is already merged. Checking for label updates.`);
                if (labels.length === 0 && existingPr.label !== "") {
                    console.log(`No new labels given. Updating points to zero.`);
                    await prisma.pullRequests.update({
                        where: {
                            prNumber_repository: {
                                prNumber: prNumber,
                                repository: req.body.repository.full_name
                            }
                        },
                        data: {
                            points: 0
                        }
                    });
                    await prisma.users.update({
                        where: { githubId: author.githubId },
                        data: {
                            points: { increment: 0 - existingPr.points }
                        }
                    });
                    return res.status(200).send('PR merged and points updated if necessary.');
                }
                if (existingPr.label !== highestPriorityLabel.name) {
                    console.log(`Label has changed. Updating points.`);
                    const newPoints = prPoints[highestPriorityLabel.name.toLowerCase()] || 0;

                    await prisma.pullRequests.update({
                        where: {
                            prNumber_repository: {
                                prNumber: prNumber,
                                repository: req.body.repository.full_name
                            }
                        },
                        data: {
                            label: highestPriorityLabel.name,
                            points: newPoints
                        }
                    });
            
                    await prisma.users.update({
                        where: { githubId: author.githubId },
                        data: {
                            points: { increment: newPoints - existingPr.points }
                        }
                    });

                    console.log(`Updated points for user ${author.name} by ${newPoints - existingPr.points}.`);
                }
                return res.status(200).send('PR merged and label updated if necessary.');
            }
            
        } else if (action === 'opened') {
            console.log(`PR #${prNumber} opened on main branch`);

            await prisma.pullRequests.upsert({
                where: {
                    prNumber_repository: {
                        prNumber: prNumber,
                        repository: req.body.repository.full_name
                    }
                },
                create: {
                    prNumber: prNumber,
                    repository: req.body.repository.full_name,
                    title: prData.title,
                    state: 'open',
                    url: prData.html_url,
                    openedAt: new Date(prData.created_at),
                    points: 0,
                    authorId: author.githubId,
                    label: highestPriorityLabel.name 
                },
                update: {
                    title: prData.title,
                    state: 'open',
                    url: prData.html_url,
                    openedAt: new Date(prData.created_at),
                    label: highestPriorityLabel.name 
                }
            });
            console.log(`PR #${prNumber} data saved as open.`);
            return res.status(200).send('PR opened on main branch. Data saved as open.');
        } else if (action === 'closed') {
            console.log(`PR #${prNumber} closed`);
            const isMerged = prData.merged;

            await prisma.pullRequests.upsert({
                where: {
                    prNumber_repository: {
                        prNumber: prNumber,
                        repository: req.body.repository.full_name
                    }
                },
                create: {
                    prNumber: prNumber,
                    repository: req.body.repository.full_name,
                    title: prData.title,
                    state: isMerged ? 'merged' : 'closed',
                    url: prData.html_url,
                    openedAt: new Date(prData.created_at),
                    points: 0,
                    authorId: author.githubId,
                    closedAt: new Date(prData.closed_at),
                    mergedAt: isMerged ? new Date(prData.merged_at) : null,
                    mergedBy: isMerged ? prData.merged_by.login : null,
                    label: highestPriorityLabel.name 
                },
                update: {
                    state: isMerged ? 'merged' : 'closed',
                    closedAt: new Date(prData.closed_at),
                    mergedAt: isMerged ? new Date(prData.merged_at) : null,
                    mergedBy: isMerged ? prData.merged_by.login : null,
                    label: highestPriorityLabel.name 
                }
            });
            console.log(`PR #${prNumber} state updated to ${isMerged ? 'merged' : 'closed'}.`);

            if (isMerged) {
                const points = prData.labels.reduce((total, label) => {
                    return total + (prPoints[label.name.toLowerCase()] || 0);
                }, 0);

                await prisma.pullRequests.update({
                    where: {
                        prNumber_repository: {
                            prNumber: prNumber,
                            repository: req.body.repository.full_name
                        }
                    },
                    data: { points: points }
                });

                await prisma.users.update({
                    where: { githubId: author.githubId },
                    data: {
                        points: { increment: points }
                    }
                });

                if(!author.email) {
                    await mailer.sendPrMergedMail(author.email, {
                        userName: author.name,
                        prNumber: prNumber,
                        prTitle: prData.title,
                        repoName: req.body.repository.full_name,
                        repoLink: req.body.repository.html_url,
                        mergeDate: new Date(prData.merged_at).toDateString(),
                        reviewerName: prData.merged_by.login,
                        leaderboardLink: "https://clubgamma.vercel.app/leaderboard"
                    });
                }

                console.log(`Updated points for user ${author.name} by ${points}.`);
                console.log(`Sent email to ${author.email} for merged PR.`);
                return res.status(200).send('PR merged. Points updated and email sent.');
            }
            return res.status(200).send('PR closed. State updated to closed.');
        } else if (action === 'reopened') {
            console.log(`PR #${prNumber} reopened`);

            await prisma.pullRequests.update({
                where: {
                    prNumber_repository: {
                        prNumber: prNumber,
                        repository: req.body.repository.full_name
                    }
                },
                data: { state: 'open' }
            });
            console.log(`PR #${prNumber} state updated to open.`);
            return res.status(200).send('PR reopened. State updated to open.');
        }
    }

    res.status(200).send('Webhook received');
};
