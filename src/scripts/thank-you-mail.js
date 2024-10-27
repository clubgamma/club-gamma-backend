require('dotenv').config();
const mailer = require('../utils/Mailer');
const prisma = require('../utils/PrismaClient');

const getMergedContributorEmails = async () => {
    try {
        const contributors = await prisma.users.findMany({
            where: {
                prs: {
                    some: {
                        state: 'merged', // Filter for users who have merged at least one PR
                    },
                },
            },
            select: {
                email: true, // Select only the email field
            },
        });

        // Map the results to extract the email addresses into an array
        const emailArray = contributors.map(contributor => contributor.email).filter(email => email !== null);

        return emailArray; // Return the array of emails
    } catch (error) {
        console.error('Error fetching contributor emails:', error);
        throw new Error('Failed to fetch contributor emails');
    }
};

const contributors = await getMergedContributorEmails();
mailer.sendThankYouMail(contributors);
