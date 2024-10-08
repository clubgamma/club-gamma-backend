const { Router } = require('express');
const controller = require('./controller');

const router = Router();

router.get('/stats/:githubId', controller.getUserStats);
router.post('/sync-prs', controller.syncPullRequests);

module.exports = router;
