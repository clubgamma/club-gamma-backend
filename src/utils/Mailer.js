const nodemailer = require("nodemailer");
const logger = require("./Logger");
const ejs = require("ejs");
const fs = require("fs");
const path = require("path");

class Mailer {
    from = process.env.GMAIL;
    transporter;
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: "gmail",
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.MAILER_MAIL,
                pass: process.env.MAILER_SECRET,
            },
        });
        this.sendMail = this.sendMail.bind(this);
    }

    async sendMail(to, subject, body) {
        return await this.transporter.sendMail({
            from: { name: process.env.MAILER_NAME, address: process.env.MAILER_MAIL },
            to,
            subject: subject,
            ...body
        });
    }

    async sendGreetingMail(email, userName) {
        try {
            const htmlContent = await this.renderEjsTemplate('welcome-user', {
                userName,
            });

            const body = { html: htmlContent };
            await this.sendMail([email], 'Welcome to Club Gamma!', body);
        } catch (error) {
            logger.error(`[sendGreetingMail] - ${error.stack}`);
        }
    }

    async sendPrMergedMail(email, prData) {
        try {
            const htmlContent = await this.renderEjsTemplate('pr-merged', prData);

            const body = { html: htmlContent };
            await this.sendMail([email], 'PR Merged!', body);
        } catch (error) {
            logger.error(`[sendPrMergedMail] - ${error.stack}`);
        }
    }

    async renderEjsTemplate(templateName, data) {
        return new Promise((resolve, reject) => {
            const templatePath = path.join(`src/templates/${templateName}.ejs`);
            console.log(templatePath);
            ejs.renderFile(templatePath, data, (err, result) => {
                if (err) {
                    logger.error(`[renderEjsTemplate] - ${err.stack}`);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }
}

module.exports = new Mailer();
