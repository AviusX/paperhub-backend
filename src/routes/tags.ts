import express from 'express';
import isLoggedIn from '../middleware/isLoggedIn';
import { getTag, createTag } from '../controllers/tags/index';

const router = express.Router();

router.get('/:title', getTag);
router.post('/', isLoggedIn, createTag);

export default router;