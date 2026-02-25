import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';
import userRoutes from './user.routes';
import authRoutes from './auth.routes';

const router = Router();

router.get('/health', getHealth);
router.use('/users', userRoutes);
router.use('/auth', authRoutes);

export default router;
