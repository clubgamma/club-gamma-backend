const authRouter = require('./api/auth/index');
const leaderboardRouter = require('./api/leaderboard/index');
const userRouter = require('./api/users/index');
const statsRouter = require('./api/stats/index');
const projectsRouter = require('./api/project/index');


function routes(app) {
    app.use('/api/auth', authRouter);
    app.use('/api/leaderboard', leaderboardRouter);
    app.use('/api/users', userRouter);
    app.use('/api/stats', statsRouter);
    app.use('/api/projects', projectsRouter);
}

module.exports = routes;
