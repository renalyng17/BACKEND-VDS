const express = require("express");
const pool = require("../db");
const jwt = require("jsonwebtoken");

const router = express.Router();

// ============================
//     AUTHENTICATION MIDDLEWARE
// ============================
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// ============================
//      GET USER NOTIFICATIONS
// ============================
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('📥 Fetching notifications for user:', req.user.userId);
    
    // Get notifications for the logged-in user's requests
    const result = await pool.query(`
      SELECT 
        n.notification_id as id,
        n.request_id as "requestId",
        n.type,
        n.message,
        n.read,
        n.created_at as "createdAt",
        n.updated_at as "updatedAt",
        r.destination,
        r.requesting_office as "requestingOffice",
        r.passenger_names as names,
        r.status,
        r.reason_for_decline as reason,
        r.driver_name as driver,
        r.vehicle_type as "vehicleType",
        r.plate_no as "plateNo"
      FROM tbl_notifications n
      INNER JOIN tbl_requests r ON n.request_id = r.request_id
      WHERE r.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 20
    `, [req.user.userId]);
    
    console.log(`✅ Found ${result.rows.length} notifications for user ${req.user.userId}`);
    
    // Format the response to match your frontend expectations
    const formattedNotifications = result.rows.map(notification => ({
      _id: notification.id,
      requestId: notification.requestId,
      type: notification.type,
      message: notification.message,
      read: notification.read,
      status: notification.status ? notification.status.toLowerCase() : 'pending',
      reason: notification.reason,
      destination: notification.destination,
      requestingOffice: notification.requestingOffice,
      names: notification.names,
      driver: notification.driver,
      vehicleType: notification.vehicleType,
      plateNo: notification.plateNo,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt || notification.createdAt
    }));

    return res.status(200).json(formattedNotifications);

  } catch (error) {
    console.error("❌ Fetch notifications error:", error);
    
    return res.status(500).json({ 
      error: "Failed to fetch notifications"
    });
  }
});

// ============================
//    MARK NOTIFICATION AS READ
// ============================
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📥 Marking notification ID: ${id} as read`);
    
    const result = await pool.query(
      `UPDATE tbl_notifications 
       SET read = true, updated_at = CURRENT_TIMESTAMP
       WHERE notification_id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: "Notification not found"
      });
    }

    return res.status(200).json({
      message: 'Notification marked as read',
      notification: result.rows[0]
    });

  } catch (error) {
    console.error("❌ Mark notification as read error:", error);
    
    return res.status(500).json({ 
      error: "Failed to update notification"
    });
  }
});

// ============================
//   GET UNREAD NOTIFICATIONS COUNT
// ============================
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    console.log('📥 Fetching unread notifications count for user:', req.user.userId);
    
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM tbl_notifications n
       INNER JOIN tbl_requests r ON n.request_id = r.request_id
       WHERE r.user_id = $1 AND n.read = false`,
      [req.user.userId]
    );

    const count = parseInt(result.rows[0].count);
    
    console.log(`✅ User ${req.user.userId} has ${count} unread notifications`);
    
    return res.status(200).json({ count });

  } catch (error) {
    console.error("❌ Get unread count error:", error);
    
    return res.status(500).json({ 
      error: "Failed to get unread count"
    });
  }
});

// ============================
//    MARK ALL AS READ
// ============================
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    console.log(`📥 Marking all notifications as read for user: ${req.user.userId}`);
    
    const result = await pool.query(
      `UPDATE tbl_notifications 
       SET read = true, updated_at = CURRENT_TIMESTAMP
       FROM tbl_requests r
       WHERE tbl_notifications.request_id = r.request_id 
       AND r.user_id = $1 
       AND tbl_notifications.read = false`,
      [req.user.userId]
    );

    return res.status(200).json({
      message: 'All notifications marked as read',
      affectedCount: result.rowCount
    });

  } catch (error) {
    console.error("❌ Mark all as read error:", error);
    
    return res.status(500).json({ 
      error: "Failed to mark all notifications as read"
    });
  }
});

// ============================
//    DELETE NOTIFICATION
// ============================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📥 Deleting notification ID: ${id}`);
    
    const result = await pool.query(
      'DELETE FROM tbl_notifications WHERE notification_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: "Notification not found"
      });
    }

    return res.status(200).json({
      message: "Notification deleted successfully"
    });

  } catch (error) {
    console.error("❌ Delete notification error:", error);
    
    return res.status(500).json({ 
      error: "Failed to delete notification"
    });
  }
});

module.exports = router;