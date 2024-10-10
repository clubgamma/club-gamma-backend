
require('dotenv').config();
const mailer = require('../utils/Mailer');
console.log(process.env.SENDGRID_API_KEY)

mailer.sendGreetingMail('jalaym825@gmail.com', 'Jalay Movaliya');
