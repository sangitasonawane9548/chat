const express = require('express');
const {
  createGroup,
  getUserGroups,
  getGroupDetails,
  updateGroup,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  updateMemberRole,
  transferOwnership,
  deleteGroup
} = require('../controllers/groupController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);

router.post('/', createGroup);
router.get('/', getUserGroups);
router.get('/:id', getGroupDetails);
router.patch('/:id', updateGroup);
router.put('/:id', updateGroup);
router.post('/:id/members', addGroupMembers);
router.delete('/:id/members/:userId', removeGroupMember);
router.post('/:id/leave', leaveGroup);
router.post('/:id/members/:userId/role', updateMemberRole);
router.post('/:id/transfer-ownership', transferOwnership);
router.delete('/:id', deleteGroup);

module.exports = router;

