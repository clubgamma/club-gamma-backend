const { PrismaClient } = require('@prisma/client');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('./utils/GithubPassportStrategy');
const session = require('express-session');
const githubWebhookHandler = require('./webhook/github');
const logger = require('./utils/Logger');

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
// Initialize prisma client
const prisma = new PrismaClient();

const app = express();

// Middleware
app.use(morgan("[:date[clf]] :method :url :status :res[content-length] - :response-time ms"));

app.use(cors({
    origin: [process.env.FRONTEND_URL, 'http://localhost:5173'],
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(helmet());

// Session and passport setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'keyboard cat', // Use environment variable for secret
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Webhook handling
app.use('/webhook', express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}), githubWebhookHandler);

// Root route
app.get("/", (req, res) => {
    res.json("OK");
});

// Import routers
const authRouter = require('./api/auth/index');
const leaderboardRouter = require('./api/leaderboard/index');
const userRouter = require('./api/users/index');
const statsRouter = require('./api/stats/index');
const { errorMiddleware } = require("./utils/Middlewares");

// Apply routes
app.use('/api/auth', authRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/users', userRouter);
app.use('/api/stats', statsRouter);

// Error middleware should be last
app.use(errorMiddleware);

// Unhandled rejection handler
process.on("unhandledRejection", (reason, p) => {
    logger.debug(`Unhandled Rejection at: Promise ${p} reason: ${reason}`);
});

// Connect to database and start server if running locally
if (require.main === module) {
    const port = process.env.PORT || 3000;
    prisma.$connect()
        .then(() => {
            console.log('Connected to database');
            app.listen(port, () => {
                console.log(`Server is listening on port ${port}`);
            });
        })
        .catch(err => {
            console.error('Failed to connect to database', err);
        });
}

// Export the app for Vercel
module.exports = app;
