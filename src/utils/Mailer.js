const sgMail = require('@sendgrid/mail');
const logger = require('./Logger');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const links = require('../../links.json');

class Mailer {
    constructor() {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        this.sendMail = this.sendMail.bind(this);
    }

    async sendMail(to, subject, body) {
        try {
            const msg = {
                from: { name: process.env.MAILER_NAME, email: process.env.MAILER_MAIL },
                to,
                subject: subject,
                ...body,
            };

            await sgMail.send(msg);
            console.log('Email sent successfully');
        } catch (error) {
            logger.error(`[sendMail] - ${JSON.stringify(error.response ? error.response.body : error.message)}`);
        }
    }

    async sendGreetingMail(email, userName) {
        try {
            const htmlContent = await this.renderEjsTemplate('welcome-user', { userName });

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
            data.links = links;
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
