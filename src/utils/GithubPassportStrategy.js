const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const prisma = require('./PrismaClient');
const axios = require('axios');
const mailer = require('./Mailer');
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});

passport.use(new GitHubStrategy({
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: "/auth/github/callback",
        scope: ['user:email'] // Add email scope
    },
    async function(accessToken, refreshToken, profile, done) {
        try {
            // Find or create user
            let user = await prisma.users.findFirst({
                where: {
                    githubId: profile.username
                }
            });

            if (!user) {
                // Fetch emails using the access token
                const emailResponse = await axios.get('https://api.github.com/user/emails', {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                });
                // // Find primary email
                const primaryEmail = emailResponse.data.find(email => email.primary)?.email || emailResponse.data[0]?.email;
                const universityEmail = emailResponse.data.find(email => email.email.includes('charusat.edu.in'))?.email || null;

                user = await prisma.users.create({
                    data: {
                        githubId: profile.username,
                        email: primaryEmail,
                        universityEmail: universityEmail,
                        avatar: profile.photos[0]?.value,
                        name: profile.displayName,
                    }
                });
                await mailer.sendGreetingMail(primaryEmail, user.name);
            }

            return done(null, user);
        } catch (error) {
            console.error('Error during GitHub authentication:', error);
            return done(error, null);
        }
    }
));

module.exports = passport;
