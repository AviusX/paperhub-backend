import isLoggedIn from '../middleware/isLoggedIn';
import { getAllWallpapers, uploadWallpaper, deleteWallpapers } from '../controllers/wallpapers/index';
import express from 'express';

const router = express.Router();

router.get('/', getAllWallpapers);
router.post('/', isLoggedIn, uploadWallpaper);
router.delete('/', isLoggedIn, deleteWallpapers);

export default router;