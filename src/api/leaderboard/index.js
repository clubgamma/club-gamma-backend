const { Router } = require('express');
const controller = require('./controller');
const { verifyJWT } = require('../../utils/Middlewares');

const router = Router();

router.get('/', controller.getLeaderboard);
router.get('/search', controller.searchUser);
router.get('/filter', controller.filterLeaderboard);

module.exports = router;
