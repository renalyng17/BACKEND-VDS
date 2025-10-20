const express = require("express");
const pool = require("../db");

const router = express.Router();

// ============================
//      GET ALL NOTIFICATIONS
// ============================
router.get('/', async (req, res) => {
  try {
    console.log('📥 Fetching all notifications...');
    
    // Try to get notifications from database
    const result = await pool.query(`
      SELECT 
        notification_id as id,
        request_id as "requestId",
        type,
        message,
        read,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM tbl_notifications 
      ORDER BY created_at DESC
      LIMIT 50
    `);
    
    console.log(`✅ Found ${result.rows.length} notifications from database`);
    
    return res.status(200).json(result.rows);

  } catch (error) {
    console.error("❌ Database error, falling back to in-memory:", error);
    
    // Fallback to in-memory notifications
    const fallbackNotifications = [
      {
        id: 1,
        requestId: 1,
        type: "new_request",
        message: "New travel request to Makati from HR Department",
        read: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    return res.status(200).json(fallbackNotifications);
  }
});

// ============================
//    MARK NOTIFICATION AS READ
// ============================
router.put('/:id/read', async (req, res) => {
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

    const notification = result.rows[0];
    
    return res.status(200).json({
      id: notification.notification_id,
      requestId: notification.request_id,
      type: notification.type,
      message: notification.message,
      read: notification.read,
      createdAt: notification.created_at,
      updatedAt: notification.updated_at
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
router.get('/unread/count', async (req, res) => {
  try {
    console.log('📥 Fetching unread notifications count...');
    
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM tbl_notifications 
       WHERE read = false`
    );

    const count = parseInt(result.rows[0].count);
    
    console.log(`✅ Found ${count} unread notifications`);
    
    return res.status(200).json({ count });

  } catch (error) {
    console.error("❌ Get unread count error:", error);
    
    // Fallback count
    return res.status(200).json({ count: 0 });
  }
});

// ============================
//    MARK ALL AS READ
// ============================
router.put('/mark-all-read', async (req, res) => {
  try {
    console.log(`📥 Marking all notifications as read`);
    
    const result = await pool.query(
      `UPDATE tbl_notifications 
       SET read = true, updated_at = CURRENT_TIMESTAMP
       WHERE read = false`
    );

    console.log(`✅ Marked ${result.rowCount} notifications as read`);
    
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
//    CREATE SAMPLE NOTIFICATION (for testing)
// ============================
router.post('/sample', async (req, res) => {
  try {
    console.log("📥 Creating sample notification");

    // Insert sample notification
    const result = await pool.query(
      `INSERT INTO tbl_notifications 
        (type, message, read)
       VALUES ($1, $2, $3) 
       RETURNING *`,
      ['new_request', 'Sample notification - New travel request to Test Location', false]
    );

    return res.status(201).json({
      message: 'Sample notification created',
      notification: result.rows[0]
    });

  } catch (error) {
    console.error("❌ Create sample notification error:", error);
    
    return res.status(500).json({ 
      error: "Failed to create sample notification"
    });
  }
});

module.exports = router;