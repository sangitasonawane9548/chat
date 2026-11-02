import axios from 'axios';
import { getApiBaseUrl } from '@/utils/apiUrl';

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // For HTTP-only session cookies
  headers: {
    'Accept': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: Attach Admin or User token if available
api.interceptors.request.use((config) => {
  try {
    const adminToken = localStorage.getItem('admin_token');
    const userToken = localStorage.getItem('melt_token');
    if (!config.headers.Authorization) {
      if (adminToken) {
        config.headers.Authorization = `Bearer ${adminToken}`;
      } else if (userToken) {
        config.headers.Authorization = `Bearer ${userToken}`;
      }
    }
  } catch (e) {
    // ignore local storage errors
  }
  return config;
});

// Response interceptor: Normalizes server errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const customError = {
      message: error.response?.data?.message || error.message || 'An unexpected error occurred',
      status: error.response?.status,
      data: error.response?.data
    };
    return Promise.reject(customError);
  }
);

// -----------------------------------------------------------------------------
// Health API
// -----------------------------------------------------------------------------
export const checkApiHealth = async () => {
  const response = await api.get('/api/health');
  return response.data;
};

// -----------------------------------------------------------------------------
// Authentication APIs (Day 2)
// -----------------------------------------------------------------------------
export const checkUsernameAvailability = async (username) => {
  const response = await api.get(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
  return response.data;
};

export const registerUser = async (data) => {
  const response = await api.post('/api/auth/register', data);
  return response.data;
};

export const verifyEmailOtp = async (data) => {
  const response = await api.post('/api/auth/verify-email', data);
  return response.data;
};

export const resendVerificationOtp = async (data) => {
  const response = await api.post('/api/auth/resend-otp', data);
  return response.data;
};

export const loginUser = async (data) => {
  const response = await api.post('/api/auth/login', data);
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/api/auth/me');
  return response.data;
};

export const logoutUser = async () => {
  const response = await api.post('/api/auth/logout');
  return response.data;
};

export const logoutAllSessions = async () => {
  const response = await api.post('/api/auth/logout-all');
  return response.data;
};

export const getActiveSessions = async () => {
  const response = await api.get('/api/auth/sessions');
  return response.data;
};

export const requestPasswordReset = async (data) => {
  const response = await api.post('/api/auth/forgot-password', data);
  return response.data;
};

export const submitPasswordReset = async (data) => {
  const response = await api.post('/api/auth/reset-password', data);
  return response.data;
};

export const changePassword = async (data) => {
  const response = await api.post('/api/auth/change-password', data);
  return response.data;
};

// -----------------------------------------------------------------------------
// Day 3: Discovery, Profiles, Chat Requests & Notifications
// -----------------------------------------------------------------------------

/** Search users by query string with pagination */
export const searchUsers = async (q, page = 1, limit = 20) => {
  const response = await api.get('/api/users/search', {
    params: { q, page, limit }
  });
  return response.data;
};

/** Get suggested users */
export const getUserSuggestions = async () => {
  const response = await api.get('/api/users/suggestions');
  return response.data;
};

/** Get profile details by username */
export const getUserProfile = async (username) => {
  const response = await api.get(`/api/users/${encodeURIComponent(username)}`);
  return response.data;
};

/** Update own profile (name, bio, username) */
export const updateOwnProfile = async (data) => {
  const response = await api.put('/api/users/me/profile', data);
  return response.data;
};

/** Upload profile avatar */
export const uploadAvatar = async (formData, onProgress) => {
  const response = await api.post('/api/users/me/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    }
  });
  return response.data;
};

/** Send a chat request */
export const sendChatRequest = async (payload) => {
  const response = await api.post('/api/chat-requests', payload);
  return response.data;
};

/** Get pending incoming chat requests */
export const getIncomingChatRequests = async () => {
  const response = await api.get('/api/chat-requests/incoming');
  return response.data;
};

/** Get pending sent chat requests */
export const getSentChatRequests = async () => {
  const response = await api.get('/api/chat-requests/sent');
  return response.data;
};

/** Accept a chat request */
export const acceptChatRequest = async (requestId) => {
  const response = await api.post(`/api/chat-requests/${requestId}/accept`);
  return response.data;
};

/** Decline a chat request */
export const declineChatRequest = async (requestId) => {
  const response = await api.post(`/api/chat-requests/${requestId}/decline`);
  return response.data;
};

/** Cancel a sent chat request */
export const cancelChatRequest = async (requestId) => {
  const response = await api.post(`/api/chat-requests/${requestId}/cancel`);
  return response.data;
};

/** Get user authorized conversations */
export const getUserConversations = async () => {
  const response = await api.get('/api/conversations');
  return response.data;
};

