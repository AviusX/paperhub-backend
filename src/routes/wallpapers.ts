import isLoggedIn from '../middleware/isLoggedIn';
import { uploadWallpaper } from '../controllers/wallpapers/index';
import express from 'express';

const router = express.Router();

router.post('/', isLoggedIn, uploadWallpaper);

export default router;