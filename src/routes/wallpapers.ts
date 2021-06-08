import isLoggedIn from '../middleware/isLoggedIn';
import { uploadWallpapers } from '../controllers/wallpapers/index';
import express from 'express';

const router = express.Router();

router.post('/', isLoggedIn, uploadWallpapers);

export default router;