const { Router } = require('express');
const controller = require('./controller');
const { verifyJWT } = require('../../utils/Middlewares');

const router = Router();

router.get('/', controller.filterLeaderboard);
router.get('/search', controller.filterByUser);
router.get('/filter', controller.filterByUser);

module.exports = router;
