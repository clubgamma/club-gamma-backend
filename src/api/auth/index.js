const { Router } = require('express');
const controller = require('./controller');
const { verifyJWT } = require('../../utils/Middlewares');
const passport = require('../../utils/GithubPassportStrategy');

const router = Router();

router.get('/me', verifyJWT, controller.getUser);

router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback', passport.authenticate('github', { failureRedirect: process.env.FRONTEND_URL }), controller.githubCallback);
router.post('/logout', controller.logout); // Add logout route

module.exports = router;
