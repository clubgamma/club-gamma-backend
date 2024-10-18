const { Router } = require('express');
const controller = require('./controller');
const { verifyJWT } = require('../../utils/Middlewares');

const router = Router();

router.use(verifyJWT);

router.get('/', controller.filterByUsers);
router.get('/search', controller.filterByUsers);
router.get('/filter', controller.filterByUsers);

module.exports = router;
