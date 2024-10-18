const { Router } = require('express');
const controller = require('./controller');

const router = Router();

router.get('/users/:githubId', controller.getUserStats);

module.exports = router;
