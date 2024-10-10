const authRouter = require('./api/auth/index');
const leaderboardRouter = require('./api/leaderboard/index');
const userRouter = require('./api/users/index');
const { syncPrsRateLimiter } = require('./utils/Middlewares.js');

router.post('/sync-prs', verifyJWT, syncPrsRateLimiter, (req, res) => {
    res.status(200).json({ message: 'Sync PRs accessed successfully' });
  });

function routes(app) {
    app.use('/api/auth', authRouter);
    app.use('/api/leaderboard', leaderboardRouter);
    app.use('/api/users', userRouter);
}

module.exports = routes;