/** Get single conversation details */
export const getConversationById = async (conversationId) => {
  const response = await api.get(`/api/conversations/${conversationId}`);
  return response.data;
};

/** Get conversation messages with pagination */
export const getConversationMessages = async (conversationId, params = {}) => {
  const response = await api.get(`/api/conversations/${conversationId}/messages`, { params });
  return response.data;
};

/** Send a message in conversation */
export const sendMessage = async (conversationId, data) => {
  const response = await api.post(`/api/conversations/${conversationId}/messages`, data);
  return response.data;
};

/** Edit own message within 15 mins */
export const editMessage = async (messageId, data) => {
  const response = await api.patch(`/api/messages/${messageId}`, data);
  return response.data;
};

/** Delete message for me */
export const deleteMessageForMe = async (messageId) => {
  const response = await api.delete(`/api/messages/${messageId}`);
  return response.data;
};

/** Delete message for everyone within 15 mins */
export const deleteMessageForEveryone = async (messageId) => {
  const response = await api.post(`/api/messages/${messageId}/delete-for-everyone`);
  return response.data;
};

/** Mark all messages in conversation as read */
export const markConversationAsRead = async (conversationId) => {
  const response = await api.post(`/api/conversations/${conversationId}/read`);
  return response.data;
};

/** Search messages in conversation */
export const searchConversationMessages = async (conversationId, query) => {
  const response = await api.get(`/api/conversations/${conversationId}/search`, {
    params: { q: query }
  });
  return response.data;
};

/** Clear conversation history for current user */
export const clearConversationHistory = async (conversationId) => {
  const response = await api.post(`/api/conversations/${conversationId}/clear`);
  return response.data;
};

/** Get user notifications */
export const getNotifications = async () => {
  const response = await api.get('/api/notifications');
  return response.data;
};

/** Mark notification as read */
export const markNotificationAsRead = async (id) => {
  const response = await api.patch(`/api/notifications/${id}/read`);
  return response.data;
};

/** Mark all notifications as read */
export const markAllNotificationsAsRead = async () => {
  const response = await api.patch('/api/notifications/read-all');
  return response.data;
};

// -----------------------------------------------------------------------------
// Day 5: Advanced Messaging, Media Sharing & Reactions
// -----------------------------------------------------------------------------

/** Upload media attachment in conversation with upload progress support */
export const uploadConversationAttachment = async (conversationId, formData, onUploadProgress) => {
  const response = await api.post(`/api/conversations/${conversationId}/attachments`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress(percent);
      }
    }
  });
  return response.data;
};

/** Toggle emoji reaction on message (adds or removes) */
export const toggleMessageReaction = async (messageId, reaction) => {
  const response = await api.post(`/api/messages/${messageId}/reactions`, { reaction });
  return response.data;
};

/** Remove emoji reaction from message */
export const removeMessageReaction = async (messageId, reaction) => {
  const response = await api.delete(`/api/messages/${messageId}/reactions`, { data: { reaction } });
  return response.data;
};

/** Forward message to target conversation */
export const forwardMessage = async (messageId, targetConversationId) => {
  const response = await api.post(`/api/messages/${messageId}/forward`, { targetConversationId });
  return response.data;
};

/** Helper to get full stream/download URL for media assets */
export const getAttachmentStreamUrl = (attachmentId) => {
  return `${API_BASE_URL}/api/attachments/${attachmentId}`;
};

export const getAttachmentDownloadUrl = (attachmentId) => {
  return `${API_BASE_URL}/api/attachments/${attachmentId}/download`;
};

// -----------------------------------------------------------------------------
// Day 6: Real-Time One-to-One Audio Calling
// -----------------------------------------------------------------------------

/** Initiate a new audio/video call */
export const initiateCallApi = async (data) => {
  const response = await api.post('/api/calls', data);
  return response.data;
};

/** Get call history with optional filters */
export const getCallHistoryApi = async (params = {}) => {
  const response = await api.get('/api/calls', { params });
  return response.data;
};

/** Get details of a single call */
export const getCallByIdApi = async (callId) => {
  const response = await api.get(`/api/calls/${callId}`);
  return response.data;
};

/** Cancel an outgoing call */
export const cancelCallApi = async (callId) => {
  const response = await api.post(`/api/calls/${callId}/cancel`);
  return response.data;
};

/** Reject an incoming call */
export const rejectCallApi = async (callId) => {
  const response = await api.post(`/api/calls/${callId}/reject`);
  return response.data;
};

/** End an active connected call */
export const endCallApi = async (callId) => {
  const response = await api.post(`/api/calls/${callId}/end`);
  return response.data;
};

