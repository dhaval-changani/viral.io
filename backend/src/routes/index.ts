import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';
import userRoutes from './user.routes';
import authRoutes from './auth.routes';
import ideationRoutes from './ideation.routes';
import scriptRoutes from './script.routes';
import assetsRoutes from './assets.routes';
import renderRoutes from './render.routes';

const router = Router();

router.get('/health', getHealth);
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/ideation', ideationRoutes);
router.use('/script', scriptRoutes);
router.use('/assets', assetsRoutes);
router.use('/render', renderRoutes);

export default router;
