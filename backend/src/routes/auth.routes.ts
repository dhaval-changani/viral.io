import { Router } from 'express';
import { login, register } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { loginSchema } from '../schemas/auth.schema';
import { createUserSchema } from '../schemas/user.schema';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/register', validate(createUserSchema), register);

export default router;
