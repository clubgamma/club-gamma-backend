const { Router } = require('express');
const controller = require('./controller');

const router = Router();

router.get('/contributors/:id', controller.getContributors);

module.exports = router;
