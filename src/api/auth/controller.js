const logger = require('../../utils/Logger');
const mailer = require('../../utils/Mailer');
const jwt = require('jsonwebtoken');
const { default: axios } = require('axios');
const prisma = require("../../utils/PrismaClient");

const getUser = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            logger.warn(`[/auth/getUser] - user not found`);
            logger.debug(`[/auth/getUser] - user: ${req.user.sys_id}`);
            return next({ path: '/auth/getUser', status: 400, message: "User not found" })
        }
        logger.info(`[/auth/getUser] - success - ${user.sys_id}`);
        logger.debug(`[/auth/getUser] - user: ${user.sys_id}`);
        delete user.password;
        delete user.sys_id;
        return res.status(200).json({
            user,
        });
    } catch (err) {
        next({ path: '/auth/getUser', status: 400, message: err.message, extraData: err });
    }
}

const logout = async (req, res, next) => {
    try {
        res.clearCookie('token');
        return res.status(200).json({
            message: "Logged out successfully"
        });
    } catch (err) {
        next({ path: '/auth/logout', status: 400, message: err.message, extraData: err });
    }
}

const githubCallback = async (req, res, next) => {
    const user = req.user;
    const token = jwt.sign({ id: user.githubId }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });

    logger.info(`[/auth/github/callback] - Successfully authenticated user: ${user.sys_id}`);

    // Redirect to frontend
    res.redirect(process.env.FRONTEND_URL+"/redirect/"+token);
}

const getAccessToken = async (req, res, next) => {
    try {
        const code = req.query.code;

        console.log(code)

        const params = `client_id=${process.env.GITHUB_CLIENT_ID}&client_secret=${process.env.GITHUB_CLIENT_SECRET}&code=${code}`;

        const response = await axios.post('https://github.com/login/oauth/access_token?' + params);

        const accessToken = response.data.split('&')[0].split('=')[1];
        // get the user data
        let ghUser = await axios.get('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        ghUser=ghUser.data;

        console.log(ghUser)

        let user = await prisma.users.findFirst({
            where: {
                githubId: ghUser.login
            }
        });
        //
        if (!user) {
        //     // Fetch emails using the access token
            const emailResponse = await axios.get('https://api.github.com/user/emails', {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
        //     // // Find primary email
            const primaryEmail = emailResponse.data.find(email => email.primary)?.email || emailResponse.data[0]?.email;
            const universityEmail = emailResponse.data.find(email => email.email.includes('charusat.edu.in'))?.email || null;
        //
            user = await prisma.users.create({
                data: {
                    githubId: ghUser.login,
                    email: primaryEmail,
                    universityEmail: universityEmail,
                    avatar: ghUser.avatar_url,
                    name: profile.name,
                }
            });
            await mailer.sendGreetingMail(primaryEmail, user.name);
        }

        // create new jwt with githubId
        const token = jwt.sign({ id: user.githubId }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });


        return res.status(200).json({
            token,
        });
    }
    catch (err) {
        next({ path: '/auth/getAccessToken', status: 400, message: err.message, extraData: err });
    }
}

module.exports = {
    getUser,
    logout,
    githubCallback,
    getAccessToken
}
