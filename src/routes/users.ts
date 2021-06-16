import express from 'express';
import { getUser } from '../controllers/users';

const router = express.Router();

router.get('/:id', getUser);

export default router;