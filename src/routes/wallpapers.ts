import isLoggedIn from '../middleware/isLoggedIn';
import {
    getAllWallpapers,
    getWallpaper,
    getThumbnail,
    uploadWallpaper,
    deleteWallpaper,
    searchWallpapers
} from '../controllers/wallpapers';
import express from 'express';

const router = express.Router();

router.get('/', getAllWallpapers);
router.get('/search', searchWallpapers);
router.get('/:id', getWallpaper);
router.get('/thumbnail/:id', getThumbnail);
router.post('/', isLoggedIn, uploadWallpaper);
router.delete('/:id', isLoggedIn, deleteWallpaper);

export default router;