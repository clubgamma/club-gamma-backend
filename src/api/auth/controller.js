const logger = require('../../utils/Logger');
const mailer = require('../../utils/Mailer');
const jwt = require('jsonwebtoken');
const { default: axios } = require('axios');

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

    // Set the cookie with HttpOnly and Secure flags
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'strict',
    });

    logger.info(`[/auth/github/callback] - Successfully authenticated user: ${user.sys_id}`);

    // Redirect to frontend
    res.redirect(process.env.FRONTEND_URL);
}

module.exports = {
    getUser,
    logout,
    githubCallback,
}
