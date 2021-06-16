import isLoggedIn from '../middleware/isLoggedIn';
import { getAllWallpapers, getWallpaper, uploadWallpaper, deleteWallpaper } from '../controllers/wallpapers';
import express from 'express';

const router = express.Router();

router.get('/', getAllWallpapers);
router.get('/:id', getWallpaper);
router.post('/', isLoggedIn, uploadWallpaper);
router.delete('/:id', isLoggedIn, deleteWallpaper);

export default router;