/** Get active call status for authenticated user */
export const getActiveCallApi = async () => {
  const response = await api.get('/api/calls/active');
  return response.data;
};

// -----------------------------------------------------------------------------
// Day 8: Real-Time Group Chat & Management
// -----------------------------------------------------------------------------

/** Create a new group */
export const createGroupApi = async (data) => {
  const response = await api.post('/api/groups', data);
  return response.data;
};

/** Get all groups current user belongs to */
export const getUserGroupsApi = async () => {
  const response = await api.get('/api/groups');
  return response.data;
};

/** Get group details by ID or conversationId */
export const getGroupDetailsApi = async (id) => {
  const response = await api.get(`/api/groups/${id}`);
  return response.data;
};

/** Update group name, description, or profile image */
export const updateGroupApi = async (id, data) => {
  const response = await api.patch(`/api/groups/${id}`, data);
  return response.data;
};

/** Add members to group */
export const addGroupMembersApi = async (id, memberIds) => {
  const response = await api.post(`/api/groups/${id}/members`, { memberIds });
  return response.data;
};

/** Remove a member from group */
export const removeGroupMemberApi = async (id, userId) => {
  const response = await api.delete(`/api/groups/${id}/members/${userId}`);
  return response.data;
};

/** Leave a group */
export const leaveGroupApi = async (id) => {
  const response = await api.post(`/api/groups/${id}/leave`);
  return response.data;
};

/** Promote or demote member role ('admin' | 'member') */
export const updateMemberRoleApi = async (id, userId, role) => {
  const response = await api.post(`/api/groups/${id}/members/${userId}/role`, { role });
  return response.data;
};

/** Transfer group ownership to another member */
export const transferOwnershipApi = async (id, newOwnerId) => {
  const response = await api.post(`/api/groups/${id}/transfer-ownership`, { newOwnerId });
  return response.data;
};

/** Delete group (creator only) */
export const deleteGroupApi = async (id) => {
  const response = await api.delete(`/api/groups/${id}`);
  return response.data;
};

// -----------------------------------------------------------------------------
// Status / Stories APIs (Day 9)
// -----------------------------------------------------------------------------
export const createTextStatusApi = async (data) => {
  const response = await api.post('/api/statuses/text', data);
  return response.data;
};

export const createMediaStatusApi = async (formData, onUploadProgress) => {
  const response = await api.post('/api/statuses/media', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  });
  return response.data;
};

export const getMyStatusesApi = async () => {
  const response = await api.get('/api/statuses/me');
  return response.data;
};

export const getFeedStatusesApi = async () => {
  const response = await api.get('/api/statuses/feed');
  return response.data;
};

export const getActiveStatusesApi = getFeedStatusesApi;

export const getStatusDetailsApi = async (id) => {
  const response = await api.get(`/api/statuses/${id}`);
  return response.data;
};

export const recordStatusViewApi = async (id) => {
  const response = await api.post(`/api/statuses/${id}/views`);
  return response.data;
};

export const getStatusViewersApi = async (id) => {
  const response = await api.get(`/api/statuses/${id}/viewers`);
  return response.data;
};

export const toggleStatusReactionApi = async (id, emoji) => {
  const response = await api.post(`/api/statuses/${id}/reactions`, { emoji });
  return response.data;
};

export const replyToStatusApi = async (id, text) => {
  const response = await api.post(`/api/statuses/${id}/reply`, { text });
  return response.data;
};

export const deleteStatusApi = async (id) => {
  const response = await api.delete(`/api/statuses/${id}`);
  return response.data;
};

export const getStatusPrivacyApi = async () => {
  const response = await api.get('/api/statuses/privacy');
  return response.data;
};

export const updateStatusPrivacyApi = async (data) => {
  const response = await api.put('/api/statuses/privacy', data);
  return response.data;
};

export const toggleMuteUserStatusesApi = async (userId) => {
  const response = await api.post(`/api/statuses/mute/${userId}`);
  return response.data;
};

// -----------------------------------------------------------------------------
// User Settings & Privacy APIs (Day 10)
// -----------------------------------------------------------------------------
export const getUserSettingsApi = async () => {
  const response = await api.get('/api/users/settings');
  return response.data;
};

export const updateUserSettingsApi = async (data) => {
  const response = await api.put('/api/users/settings', data);
  return response.data;
};

export const getBlockedUsersApi = async () => {
  const response = await api.get('/api/users/blocked');
  return response.data;
};

export const blockUserApi = async (userId) => {
  const response = await api.post(`/api/users/block/${userId}`);
  return response.data;
};

export const unblockUserApi = async (userId) => {
  const response = await api.delete(`/api/users/block/${userId}`);
  return response.data;
};

export default api;
