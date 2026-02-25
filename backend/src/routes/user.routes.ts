import { Router } from 'express';
import {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
} from '../controllers/user.controller';
import { validate } from '../middleware/validate';
import {
  createUserSchema,
  listUsersSchema,
  getUserByIdSchema,
  updateUserSchema,
  deleteUserSchema,
} from '../schemas/user.schema';

const router = Router();

router.post('/', validate(createUserSchema), createUser);
router.get('/', validate(listUsersSchema), listUsers);
router.get('/:id', validate(getUserByIdSchema), getUserById);
router.put('/:id', validate(updateUserSchema), updateUser);
router.delete('/:id', validate(deleteUserSchema), deleteUser);

export default router;
