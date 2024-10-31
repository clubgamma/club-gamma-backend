const { Router } = require('express');
const controller = require('./controller');
const middleware = require("../../utils/Middlewares");
const router = Router();

router.get('/', controller.getStats);
router.get('/prs',middleware.verifyJWT , middleware.authorizeOwner,controller.projectWisePRs);  //only Owner can access
router.get('/prs/:projectId', middleware.verifyJWT , middleware.authorizeMaintainer ,controller.projectPRs);    //Both Owner and maintainer can access

module.exports = router;
