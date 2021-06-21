import express from 'express';
import { getUser, getUserWallpapers } from '../controllers/users';

const router = express.Router();

router.get('/:id', getUser);
router.get('/:id/wallpapers', getUserWallpapers);

export default router;