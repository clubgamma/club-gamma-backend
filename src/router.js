const authRouter = require('./api/auth/index');
const leaderboardRouter = require('./api/leaderboard/index');
const userRouter = require('./api/users/index');
const statsRouter = require('./api/stats/index');


function routes(app) {
    app.use('/api/auth', authRouter);
    app.use('/api/leaderboard', leaderboardRouter);
    app.use('/api/users', userRouter);
    app.use('/api/stats', statsRouter)
}

module.exports = routes;
