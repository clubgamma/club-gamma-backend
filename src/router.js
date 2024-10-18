const authRouter = require('./api/auth/index');
const leaderboardRouter = require('./api/leaderboard/index');
const userRouter = require('./api/users/index');
<<<<<<< HEAD
const statsRouter = require('./api/stats/index');
=======
const { syncPrsRateLimiter } = require('./utils/Middlewares.js');
>>>>>>> f485fc933e49550f8f297a9d18a1765290d21a97

router.post('/sync-prs', verifyJWT, syncPrsRateLimiter, (req, res) => {
    res.status(200).json({ message: 'Sync PRs accessed successfully' });
  });

function routes(app) {
    app.use('/api/auth', authRouter);
    app.use('/api/leaderboard', leaderboardRouter);
    app.use('/api/users', userRouter);
    app.use('/api/stats', statsRouter)
}

module.exports = routes;
