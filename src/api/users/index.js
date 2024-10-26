const { Router } = require('express');
const controller = require('./controller');
const { rateLimiting , verifyJWT } = require('../../utils/Middlewares');
const router = Router();

router.get('/stats/:githubId', controller.getUserStats);
router.get('/contributors/:githubId', controller.getProjectWiseContributions);
router.post('/sync-prs', verifyJWT , rateLimiting, controller.syncPullRequests);

module.exports = router;
