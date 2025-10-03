const pool = require('../../db');

  module.exports = {
    // Create new request
    createRequest: async (req, res) => {
      try {
        const { user_id, departure_time, arrival_time, destination, trip_duration_days, status, reason_for_dec } = req.body;
        
        const result = await pool.query(
          `INSERT INTO tbl_requests 
          (user_id, departure_time, arrival_time, destination, trip_duration_days, status, reason_for_dec)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *`,
          [user_id, departure_time, arrival_time, destination, trip_duration_days, status, reason_for_dec]
        );
        
        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({ message: 'Server error' });
      }
    },

    // Get all requests for a user
    getUserRequests: async (req, res) => {
      try {
        const userId = req.user.id;
        const result = await pool.query(
          'SELECT * FROM tbl_requests WHERE user_id = $1 ORDER BY departure_time DESC',
          [userId]
        );
        
        res.json(result.rows);
      } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ message: 'Server error' });
      }
    },

    // Update request status
    updateRequestStatus: async (req, res) => {
      try {
        const { requestId } = req.params;
        const { status, reason_for_dec } = req.body;
        
        const result = await pool.query(
          `UPDATE tbl_requests 
          SET status = $1, reason_for_dec = $2
          WHERE request_id = $3
          RETURNING *`,
          [status, reason_for_dec, requestId]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ message: 'Request not found' });
        }
        
        res.json(result.rows[0]);
      } catch (error) {
        console.error('Error updating request:', error);
        res.status(500).json({ message: 'Server error' });
      }
    }
  };