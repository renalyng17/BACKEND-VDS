// controllers/profileController.js
let users = [
  {
    user_id: 1,
    first_name: "Miguel",
    last_name: "Reyes",
    email: "miguelreyes@email.com",
    contact_no: "09123456789",
    user_type: "admin",
    office: "IT Department"
  }
];

const getProfile = (req, res) => {
  const user = users.find(u => u.user_id === 1);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { password, ...safeUser } = user;
  res.json(safeUser);
};

const updateProfile = (req, res) => {
  const userIndex = users.findIndex(u => u.user_id === 1);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  const { first_name, last_name, contact_no, office } = req.body;
  if (first_name !== undefined) users[userIndex].first_name = first_name;
  if (last_name !== undefined) users[userIndex].last_name = last_name;
  if (contact_no !== undefined) users[userIndex].contact_no = contact_no;
  if (office !== undefined) users[userIndex].office = office;

  const { password, ...safeUser } = users[userIndex];
  res.json({ message: "Profile updated successfully", user: safeUser });
};

module.exports = { getProfile, updateProfile };