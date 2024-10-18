const { Router } = require('express');
const controller = require('./controller');
const { verifyJWT } = require('../../utils/Middlewares');
const passport = require('../../utils/GithubPassportStrategy');

const router = Router();

// Get current user info
router.get('/me', verifyJWT, controller.getUser);

// GitHub authentication routes
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback', passport.authenticate('github', { failureRedirect: process.env.FRONTEND_URL }), controller.githubCallback);

// Logout route
router.post('/logout', controller.logout);

// Access token route
router.get('/access_token', controller.getAccessToken);

module.exports = router;
