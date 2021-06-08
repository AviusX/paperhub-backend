import isLoggedIn from '../middleware/isLoggedIn';
import { uploadWallpaper, deleteWallpapers } from '../controllers/wallpapers/index';
import express from 'express';

const router = express.Router();

router.post('/', isLoggedIn, uploadWallpaper);
router.delete('/', isLoggedIn, deleteWallpapers);

export default router;