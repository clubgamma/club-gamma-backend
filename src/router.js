const authRouter = require('./api/auth/index');
const leaderboardRouter = require('./api/leaderboard/index');
const userRouter = require('./api/users/index');


function routes(app) {
    app.use('/auth', authRouter);
    app.use('/leaderboard', leaderboardRouter);
    app.use('/users', userRouter);
}

module.exports = routes;
