import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';
import userRoutes from './user.routes';
import authRoutes from './auth.routes';
import ideationRoutes from './ideation.routes';
import scriptRoutes from './script.routes';

const router = Router();

router.get('/health', getHealth);
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/ideation', ideationRoutes);
router.use('/script', scriptRoutes);

export default router;
