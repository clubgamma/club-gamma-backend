const { PrismaClient } = require('@prisma/client'); // Assuming you have prisma client installed
const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const http = require('http');
const morgan = require('morgan');
const routes = require('./router');
const { errorMiddleware } = require('./utils/Middlewares');
const logger = require('./utils/Logger');
const passport = require('./utils/GithubPassportStrategy');
const session = require('express-session');
const githubWebhookHandler = require('./webhook/github');
const mailer = require('./utils/Mailer');
const prisma = new PrismaClient(); // Initialize prisma client

const app = express();
const server = http.createServer(app);
app.get('/sendmail', async (req, res) => {
    await mailer.sendPrMergedMail('jalaym825@gmail.com', {
        userName: "John Doe",
        prNumber: 42,
        prTitle: "Added Dark Mode to the Web Interface",
        repoName: "Club Gamma Project",
        repoLink: "https://github.com/clubgamma/project",
        mergeDate: "October 7, 2024",
        reviewerName: "Jane Smith",
        leaderboardLink: "https://clubgamma.com/leaderboard"
    })
    res.send("Mail sent");
})

app.use(morgan("[:date[clf]] :method :url :status :res[content-length] - :response-time ms"));

console.log(process.env.FRONTEND_URL);
app.use(cors({
    origin: [process.env.FRONTEND_URL],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true
}));

app.use('/webhook', express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}), githubWebhookHandler);


app.use(express.json());
app.use(helmet());
app.use(cookieParser());
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());


const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Worker ${process.pid} is listening on port ${port}`);
    prisma.$connect().then(() => {
        console.log('Connected to database');
    })
    // Import and use routes from a separate file
    routes(app);
    app.use(errorMiddleware);
});

app.get("/", (req, res) => {
    res.json("OK");
})

process.on("unhandledRejection", (reason, p) => {
    logger.debug(
        `Unhandled Rejection at:  Promise ${p} reason: ${reason}`
    );
    // application specific logging, throwing an error, or other logic here
});
