import express from 'express';
import authenticateToken from './middlewares/token.js';
import usersRouter from './routers/usersRouter.js';
import signUpRouter from './routers/signUpRouter.js';
import loginRouter from './routers/loginRouter.js';
import logoutRouter from './routers/logoutRouter.js';
import refreshTokenRouter from './routers/refreshTokenRouter.js';
import forgotPasswordRouter from './routers/forgotPasswordRouter.js';
import resetUserPasswordRouter from './routers/resetUserPasswordRouter.js';
import rolesRouter from './routers/rolesRouter.js';
import accessRolesRouter from './routers/accessRolesRouter.js';
import risksRouter from './routers/risksRouter.js';
import riskDetailRouter from './routers/riskDetailRouter.js';
import dashboardRouter from './routers/dashboardRouter.js';
import searchRouter from './routers/searchRouter.js';
import meRouter from './routers/meRouter.js';
import avatarsRouter from './routers/avatarsRouter.js';
import notificationsRouter from './routers/notificationsRouter.js';
import departmentsRouter from './routers/departmentsRouter.js';
import divisionsRouter from './routers/divisionsRouter.js';

const router = express.Router();

router.use('/signup', signUpRouter);
router.use('/login', loginRouter);
router.use('/forgot-password', forgotPasswordRouter);
router.use('/reset-password', resetUserPasswordRouter);

// Ahead of the global guard: a refresh carries an access token that has, by definition,
// already expired, so it needs the lenient check rather than the strict one.
router.use('/token', authenticateToken({ allowExpired: true }), refreshTokenRouter);

router.use(authenticateToken());

router.use('/users', usersRouter);
router.use('/roles', rolesRouter);
router.use('/access-roles', accessRolesRouter);
router.use('/risks', risksRouter);
router.use('/risks', riskDetailRouter);
router.use('/dashboard', dashboardRouter);
router.use('/search', searchRouter);
router.use('/me', meRouter);
router.use('/avatars', avatarsRouter);
router.use('/notifications', notificationsRouter);
router.use('/departments', departmentsRouter);
router.use('/divisions', divisionsRouter);

router.use('/logout', logoutRouter);

export default router;
